import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/conversations — recent conversation threads with message counts
 */
export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });

    return Response.json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count.messages,
      }))
    );
  } catch (err) {
    console.error("[/api/conversations] error:", err);
    return Response.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}
