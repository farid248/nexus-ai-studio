import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getZai } from "@/lib/zai";
import { detectScript } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_SIZES = new Set([
  "1024x1024",
  "768x1344",
  "864x1152",
  "1344x768",
  "1152x864",
  "1440x720",
  "720x1440",
]);

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

/** Hard ceiling for a background generation job (ms). */
const JOB_TIMEOUT_MS = 180_000;

/**
 * The image API rejects unsafe/sensitive prompts with error code 1301 and a
 * Chinese message. Detect that case so we can retry gracefully instead of
 * surfacing a raw error to the user.
 */
function isContentFilterError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("1301") ||
    message.includes("contentFilter") ||
    message.includes("敏感")
  );
}

function isPrismaNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("P2025") || msg.includes("Record to update not found");
}

const PROMPT_REWRITER_SYSTEM = [
  "You are a prompt rewriter for a text-to-image API that rejected a prompt due to its safety filter.",
  "Rewrite the prompt keeping the same creative intent, composition and visual style,",
  "but remove anything that could trigger content filters (real names of people,",
  "violent, political or otherwise sensitive elements).",
  "ALWAYS reply in English regardless of the input language.",
  "Reply with ONLY the rewritten prompt on a single line — no quotes, no explanation.",
  "If a safe rewrite is truly impossible, reply with exactly: UNSAFE",
].join("\n");

/**
 * The diffusion model only understands English (and Chinese) prompts. Anything
 * else — Arabic in particular — gets misparsed and false-flagged by its safety
 * filter (1301), so non-Latin/CJK prompts are LLM-translated into a rich
 * English diffusion prompt BEFORE hitting the image API.
 */
const PROMPT_TRANSLATOR_SYSTEM = [
  "You are a prompt translator for a text-to-image diffusion model.",
  "The model only understands English prompts — anything written in another script gets misinterpreted and rejected.",
  "Translate the user's prompt into a single vivid, detailed ENGLISH diffusion prompt:",
  "- Preserve the full creative intent: subject, scene, composition, style, mood and colors.",
  "- Naturally enrich with diffusion-friendly keywords (lighting, camera, level of detail) where it helps, without changing the intent.",
  "Reply with ONLY the English prompt on a single line — no quotes, no explanation.",
].join("\n");

/** LLM-translates a non-English prompt into an English diffusion prompt. */
async function translatePromptToEnglish(
  zai: Awaited<ReturnType<typeof getZai>>,
  original: string
): Promise<string | null> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: PROMPT_TRANSLATOR_SYSTEM },
        { role: "user", content: original },
      ],
      thinking: { type: "disabled" },
    });
    const translated = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    if (
      !translated ||
      translated.includes("\n") ||
      translated.length < 4 ||
      translated.length > 2000
    ) {
      return null;
    }
    return translated.replace(/^["']|["']$/g, "");
  } catch (err) {
    console.error("[/api/images] prompt translation failed:", err);
    return null;
  }
}

/** Uses the LLM to rewrite a flagged prompt into a safe equivalent. */
async function rewritePromptSafely(
  zai: Awaited<ReturnType<typeof getZai>>,
  original: string
): Promise<string | null> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: PROMPT_REWRITER_SYSTEM },
        { role: "user", content: original },
      ],
      thinking: { type: "disabled" },
    });
    const rewritten = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    if (
      !rewritten ||
      rewritten.toUpperCase() === "UNSAFE" ||
      rewritten.includes("\n") ||
      rewritten.length < 8 ||
      rewritten.length > 2000
    ) {
      return null;
    }
    return rewritten.replace(/^["']|["']$/g, "");
  } catch (err) {
    console.error("[/api/images] prompt rewrite failed:", err);
    return null;
  }
}

function friendlyJobError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (isContentFilterError(message)) {
    return (
      "The safety filter rejected this prompt. Try rephrasing it — avoid real people's names, violence, or sensitive topics."
    );
  }
  if (/\b429\b|too many requests/i.test(message)) {
    return "The image service is rate-limited right now — please wait a few minutes and try again.";
  }
  return message || "Image generation failed";
}

/**
 * Background generation job. Runs detached from the request: diffusion takes
 * 25-80s, far longer than any gateway/proxy timeout, so the request itself
 * must return immediately and the client polls the gallery for completion.
 * The job keeps running even if the user closes the tab — the image lands in
 * the gallery either way.
 */
