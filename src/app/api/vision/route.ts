import { NextRequest } from "next/server";
import type { CreateChatCompletionVisionBody } from "z-ai-web-dev-sdk";
import { getZai, invalidateZai, isAuthError } from "@/lib/zai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vision
 * Body: { image: string (data URL or https URL), prompt: string }
 * Returns: { analysis: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const image = typeof body?.image === "string" ? body.image.trim() : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!image) {
      return Response.json({ error: "An image is required" }, { status: 400 });
    }
    if (!prompt) {
      return Response.json({ error: "A prompt is required" }, { status: 400 });
    }

    const isDataUrl = image.startsWith("data:image/");
    const isHttpUrl = /^https?:\/\//i.test(image);
    if (!isDataUrl && !isHttpUrl) {
      return Response.json(
        { error: "Image must be a data URL or an http(s) URL" },
        { status: 400 }
      );
    }
    if (image.length > 12_000_000) {
      return Response.json({ error: "Image payload too large" }, { status: 413 });
    }

    const visionBody = {
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: prompt },
            { type: "image_url" as const, image_url: { url: image } },
          ],
        },
      ],
      thinking: { type: "disabled" as const },
    };

    const buildRequest = () =>
      getZai().then((client) =>
        client.chat.completions.createVision(
          visionBody as CreateChatCompletionVisionBody
        )
      );

    let response: Awaited<ReturnType<typeof buildRequest>>;
    try {
      response = await buildRequest();
    } catch (error) {
      // Cached SDK client may predate the current token — rebuild and retry.
      if (!isAuthError(error)) throw error;
      invalidateZai();
      response = await buildRequest();
    }

    const analysis: string | undefined = response?.choices?.[0]?.message?.content;
    if (!analysis || !analysis.trim()) {
      return Response.json({ error: "The vision model returned an empty answer" }, { status: 502 });
    }

    return Response.json({ analysis });
  } catch (err) {
    console.error("[/api/vision] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Vision analysis failed" },
      { status: 500 }
    );
  }
}
