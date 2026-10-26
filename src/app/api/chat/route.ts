import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getZai, invalidateZai, isAuthError } from "@/lib/zai";
import {
  buildMemoryContext,
  MEMORY_GUIDANCE,
  postProcessExchange,
} from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = [
  "You are Nexus, the assistant inside Nexus AI Studio — a multimodal AI platform.",
  "Answer accurately and concisely. Prefer structured markdown: short paragraphs,",
  "bullet lists and tables when they help. Always tag fenced code blocks with the language.",
  "If a question is ambiguous, state your assumption first, then answer.",
  "Reply in the same language the user writes in (English, Arabic, etc.).",
].join(" ");

/** Messages kept verbatim as working memory (older ones are summarized). */
const WORKING_WINDOW = 16;

const encoder = new TextEncoder();

function sseHeaders(conversationId: string): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Conversation-Id": conversationId,
  };
}

/**
 * POST /api/chat
 * Body: { conversationId?: string, message: string }
 *
 * Streams the model answer as OpenAI-style SSE chunks while accumulating
 * the full response server-side; the assistant message is persisted on flush.
 *
 * Memory-aware: the system prompt embeds the agent's long-term memories
 * about the user + a rolling summary of older messages in this chat, and a
 * background pipeline extracts new memories after each exchange.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const conversationId =
      typeof body?.conversationId === "string" && body.conversationId
        ? body.conversationId
        : null;

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 8000) {
      return Response.json({ error: "Message is too long (max 8000 chars)" }, { status: 400 });
    }

    // Resolve (or create) the conversation
    let conversation = conversationId
      ? await db.conversation.findUnique({ where: { id: conversationId } })
      : null;
    if (!conversation) {
      conversation = await db.conversation.create({
        data: { title: message.slice(0, 60) },
      });
    }
    const convId = conversation.id;

    // Load history + persist the new user message
    const history = await db.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    await db.message.create({
      data: { conversationId: convId, role: "user", content: message },
    });

    // ---- Build the memory-aware system message -----------------------
    // 1. Long-term (semantic) memory — facts about the user, shared across chats
    const memoryBlock = await buildMemoryContext();
    // 2. Episodic memory — rolling summary of older messages in this chat
    const summaryBlock = conversation.summary
      ? `## Earlier in this conversation (auto-summary)\n${conversation.summary}`
      : "";

    const systemMessage = [
      SYSTEM_PROMPT,
      memoryBlock,
      summaryBlock,
      MEMORY_GUIDANCE,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 3. Working memory — recent messages sent verbatim
    const workingHistory =
      conversation.summary && history.length > WORKING_WINDOW
        ? history.slice(-WORKING_WINDOW)
        : history.slice(-40);

    // Build the model context (system prompt uses the assistant role per SDK docs)
    const messages = [
      { role: "assistant", content: systemMessage },
      ...workingHistory.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const buildRequest = () =>
      getZai().then((client) =>
        client.chat.completions.create({
          messages,
          stream: true,
          thinking: { type: "disabled" },
        })
      );

    let upstream: Awaited<ReturnType<typeof buildRequest>>;
    try {
      upstream = await buildRequest();
    } catch (error) {
      // Auth failures mean the cached SDK client was built before the
      // current token was provisioned — rebuild once from disk and retry.
      if (!isAuthError(error)) throw error;
      invalidateZai();
      upstream = await buildRequest();
    }

    // Non-streaming fallback: SDK returned a JSON completion instead of a stream
    if (!(upstream instanceof ReadableStream)) {
      const content: string = upstream?.choices?.[0]?.message?.content ?? "";
      if (content) {
        await db.message.create({
          data: { conversationId: convId, role: "assistant", content },
        });
        await db.conversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });
        postProcessExchange(convId, message, content);
      }
      const single = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                choices: [{ delta: { content } }],
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(single, { headers: sseHeaders(convId) });
    }

    // Stream transform: forward SSE chunks, accumulate full answer, persist on flush
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const payload = trimmed.slice(5).trim();
            if (payload && payload !== "[DONE]") {
              try {
                const json = JSON.parse(payload);
                const delta: string | undefined = json.choices?.[0]?.delta?.content;
                if (delta) full += delta;
              } catch {
                // keep-alive or malformed chunk — forwarded untouched
              }
            }
          }
          controller.enqueue(encoder.encode(`${line}\n`));
        }
      },
      async flush() {
        if (full.trim()) {
          try {
            await db.message.create({
              data: { conversationId: convId, role: "assistant", content: full },
            });
            await db.conversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error("[/api/chat] persist failed:", err);
            return;
          }
          // Memory maintenance (LLM extraction + rolling summary) runs in
          // the background so the client stream closes without extra delay.
          postProcessExchange(convId, message, full);
        }
      },
    });

    return new Response(upstream.pipeThrough(transform), {
      headers: sseHeaders(convId),
    });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
