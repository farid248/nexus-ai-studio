import { db } from "@/lib/db";
import { getZai } from "@/lib/zai";

/**
 * Long-term memory engine.
 *
 * Three layers power the agent's persistent focus on the user:
 *
 *  1. Semantic memory (model `Memory`)      — durable facts about the user,
 *     auto-extracted after exchanges (or added manually), injected into the
 *     system prompt of EVERY conversation.
 *  2. Episodic memory (`Conversation.summary`) — a rolling LLM summary of
 *     older messages in the current chat, so very long sessions stay focused
 *     without overflowing the context window.
 *  3. Working memory — the most recent messages, sent verbatim.
 */

export const MEMORY_CATEGORIES = [
  "personal",
  "preference",
  "goal",
  "skill",
  "project",
  "fact",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const isCategory = (value: unknown): value is MemoryCategory =>
  typeof value === "string" && (MEMORY_CATEGORIES as readonly string[]).includes(value);

/** How many memories are injected into the system prompt. */
const MAX_CONTEXT_MEMORIES = 60;
/** Messages kept verbatim as working memory. */
const WORKING_WINDOW = 16;
/** Total messages in a conversation before rolling summarization kicks in. */
const SUMMARY_THRESHOLD = 24;
/** Minimum new messages before the summary is refreshed. */
const SUMMARY_MIN_BATCH = 4;

/* ------------------------------------------------------------------ */
/* 1. Semantic memory — context builder                                */
/* ------------------------------------------------------------------ */

/**
 * Builds the long-term memory block for the system prompt and bumps
 * usage counters on the injected memories.
 */
export async function buildMemoryContext(): Promise<string> {
  const memories = await db.memory.findMany({
    orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
    take: MAX_CONTEXT_MEMORIES,
    select: { id: true, content: true, category: true },
  });

  if (memories.length === 0) return "";

  // Usage stats (fire-and-forget — never blocks the chat response)
  db.memory
    .updateMany({
      where: { id: { in: memories.map((m) => m.id) } },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    })
    .catch((err) => console.error("[memory] use-count bump failed:", err));

  const lines = memories.map((m) => `- [${m.category}] ${m.content}`);
  return [
    "## Long-term memory — what you remember about this user",
    "(persisted across ALL conversations, not just this one)",
    ...lines,
  ].join("\n");
}

/** Memory guidance appended to the system prompt. */
export const MEMORY_GUIDANCE = [
  "## How to use your memory",
  "- You have persistent long-term memory about the user (listed above).",
  "- Use it naturally to personalize answers: greet them by name when fitting,",
  "reference their goals, skills, preferences and ongoing projects.",
  "- NEVER announce that you are reading from a memory list, and never recite it.",
  "- If the user asks what you remember about them, give a friendly, organized recap.",
  "- When the user shares new durable facts about themselves, acknowledge them briefly",
  "(\"Noted — I'll remember that\") — the system stores them automatically.",
].join("\n");

/* ------------------------------------------------------------------ */
/* 2. Semantic memory — automatic extraction                           */
/* ------------------------------------------------------------------ */

const EXTRACTION_SYSTEM_PROMPT = [
  "You are the memory-extraction module of an AI assistant. From the latest chat exchange,",
  "identify NEW long-term facts about the USER worth remembering permanently.",
  "",
  "Rules:",
  "- Only durable facts: name, job, location, skills, preferences, goals, ongoing projects,",
  "important dates, tools they use, how they like answers formatted.",
  "- NEVER extract: one-off questions, transient details, topics that were merely discussed,",
  "facts about the world (only facts about the USER matter).",
  "- Skip anything already present in the existing memories list.",
  "- Write each memory as one short third-person sentence in English.",
  '  Examples: "The user\'s name is Ahmed, an AI engineer from Cairo." /',
  '  "The user prefers TypeScript with strict types." / "The user is preparing a CV project portfolio."',
  "- importance is 1-5: 5 = core identity or long-term goals, 1 = minor detail.",
  "",
  'Respond with STRICT JSON only, no prose, no markdown fences:',
  '{"memories":[{"content":"...","category":"personal|preference|goal|skill|project|fact","importance":1-5}]}',
  "If nothing new is worth remembering, respond exactly: {\"memories\":[]}",
].join("\n");

interface ExtractedMemory {
  content: string;
  category: MemoryCategory;
  importance: number;
}

/** Robustly pulls the first JSON object out of an LLM answer. */
function parseJsonLoose(text: string): ExtractedMemory[] | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed?.memories)) return null;
    const out: ExtractedMemory[] = [];
    for (const item of parsed.memories) {
      if (typeof item?.content !== "string") continue;
      const content = item.content.trim().slice(0, 300);
      if (content.length < 4) continue;
      out.push({
        content,
        category: isCategory(item.category) ? item.category : "fact",
        importance: Math.min(5, Math.max(1, Number(item.importance) || 3)),
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Runs one extraction pass over the latest user/assistant exchange and
 * upserts any new memories (deduplicated by unique content).
 * Returns the number of new memories stored.
 */
export async function extractMemories(
  userText: string,
  assistantText: string
): Promise<number> {
  try {
    const existing = await db.memory.findMany({
      select: { content: true },
      orderBy: { updatedAt: "desc" },
      take: 250,
    });

    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "Existing memories (do NOT repeat these):",
            existing.length ? existing.map((m) => `- ${m.content}`).join("\n") : "(none yet)",
            "",
            "Latest exchange:",
            `USER: ${userText.slice(0, 4000)}`,
            `ASSISTANT: ${assistantText.slice(0, 2000)}`,
          ].join("\n"),
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw: string | undefined = completion?.choices?.[0]?.message?.content;
    if (!raw) return 0;

    const extracted = parseJsonLoose(raw);
    if (!extracted || extracted.length === 0) return 0;

    let stored = 0;
    for (const mem of extracted.slice(0, 8)) {
      try {
        await db.memory.create({
          data: {
            content: mem.content,
            category: mem.category,
            importance: mem.importance,
            source: "auto",
          },
        });
        stored += 1;
      } catch {
        // Unique constraint violation → already remembered; skip silently.
      }
    }
    if (stored > 0) {
      console.log(`[memory] extracted ${stored} new memor${stored === 1 ? "y" : "ies"}`);
    }
    return stored;
  } catch (err) {
    console.error("[memory] extraction failed:", err);
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* 3. Episodic memory — rolling conversation summary                   */
/* ------------------------------------------------------------------ */

const SUMMARY_SYSTEM_PROMPT = [
  "You maintain a rolling summary of a long conversation between a user and an AI assistant.",
  "Merge the previous summary with the new messages into ONE updated summary.",
  "Keep it under 300 words, in English, focusing on: what the user wants, decisions made,",
  "key facts learned, and where the conversation currently stands.",
  "Respond with the summary text only — no titles, no preamble.",
].join("\n");

/**
 * Keeps `Conversation.summary` in sync: summarizes messages that fall outside
 * the working window so the agent stays focused in very long sessions.
 */
export async function updateConversationSummary(conversationId: string): Promise<void> {
  try {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true, summaryMessageCount: true },
    });
    if (!conversation) return;

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const total = messages.length;
    if (total < SUMMARY_THRESHOLD) return;

    const summarizeTo = total - WORKING_WINDOW;
    const alreadySummarized = conversation.summaryMessageCount;
    if (summarizeTo - alreadySummarized < SUMMARY_MIN_BATCH) return;

    const slice = messages.slice(alreadySummarized, summarizeTo);
    const formatted = slice
      .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content.slice(0, 1200)}`)
      .join("\n");

    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Previous summary:\n${conversation.summary ?? "(none — this is the first summary)"}`,
            "",
            "New messages to merge in:",
            formatted,
          ].join("\n"),
        },
      ],
      thinking: { type: "disabled" },
    });

    const summary: string | undefined = completion?.choices?.[0]?.message?.content;
    if (!summary || !summary.trim()) return;

    await db.conversation.update({
      where: { id: conversationId },
      data: { summary: summary.trim().slice(0, 4000), summaryMessageCount: summarizeTo },
    });
    console.log(
      `[memory] rolling summary updated (${summarizeTo}/${total} messages summarized)`
    );
  } catch (err) {
    console.error("[memory] summary update failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Post-exchange pipeline (runs in the background after a reply)       */
/* ------------------------------------------------------------------ */

/**
 * Called after an assistant reply has been persisted:
 *  - extracts new long-term memories from the exchange
 *  - refreshes the rolling summary when the conversation grows long
 * Never throws — memory maintenance must not break the chat flow.
 */
export function postProcessExchange(
  conversationId: string,
  userText: string,
  assistantText: string
): void {
  void (async () => {
    await extractMemories(userText, assistantText);
    await updateConversationSummary(conversationId);
  })().catch((err) => console.error("[memory] post-process failed:", err));
}
