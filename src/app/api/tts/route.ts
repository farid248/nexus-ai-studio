import { NextRequest, NextResponse } from "next/server";
import { getZai } from "@/lib/zai";
import { isRateLimitError, withRateLimitRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICES = new Set(["tongtong", "chuichui", "xiaochen", "jam", "kazi", "douji", "luodo"]);
const MAX_INPUT = 1024; // API constraint: max 1024 chars per request

/**
 * POST /api/tts
 * Body: { text: string, voice?: string, speed?: number }
 * Returns: binary audio/wav
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voice = typeof body?.voice === "string" && VOICES.has(body.voice) ? body.voice : "tongtong";
    let speed = typeof body?.speed === "number" ? body.speed : 1.0;

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > MAX_INPUT) {
      return Response.json(
        { error: `Text exceeds the ${MAX_INPUT}-character limit` },
        { status: 400 }
      );
    }
    // Clamp speed into the API-allowed range [0.5, 2.0]
    speed = Math.min(2.0, Math.max(0.5, speed));

    const zai = await getZai();

    let response: Response;
    try {
      response = await withRateLimitRetry(
        () =>
          zai.audio.tts.create({
            input: text,
            voice,
            speed,
            response_format: "wav",
            stream: false,
          }) as Promise<Response>,
        {
          retries: 2,
          baseDelayMs: 5_000,
          onRetry: (attempt, delayMs) =>
            console.log(`[/api/tts] rate-limited, retry ${attempt}/2 in ${delayMs}ms`),
        }
      );
    } catch (err) {
      if (isRateLimitError(err)) {
        return Response.json(
          {
            error:
              "The speech service is rate-limited right now — please wait a few minutes and try again.",
          },
          { status: 429 }
        );
      }
      throw err;
    }

    // The SDK returns a standard Response object for TTS
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    if (buffer.length === 0) {
      return Response.json({ error: "TTS returned empty audio" }, { status: 502 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[/api/tts] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Speech synthesis failed" },
      { status: 500 }
    );
  }
}
