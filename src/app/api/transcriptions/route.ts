import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/transcriptions — recent ASR transcripts (newest first)
 */
export async function GET() {
  try {
    const transcriptions = await db.transcription.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return Response.json(
      transcriptions.map((t) => ({
        id: t.id,
        fileName: t.fileName,
        text: t.text,
        duration: t.duration,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[/api/transcriptions] error:", err);
    return Response.json({ error: "Failed to load transcriptions" }, { status: 500 });
  }
}
