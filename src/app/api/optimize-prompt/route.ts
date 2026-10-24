import { db } from "@/lib/db";
import { getZai } from "@/lib/zai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/optimize-prompt — the Prompt Optimizer engine.
 *
 * Any prompt typed in the studio (chat / image / vision) can be sent here
 * BEFORE execution. An LLM meta-prompting pass rewrites it into a stronger,
 * more specific version — preserving the user's intent — and explains what
 * it improved. Every optimization is logged (PromptOptimization) so the
 * dashboard can report analytics.
 *
 * Body: { prompt: string, mode: "chat" | "image" | "vision", conversationId?: string }
 * Returns: { id, mode, optimizedPrompt, improvements: string[], summary }
 */

type OptimizeMode = "chat" | "image" | "vision";

const MODES: ReadonlySet<string> = new Set(["chat", "image", "vision"]);

const OPTIMIZER_SYSTEM_PROMPT = [
  "You are the Prompt Optimization Engine of Nexus AI Studio — a world-class prompt-engineering expert.",
  "The user typed a prompt that is about to be executed by an AI model. Rewrite it into a significantly",
  "more effective prompt WITHOUT changing the user's intent.",
  "",
  "Mode-specific guidelines:",
  "",
  "[chat] The prompt goes to a conversational LLM:",
  "- Make the task explicit and unambiguous; add any missing context",
  "- Assign a clear role/persona when it strengthens the answer",
  "- Specify constraints: scope, length, tone, audience, language of the answer",
  "- Define the desired output format (sections, bullet lists, tables, code blocks)",
  "- Include an example only when it genuinely helps; skip filler",
  "",
  "[image] The prompt goes to a text-to-image diffusion model:",
  "- Enrich the subject with concrete visual details (materials, clothing, setting, action)",
  "- Specify style and medium (photography, oil painting, 3D render, anime...)",
  "- Add lighting, composition, camera angle/lens, color palette and mood",
  "- ONE flowing descriptive sentence or comma-separated phrases, max ~80 words",
  "- Never use negative phrasing like \"don't include X\" — describe only what SHOULD appear",
  "",
  "[vision] The prompt is a question about an uploaded image for a vision-language model:",
  "- State exactly what to analyze: objects, text (OCR), colors, layout, emotions, quality",
  "- Ask for a structured answer (short headings, bullet lists, priorities)",
  "- Specify granularity (exhaustive detail vs concise summary) and what matters most",
  "",
  "Universal rules:",
  "- PRESERVE the original intent — never replace it with a different request",
  "- Resolve vague references (\"that\", \"it\", \"continue\") using the conversation context when provided",
  "- The optimized prompt must be fully self-contained",
  "- Write the optimizedPrompt in the SAME language as the original prompt",
  "  (technical/artistic English terms are welcome inside non-English prompts)",
  "- Write every improvement note and the summary in the SAME language as the original prompt",
  "- If the original prompt is already strong, polish it lightly — there is always something to sharpen",
  "",
  "Respond with STRICT JSON only — no prose, no markdown fences:",
  '{"optimizedPrompt":"...","improvements":["short note","short note","short note"],"summary":"one line on why the new version works better"}',
  "improvements must contain 3-5 short notes, each under 20 words.",
].join("\n");

interface OptimizerResult {
  optimizedPrompt: string;
  improvements: string[];
  summary: string;
}

/** Robustly pulls the first JSON object out of an LLM answer. */
function parseOptimizerJson(text: string | undefined): OptimizerResult | null {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof parsed?.optimizedPrompt !== "string" || !parsed.optimizedPrompt.trim()) return null;
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements
          .filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item: string) => item.trim())
      : [];
    return {
      optimizedPrompt: parsed.optimizedPrompt.trim(),
      improvements,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    };
  } catch {
    return null;
  }
}

/** How many recent messages feed the optimizer as conversation context (chat mode). */
const CONTEXT_MESSAGES = 6;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const mode: OptimizeMode = MODES.has(body?.mode) ? (body.mode as OptimizeMode) : "chat";
    const conversationId =
      typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : null;

    if (!prompt) {
      return Response.json({ error: "A prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return Response.json({ error: "Prompt is too long (max 4000 chars)" }, { status: 400 });
    }

    // Chat mode: pull the most recent messages so the optimizer can resolve
    // vague references ("fix that", "continue") into a self-contained prompt.
    let contextBlock = "";
    if (mode === "chat" && conversationId) {
      const recent = await db.message
        .findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: CONTEXT_MESSAGES,
          select: { role: true, content: true },
        })
        .catch(() => []);
      if (recent.length > 0) {
        contextBlock = [
          "Recent conversation context (use it to resolve vague references):",
          recent
            .reverse()
            .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content.slice(0, 500)}`)
            .join("\n"),
        ].join("\n");
      }
    }

    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: OPTIMIZER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Mode: ${mode}`,
            contextBlock,
            `User's prompt to optimize:\n"""\n${prompt}\n"""`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw: string | undefined = completion?.choices?.[0]?.message?.content;
    const parsed = parseOptimizerJson(raw);
    if (!parsed) {
      return Response.json(
        { error: "The optimizer could not produce a result — please try again" },
        { status: 502 }
      );
    }

    const optimizedPrompt = parsed.optimizedPrompt.slice(0, 6000);
    const improvements = parsed.improvements.slice(0, 6).map((note) => note.slice(0, 220));

    const row = await db.promptOptimization.create({
      data: {
        originalPrompt: prompt,
        optimizedPrompt,
        mode,
        improvements: JSON.stringify(improvements),
      },
    });

    return Response.json({
      id: row.id,
      mode,
      optimizedPrompt,
      improvements,
      summary: parsed.summary.slice(0, 400),
    });
  } catch (err) {
    console.error("[/api/optimize-prompt] error:", err);
    return Response.json({ error: "Prompt optimization failed" }, { status: 500 });
  }
}

/**
 * PATCH /api/optimize-prompt?id=… — marks an optimization as applied, i.e.
 * the user actually sent the optimized version to the model. Powers the
 * "prompts enhanced / applied" analytics on the dashboard.
 */
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    await db.promptOptimization
      .update({ where: { id }, data: { applied: true } })
      .catch(() => undefined); // unknown id → no-op, analytics only

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/api/optimize-prompt PATCH] error:", err);
    return Response.json({ error: "Could not mark optimization" }, { status: 500 });
  }
}
