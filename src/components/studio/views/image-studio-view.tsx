"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  AlertTriangle,
  Download,
  ImageIcon,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { IMAGE_SIZES, type GeneratedImageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PromptOptimizer } from "../prompt-optimizer";

/** "1152x864" → "1152 / 864" for CSS aspect-ratio (falls back to square). */
function aspectRatioOf(size: string): string {
  const [w, h] = size.split("x").map((n) => Number.parseInt(n, 10));
  if (!w || !h) return "1 / 1";
  return `${w} / ${h}`;
}

export function ImageStudioView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = React.useState("");
  const [size, setSize] = React.useState<string>("1024x1024");
  const [submitting, setSubmitting] = React.useState(false);

  const { data: images, isLoading } = useQuery<GeneratedImageDTO[]>({
    queryKey: ["images"],
    queryFn: async () => {
      const res = await fetch("/api/images");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error("Failed to load gallery");
      return data as GeneratedImageDTO[];
    },
    // While jobs are running in the background, poll the gallery so the
    // placeholders flip to real images (or a failure reason) automatically.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((img) => img.status === "processing") ? 3000 : false,
  });

  const generate = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "Could not queue the generation — please retry.");
      }
      await queryClient.invalidateQueries({ queryKey: ["images"] });
      const notes: string[] = [];
      if (data.translatedPrompt) {
        // The diffusion model can't parse Arabic prompts — the API
        // auto-translated it to English first. Tell the user what was sent.
        notes.push(
          `Your prompt was auto-translated to English for the diffusion model: “${String(data.translatedPrompt).slice(0, 90)}${String(data.translatedPrompt).length > 90 ? "…" : ""}”`
        );
      }
      toast({
        title: "Generation queued",
        description:
          (notes.length > 0
            ? notes.join(" ")
            : "The diffusion model is painting in the background —") +
          " the gallery updates automatically. You can keep browsing.",
      });
      setPrompt("");
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteImage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error("Delete failed");
      await queryClient.invalidateQueries({ queryKey: ["images"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      toast({
        title: "Could not delete image",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const doneCount = (images ?? []).filter((img) => img.status !== "processing").length;

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
              <ImagePlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Image Studio</h1>
              <p className="text-xs text-muted-foreground">
                Text-to-image diffusion · background jobs · prompt optimizer · persistent gallery
              </p>
            </div>
          </div>
        </motion.div>

        {/* Generator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06 }}
        >
          <Card className="mb-8 border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" /> Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    generate();
                  }
                }}
                rows={3}
                placeholder="A cinematic photo of a robot painting a canvas, warm studio light, ultra detailed…"
                aria-label="Image prompt"
                className="w-full resize-none rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              />

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Aspect ratio
                </p>
                <div className="flex flex-wrap gap-2">
                  {IMAGE_SIZES.map((s) => {
                    const active = size === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setSize(s.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 transition-all",
                          active
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/70 bg-secondary/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "w-5 rounded-[3px] border",
                            active ? "border-primary/70 bg-primary/25" : "border-current/40 bg-current/10"
                          )}
                          style={{ aspectRatio: s.ratio }}
                        />
                        <span className="text-left leading-tight">
                          <span className="block text-xs font-medium">{s.label}</span>
                          <span className="block font-mono text-[10px] opacity-70">
                            {s.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <PromptOptimizer
                  prompt={prompt}
                  mode="image"
                  disabled={submitting}
                  showLabel
                  onApply={setPrompt}
                />
                <Button
                  className="gap-2 sm:ml-auto sm:w-auto"
                  disabled={!prompt.trim() || submitting}
                  onClick={generate}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Queuing…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4" /> Generate image
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Gallery
            </h2>
            {images && (
              <span className="font-mono text-xs text-muted-foreground">
                {doneCount} image{doneCount === 1 ? "" : "s"}
                {(images.length ?? 0) > doneCount
                  ? ` · ${images.length - doneCount} painting…`
                  : ""}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          ) : !images || images.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/70 bg-secondary/20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary/60">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Your gallery is empty
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Write a prompt above and hit Generate — every image is saved to
                the database.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img) => {
                const processing = img.status === "processing";
                const failed = img.status === "failed";
                return (
                  <figure
                    key={img.id}
                    className="group relative overflow-hidden rounded-lg border border-border/70 bg-secondary/20"
                  >
                    {processing ? (
                      /* In-progress placeholder — flips to the real image via polling. */
                      <div
                        className="flex w-full flex-col items-center justify-center gap-2 bg-primary/5 text-primary"
                        style={{ aspectRatio: aspectRatioOf(img.size) }}
                      >
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="px-3 text-center text-[10px] font-medium leading-snug">
                          The diffusion model is painting…
                        </p>
                        <p className="line-clamp-2 max-w-[90%] text-center text-[9px] leading-snug text-muted-foreground">
                          {img.prompt}
                        </p>
                      </div>
                    ) : failed ? (
                      /* Failed job — show the reason instead of a broken image. */
                      <div
                        className="flex w-full flex-col items-center justify-center gap-2 bg-destructive/10 text-destructive"
                        style={{ aspectRatio: aspectRatioOf(img.size) }}
                      >
                        <AlertTriangle className="h-6 w-6" />
                        <p className="px-3 text-center text-[10px] font-medium leading-snug">
                          Generation failed
                        </p>
                        <p className="line-clamp-4 max-w-[92%] text-center text-[9px] leading-snug text-muted-foreground">
                          {img.errorMessage ?? "Unknown error"}
                        </p>
                      </div>
                    ) : (
                      <>
                        <img
                          src={img.url ?? undefined}
                          alt={img.prompt}
                          loading="lazy"
                          className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          style={{ aspectRatio: aspectRatioOf(img.size) }}
                        />
                        <div className="pointer-events-none absolute inset-0 flex flex-col bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                          <p className="mt-auto line-clamp-3 text-[10px] leading-snug text-white/90">
                            {img.prompt}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="font-mono text-[9px] text-white/60">
                              {img.size} · {format(new Date(img.createdAt), "MMM d, HH:mm")}
                            </span>
                            <span className="flex gap-1">
                              <a
                                href={img.url ?? undefined}
                                download={`nexus-${img.id}.png`}
                                aria-label="Download image"
                                className="rounded bg-white/15 p-1 text-white transition-colors hover:bg-white/30"
                              >
                                <Download className="h-3 w-3" />
                              </a>
                              <button
                                onClick={(e) => deleteImage(e, img.id)}
                                aria-label="Delete image"
                                className="rounded bg-white/15 p-1 text-white transition-colors hover:bg-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {(processing || failed) && (
                      <button
                        onClick={(e) => deleteImage(e, img.id)}
                        aria-label="Delete image"
                        className="absolute right-1.5 top-1.5 rounded bg-background/70 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </figure>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
