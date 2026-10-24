"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  CheckCircle2,
  Loader2,
  Quote,
  Sparkles,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { PromptOptimizationDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export type OptimizerMode = "chat" | "image" | "vision";

interface PromptOptimizerProps {
  /** Current draft prompt (read-only — the host decides what to do on apply). */
  prompt: string;
  mode: OptimizerMode;
  /** Recent chat context id — lets the optimizer resolve vague references. */
  conversationId?: string | null;
  /** Disable the trigger (e.g. while the host is busy streaming). */
  disabled?: boolean;
  /** Show a labelled outline button instead of the compact icon button. */
  showLabel?: boolean;
  /** Called with the optimized prompt when the user accepts it. */
  onApply: (optimized: string) => void;
}

const MODE_META: Record<OptimizerMode, { label: string; hint: string }> = {
  chat: {
    label: "Chat",
    hint: "Adds role, context, constraints and output format",
  },
  image: {
    label: "Image",
    hint: "Adds style, lighting, composition and visual detail",
  },
  vision: {
    label: "Vision",
    hint: "Focuses the analysis and structures the answer",
  },
};

/**
 * Prompt Optimizer — a pre-execution review pass for any prompt.
 *
 * The wand button sends the current draft to /api/optimize-prompt, which
 * runs an LLM meta-prompting pass and returns a stronger version plus a
 * breakdown of what was improved. The user compares both side by side and
 * decides: apply the optimized version or keep the original.
 */
export function PromptOptimizer({
  prompt,
  mode,
  conversationId,
  disabled,
  showLabel,
  onApply,
}: PromptOptimizerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PromptOptimizationDTO | null>(null);

  const canOptimize = prompt.trim().length > 0 && !disabled;

  const runOptimization = React.useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, mode, conversationId: conversationId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Optimization failed");
      setResult({
        id: data.id,
        originalPrompt: text,
        optimizedPrompt: data.optimizedPrompt,
        mode,
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        summary: typeof data.summary === "string" ? data.summary : "",
      });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, conversationId]);

  const openDialog = () => {
    setOpen(true);
    if (!result || result.originalPrompt !== prompt.trim()) {
      setResult(null);
      setError(null);
      void runOptimization();
    }
  };

  const applyOptimized = () => {
    if (!result) return;
    onApply(result.optimizedPrompt);
    // Mark this optimization as applied for the dashboard analytics
    if (result.id) {
      void fetch(`/api/optimize-prompt?id=${encodeURIComponent(result.id)}`, {
        method: "PATCH",
      }).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
    toast({
      title: "Optimized prompt applied",
      description: "Review it in the composer and run it whenever you're ready.",
    });
    setOpen(false);
  };

  return (
    <>
      {showLabel ? (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!canOptimize}
          onClick={openDialog}
          title="Optimize this prompt before running it"
        >
          <WandSparkles className="h-4 w-4 text-primary" />
          Optimize prompt
        </Button>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-primary/80 hover:text-primary"
          disabled={!canOptimize}
          onClick={openDialog}
          aria-label="Optimize prompt before sending"
          title="Optimize prompt before sending"
        >
          <WandSparkles className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <WandSparkles className="h-4 w-4" />
              </span>
              Prompt Optimizer
              <span className="rounded border border-primary/30 bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] font-normal text-primary">
                {MODE_META[mode].label}
              </span>
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              A meta-prompting pass reviews your draft before execution —{" "}
              {MODE_META[mode].hint.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing your prompt…</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  The optimization engine is rewriting your draft with role, context and
                  output structure.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/12 text-destructive">
                  <XCircle className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium">Optimization failed</p>
                <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={runOptimization}>
                  <Sparkles className="h-3.5 w-3.5" /> Try again
                </Button>
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Original */}
                <div className="rounded-lg border border-border/70 bg-secondary/30 p-3.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Your prompt
                  </p>
                  <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {result.originalPrompt}
                  </p>
                </div>

                <div className="flex justify-center" aria-hidden>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-secondary/40 text-primary">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </span>
                </div>

                {/* Optimized */}
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                    <WandSparkles className="h-3 w-3" /> Optimized prompt
                  </p>
                  <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                    {result.optimizedPrompt}
                  </p>
                </div>

                {/* Improvements */}
                {result.improvements.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      What was improved
                    </p>
                    <ul className="space-y-1.5">
                      {result.improvements.map((note, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-lg border border-border/70 bg-card/40 p-2.5 text-xs leading-relaxed text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                {result.summary && (
                  <p
                    className={cn(
                      "flex items-start gap-2 rounded-lg bg-secondary/30 p-3",
                      "text-xs italic leading-relaxed text-muted-foreground"
                    )}
                  >
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                    {result.summary}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                Preparing the optimization…
              </div>
            )}
          </div>

          {result && !loading && (
            <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep original
              </Button>
              <Button className="gap-2" onClick={applyOptimized}>
                <WandSparkles className="h-4 w-4" />
                Use optimized prompt
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
