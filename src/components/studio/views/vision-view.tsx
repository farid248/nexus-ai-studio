"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileImage,
  Loader2,
  ScanEye,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Markdown } from "../markdown";
import { PromptOptimizer } from "../prompt-optimizer";

const EXAMPLE_PROMPTS = [
  "Describe this image in detail — objects, colors, mood and context",
  "Extract all visible text (OCR) and preserve its layout",
  "List every object you can detect with approximate positions",
  "Analyze this UI screenshot and suggest concrete improvements",
];

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_DIMENSION = 2048; // long-side cap — keeps the VLM payload small and fast
const KEEP_ORIGINAL_LIMIT = 1.5 * 1024 * 1024; // under this, keep the original bytes as-is
const DIRECT_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALPHA_MIMES = new Set([
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/apng",
]);

interface FileMeta {
  name: string;
  width: number;
  height: number;
  sizeKb: number;
  converted: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Decode a data URL in the browser — the real gate for "is this an image?". */
function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      img.naturalWidth > 0 && img.naturalHeight > 0
        ? resolve(img)
        : reject(new Error("Image has no dimensions"));
    img.onerror = () => reject(new Error("Browser cannot decode this image"));
    img.src = dataUrl;
  });
}

/** Re-encode through a canvas: normalizes exotic formats and caps the size. */
function reencodeImage(
  img: HTMLImageElement,
  mime: "image/png" | "image/jpeg"
): string {
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  if (mime === "image/jpeg") {
    // Flatten transparency onto white — JPEG has no alpha channel.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(mime, mime === "image/jpeg" ? 0.92 : undefined);
}

export function VisionView() {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [fileMeta, setFileMeta] = React.useState<FileMeta | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: "Images must be under 8 MB.",
        variant: "destructive",
      });
      return;
    }

    let rawUrl: string;
    try {
      rawUrl = await fileToDataUrl(file);
    } catch {
      toast({
        title: "Could not read file",
        description:
          "The file could not be read from disk. Try re-saving it and upload again.",
        variant: "destructive",
      });
      return;
    }

    // The decode check is the real validation: Windows often reports no MIME
    // type for formats like .jfif/.pjp, and some files are renamed HEIC/AVIF
    // images. If the browser can't decode it, the vision model can't either.
    let img: HTMLImageElement;
    try {
      img = await decodeImage(rawUrl);
    } catch {
      toast({
        title: "This image can't be displayed",
        description:
          "The browser cannot decode this file — it may be corrupted, or a HEIC/AVIF/TIFF image renamed with a .png extension. Convert it to PNG or JPEG (open it in any image viewer → Save As) and upload again.",
        variant: "destructive",
      });
      return;
    }

    // Normalize exotic formats and oversized images into something every
    // vision model accepts: PNG when transparency matters, JPEG otherwise.
    const oversized =
      Math.max(img.naturalWidth, img.naturalHeight) > MAX_DIMENSION;
    const exotic = !DIRECT_MIMES.has(file.type);
    const heavy = rawUrl.length > KEEP_ORIGINAL_LIMIT;
    let finalUrl = rawUrl;
    let converted = false;

    if (oversized || exotic || heavy) {
      try {
        const preferPng =
          file.type === "image/png" || ALPHA_MIMES.has(file.type) || !file.type;
        finalUrl = reencodeImage(img, preferPng ? "image/png" : "image/jpeg");
        converted = true;
      } catch {
        // Canvas failed (rare) — fall back to the original bytes.
        finalUrl = rawUrl;
        converted = false;
      }
    }

    setImageUrl(finalUrl);
    setFileMeta({
      name: file.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeKb: Math.round(file.size / 1024),
      converted,
    });
    setAnalysis(null);
  };

  const analyze = async () => {
    if (!imageUrl || !prompt.trim() || loading) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrl, prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vision request failed");
      setAnalysis(data.analysis);
    } catch (err) {
      toast({
        title: "Vision error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <ScanEye className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Vision Analysis</h1>
              <p className="text-xs text-muted-foreground">
                Upload an image and ask the vision model anything about it
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="space-y-4"
          >
            <Card className="border-border/70 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" /> Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />

                {imageUrl ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg border border-border/70">
                      <img
                        src={imageUrl}
                        alt="Image to analyze"
                        className="max-h-72 w-full object-contain bg-black/20"
                      />
                      <button
                        onClick={() => {
                          setImageUrl(null);
                          setFileMeta(null);
                        }}
                        aria-label="Remove image"
                        className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white transition-colors hover:bg-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {fileMeta && (
                      <p className="truncate text-xs text-muted-foreground">
                        {fileMeta.name} · {fileMeta.width}×{fileMeta.height} ·{" "}
                        {fileMeta.sizeKb} KB
                        {fileMeta.converted && " · auto-converted"}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileImage className="h-4 w-4" /> Choose a different image
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFile(f);
                    }}
                    className={cn(
                      "flex h-56 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors",
                      dragging
                        ? "border-primary bg-primary/10"
                        : "border-border/80 bg-secondary/20 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop an image here</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        or click to browse · PNG, JPEG, WebP, GIF, AVIF · max 8 MB
                      </p>
                    </div>
                  </button>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wand2 className="h-4 w-4 text-primary" /> Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="What do you want to know about this image?"
                  aria-label="Vision prompt"
                  className="w-full resize-none rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="rounded-full border border-border/70 bg-secondary/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {p.length > 42 ? `${p.slice(0, 42)}…` : p}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <PromptOptimizer
                    prompt={prompt}
                    mode="vision"
                    disabled={loading}
                    showLabel
                    onApply={setPrompt}
                  />
                  <Button
                    className="w-full gap-2"
                    disabled={!imageUrl || !prompt.trim() || loading}
                    onClick={analyze}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing with VLM…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Analyze image
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: result */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
          >
            <Card className="h-full border-border/70 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ScanEye className="h-4 w-4 text-primary" /> Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : analysis ? (
                  <div className="rounded-lg border border-border/70 bg-secondary/30 p-4">
                    <Markdown content={analysis} />
                  </div>
                ) : (
                  <div className="flex h-56 flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary/60">
                      <ScanEye className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Nothing analyzed yet
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                      Upload an image, pick a question and the vision model will
                      describe it right here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
