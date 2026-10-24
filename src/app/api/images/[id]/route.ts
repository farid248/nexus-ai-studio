import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/images/[id] — remove a generated image (file + row).
 * Works for any status: a `processing` row may not have a file yet, and if
 * its background job is still running the job notices the missing row and
 * cleans up any file it wrote afterwards.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await db.generatedImage.findUnique({ where: { id } });
    if (!record) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    await db.generatedImage.delete({ where: { id } });

    // Best-effort file cleanup — never fail the request on unlink errors.
    if (record.url) {
      try {
        await unlink(path.join(process.cwd(), "public", record.url.replace(/^\//, "")));
      } catch (fileErr) {
        console.warn("[/api/images/:id] file cleanup skipped:", fileErr);
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[/api/images/:id] DELETE error:", err);
    return Response.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
