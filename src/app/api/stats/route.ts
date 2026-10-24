import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — dashboard aggregates + a few recent generations
 */
export async function GET() {
  try {
    const [
      conversations,
      messages,
      images,
      transcriptions,
      memories,
      optimizations,
      optimizationsApplied,
      recentImages,
    ] = await Promise.all([
      db.conversation.count(),
      db.message.count(),
      db.generatedImage.count({ where: { status: "done" } }),
      db.transcription.count(),
      db.memory.count(),
      db.promptOptimization.count(),
      db.promptOptimization.count({ where: { applied: true } }),
      db.generatedImage.findMany({
        where: { status: "done" },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    return Response.json({
      conversations,
      messages,
      images,
      transcriptions,
      memories,
      optimizations,
      optimizationsApplied,
      recentImages: recentImages.map((img) => ({
        id: img.id,
        prompt: img.prompt,
        size: img.size,
        url: img.url,
        status: img.status,
        errorMessage: img.errorMessage,
        createdAt: img.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[/api/stats] error:", err);
    return Response.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
