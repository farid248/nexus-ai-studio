import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/[id] — full message history for one conversation
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json(
      conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[/api/conversations/:id] GET error:", err);
    return Response.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id] — remove a thread (messages cascade)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await db.conversation.delete({
      where: { id },
      select: { id: true },
    });

    if (!deleted) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[/api/conversations/:id] DELETE error:", err);
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
