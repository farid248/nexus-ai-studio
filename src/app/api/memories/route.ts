import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { MEMORY_CATEGORIES, type MemoryCategory } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(mem: {
  id: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  source: string;
  useCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: mem.id,
    content: mem.content,
    category: mem.category,
    importance: mem.importance,
    pinned: mem.pinned,
    source: mem.source === "manual" ? ("manual" as const) : ("auto" as const),
    useCount: mem.useCount,
    lastUsedAt: mem.lastUsedAt ? mem.lastUsedAt.toISOString() : null,
    createdAt: mem.createdAt.toISOString(),
    updatedAt: mem.updatedAt.toISOString(),
  };
}

function parseCategory(value: unknown): MemoryCategory | null {
  return typeof value === "string" &&
    (MEMORY_CATEGORIES as readonly string[]).includes(value)
    ? (value as MemoryCategory)
    : null;
}

function parseImportance(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * GET /api/memories — all memories, pinned first, then importance, then recency.
 */
export async function GET() {
  try {
    const memories = await db.memory.findMany({
      orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
      take: 300,
    });
    return Response.json(memories.map(serialize));
  } catch (err) {
    console.error("[/api/memories] GET error:", err);
    return Response.json({ error: "Failed to load memories" }, { status: 500 });
  }
}

/**
 * POST /api/memories — add a memory manually.
 * Body: { content: string, category?, importance?, pinned? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!content) {
      return Response.json({ error: "Memory content is required" }, { status: 400 });
    }
    if (content.length > 300) {
      return Response.json({ error: "Memory is too long (max 300 chars)" }, { status: 400 });
    }

    const data: {
      content: string;
      category: string;
      importance: number;
      pinned: boolean;
      source: string;
    } = {
      content,
      category: parseCategory(body?.category) ?? "fact",
      importance: parseImportance(body?.importance) ?? 3,
      pinned: body?.pinned === true,
      source: "manual",
    };

    const memory = await db.memory.create({ data }).catch(async (err: unknown) => {
      // Unique constraint → update the existing memory instead
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return db.memory.update({
          where: { content },
          data: {
            category: data.category,
            importance: data.importance,
            pinned: data.pinned,
          },
        });
      }
      throw err;
    });

    return Response.json(serialize(memory), { status: 201 });
  } catch (err) {
    console.error("[/api/memories] POST error:", err);
    const message = err instanceof Error ? err.message : "Failed to create memory";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/memories — edit an existing memory.
 * Body: { id: string, content?, category?, importance?, pinned? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return Response.json({ error: "Memory id is required" }, { status: 400 });
    }

    const data: Record<string, string | number | boolean> = {};
    if (typeof body?.content === "string" && body.content.trim()) {
      const content = body.content.trim();
      if (content.length > 300) {
        return Response.json({ error: "Memory is too long (max 300 chars)" }, { status: 400 });
      }
      data.content = content;
    }
    const category = parseCategory(body?.category);
    if (category) data.category = category;
    const importance = parseImportance(body?.importance);
    if (importance) data.importance = importance;
    if (typeof body?.pinned === "boolean") data.pinned = body.pinned;

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    const memory = await db.memory.update({ where: { id }, data });
    return Response.json(serialize(memory));
  } catch (err) {
    console.error("[/api/memories] PATCH error:", err);
    const message = err instanceof Error ? err.message : "Failed to update memory";
    const notFound = message.includes("not found") || message.includes("P2025");
    return Response.json(
      { error: notFound ? "Memory not found" : message },
      { status: notFound ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/memories?id=<id>  — delete one memory
 * DELETE /api/memories?all=true — clear the entire memory store
 */
export async function DELETE(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "true";
    const id = req.nextUrl.searchParams.get("id");

    if (all) {
      const result = await db.memory.deleteMany({});
      return Response.json({ deleted: result.count });
    }
    if (!id) {
      return Response.json({ error: "Memory id is required (or ?all=true)" }, { status: 400 });
    }

    await db.memory.delete({ where: { id } });
    return Response.json({ deleted: 1 });
  } catch (err) {
    console.error("[/api/memories] DELETE error:", err);
    const message = err instanceof Error ? err.message : "Failed to delete memory";
    const notFound = message.includes("not found") || message.includes("P2025");
    return Response.json(
      { error: notFound ? "Memory not found" : message },
      { status: notFound ? 404 : 500 }
    );
  }
}
