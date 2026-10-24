import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getZai } from "@/lib/zai";
import { detectScript, isRateLimitError, withRateLimitRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/transcribe — multipart/form-data with an `audio` or `file` field
 * Returns: { id, text, script, qualityWarning }
 *
 * Engineering notes (verified by round-trip testing):
 *  - The ASR engine handles English (and Chinese) with near-perfect accuracy,
 *    including webm/opus mic recordings.
 *  - It does NOT support Arabic: Arabic speech degrades into phonetic
 *    approximations. When the transcript comes back in Arabic script we flag
 *    it with qualityWarning so the UI can warn the user honestly.
 *  - The service rate-limits aggressively (429 bursts) → retried with
 *    exponential backoff before failing with a friendly message.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("audio") ?? formData?.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "An audio file is required" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: "Audio file too large (max 25 MB)" },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const zai = await getZai();

    let response: { text?: string } | undefined;
    try {
      response = await withRateLimitRetry(() => zai.audio.asr.create({ file_base64: base64Audio }), {
        retries: 2,
        baseDelayMs: 5_000,
        onRetry: (attempt, delayMs) =>
          console.log(`[/api/transcribe] rate-limited, retry ${attempt}/2 in ${delayMs}ms`),
      });
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

    const text: string | undefined = response?.text;
    if (!text || !text.trim()) {
      return Response.json(
        { error: "No speech detected in this audio" },
        { status: 422 }
      );
    }

    const script = detectScript(text);

    const record = await db.transcription.create({
      data: {
        fileName: file.name || "recording",
        text: text.trim(),
      },
    });

    return Response.json({
      id: record.id,
      text: record.text,
      script,
      // Arabic speech is not supported by the ASR engine — mark the transcript
      // so the UI can warn that the output is likely inaccurate.
      qualityWarning: script === "arabic",
    });
  } catch (err) {
    console.error("[/api/transcribe] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