async function runGenerationJob(
  imageId: string,
  initialPrompt: string,
  size: string
): Promise<void> {
  let fileName: string | null = null;
  try {
    const zai = await getZai();
    let effectivePrompt = initialPrompt;

    // Safety-filter rejection → one LLM rewrite + retry.
    let response;
    try {
      response = await Promise.race([
        zai.images.generations.create({ prompt: effectivePrompt, size }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Generation timed out")), JOB_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      if (!isContentFilterError(err)) throw err;

      console.warn("[/api/images] safety filter hit — rewriting prompt once");
      const rewritten = await rewritePromptSafely(zai, effectivePrompt);
      if (!rewritten || rewritten === effectivePrompt) {
        throw new Error(
          "The safety filter rejected this prompt. Try rephrasing it — avoid real people's names, violence, or sensitive topics."
        );
      }
      effectivePrompt = rewritten;
      response = await Promise.race([
        zai.images.generations.create({ prompt: rewritten, size }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Generation timed out")), JOB_TIMEOUT_MS)
        ),
      ]);
    }

    const base64: string | undefined = response?.data?.[0]?.base64;
    if (!base64) throw new Error("Image generation returned no data");

    fileName = `${randomUUID()}.png`;
    await mkdir(GENERATED_DIR, { recursive: true });
    await writeFile(path.join(GENERATED_DIR, fileName), Buffer.from(base64, "base64"));

    await db.generatedImage.update({
      where: { id: imageId },
      data: {
        status: "done",
        url: `/generated/${fileName}`,
        prompt: effectivePrompt,
        errorMessage: null,
      },
    });
  } catch (err) {
    console.error(`[/api/images] job ${imageId} failed:`, err);
    // If the row was deleted while the job was running, just clean the file.
    if (fileName) {
      try {
        await unlink(path.join(GENERATED_DIR, fileName));
      } catch {
        /* best-effort */
      }
    }
    if (isPrismaNotFoundError(err)) return;
    try {
      await db.generatedImage.update({
        where: { id: imageId },
        data: { status: "failed", errorMessage: friendlyJobError(err) },
      });
    } catch (updateErr) {
      // Row deleted mid-flight — nothing left to report to.
      if (!isPrismaNotFoundError(updateErr)) {
        console.error(`[/api/images] job ${imageId} status update failed:`, updateErr);
      }
    }
  }
}

function serialize(img: {
  id: string;
  prompt: string;
  size: string;
  url: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}) {
  return {
    id: img.id,
    prompt: img.prompt,
    size: img.size,
    url: img.url,
    status: img.status,
    errorMessage: img.errorMessage,
    createdAt: img.createdAt.toISOString(),
  };
}

/**
 * GET /api/images — the generation gallery (newest first), including
 * in-progress jobs so the client can poll for completion.
 */
export async function GET() {
  try {
    const images = await db.generatedImage.findMany({
      orderBy: { createdAt: "desc" },
      take: 48,
    });

    return Response.json(images.map(serialize));
  } catch (err) {
    console.error("[/api/images] GET error:", err);
    return Response.json({ error: "Failed to load gallery" }, { status: 500 });
  }
}

/**
 * POST /api/images — queue an image generation job.
 * Body: { prompt: string, size?: string }
 *
 * Diffusion takes 25-80s, which exceeds upstream proxy timeouts — so this
 * endpoint only validates, translates non-English prompts (fast LLM pass) and
 * creates a `processing` row, then returns immediately. The client polls
 * GET /api/images; the job flips the row to `done` (with url) or `failed`.
 * Even if the browser disconnects, generation continues server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const size = typeof body?.size === "string" ? body.size : "1024x1024";

    if (!prompt) {
      return Response.json({ error: "A prompt is required" }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return Response.json({ error: "Prompt is too long (max 2000 chars)" }, { status: 400 });
    }
    if (!SUPPORTED_SIZES.has(size)) {
      return Response.json({ error: `Unsupported size: ${size}` }, { status: 400 });
    }

    const zai = await getZai();

    let effectivePrompt = prompt;
    let translatedPrompt: string | null = null;

    // Arabic (and any other non-Latin/CJK script) is false-flagged by the
    // safety filter because the model cannot parse it. Translate first —
    // a fast LLM pass that keeps this request well under proxy timeouts.
    const script = detectScript(prompt);
    if (script === "arabic" || script === "other") {
      const translated = await translatePromptToEnglish(zai, prompt);
      if (translated) {
        effectivePrompt = translated;
        translatedPrompt = translated;
      }
      // If translation failed the job below still tries the original — the
      // safety-rewrite fallback may recover it.
    }

    const record = await db.generatedImage.create({
      data: { prompt: effectivePrompt, size, status: "processing" },
    });

    // Detached job — never awaited by the request.
    void runGenerationJob(record.id, effectivePrompt, size);

    return Response.json({
      id: record.id,
      prompt: record.prompt,
      size: record.size,
      url: null,
      status: "processing",
      errorMessage: null,
      createdAt: record.createdAt.toISOString(),
      translatedPrompt,
    });
  } catch (err) {
    console.error("[/api/images] POST error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to queue generation" },
      { status: 500 }
    );
  }
}
