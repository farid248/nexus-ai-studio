"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Brain,
  CheckCircle2,
  Cpu,
  Database,
  FileAudio,
  ImagePlus,
  ImageIcon,
  MessagesSquare,
  MessageSquareText,
  ScanEye,
  Server,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioStore } from "@/lib/studio-store";
import type { StatsDTO } from "@/lib/types";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="font-mono text-2xl font-semibold tabular-nums leading-none">
              {value ?? 0}
            </p>
          )}
          <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const MODULES = [
  {
    view: "chat" as const,
    icon: MessageSquareText,
    title: "AI Chat",
    desc: "Streaming conversations with markdown, code blocks, persistent history and a prompt optimizer built into the composer.",
    tag: "LLM · SSE",
  },
  {
    view: "memory" as const,
    icon: Brain,
    title: "Agent Memory",
    desc: "Long-term memory: facts about you are auto-extracted after every exchange and injected into every future chat.",
    tag: "Auto-extract",
  },
  {
    view: "vision" as const,
    icon: ScanEye,
    title: "Vision Analysis",
    desc: "Upload any image and ask questions about it — OCR, objects, scenes.",
    tag: "VLM",
  },
  {
    view: "images" as const,
    icon: ImagePlus,
    title: "Image Studio",
    desc: "Generate images from text prompts in 5 aspect ratios, saved to a gallery.",
    tag: "Diffusion",
  },
  {
    view: "speech" as const,
    icon: AudioLines,
    title: "Speech Lab",
    desc: "Transcribe audio to text and turn text into natural speech.",
    tag: "ASR · TTS",
  },
];

export function DashboardView() {
  const setView = useStudioStore((s) => s.setView);
  const { data: stats, isLoading } = useQuery<StatsDTO>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <motion.section {...fadeUp} transition={{ duration: 0.4 }} className="relative">
          <div
            aria-hidden
            className="hero-glow pointer-events-none absolute -top-10 left-1/2 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Multimodal AI Platform
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              One platform.{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-400 bg-clip-text text-transparent">
                Every AI modality.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              A production-grade studio that wires LLM chat, vision understanding,
              image generation and speech into one full-stack TypeScript app —
              with real streaming, persistence and typed contracts.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2" onClick={() => setView("chat")}>
                <MessageSquareText className="h-4 w-4" />
                Start chatting
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={() => setView("images")}>
                <ImagePlus className="h-4 w-4" />
                Generate images
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="mt-10"
          aria-label="Usage statistics"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Live usage
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Conversations" value={stats?.conversations} icon={MessagesSquare} loading={isLoading} />
            <StatCard label="Messages exchanged" value={stats?.messages} icon={MessageSquareText} loading={isLoading} />
            <StatCard label="Memories stored" value={stats?.memories} icon={Brain} loading={isLoading} />
            <StatCard label="Images generated" value={stats?.images} icon={ImageIcon} loading={isLoading} />
            <StatCard label="Transcriptions" value={stats?.transcriptions} icon={FileAudio} loading={isLoading} />
            <StatCard label="Prompts optimized" value={stats?.optimizations} icon={WandSparkles} loading={isLoading} />
          </div>
        </motion.section>

        {/* Recent generations */}
        {stats && stats.recentImages.length > 0 && (
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-8"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Recent generations
              </h2>
              <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => setView("images")}>
                View gallery <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stats.recentImages.slice(0, 6).map((img) => (
                <div
                  key={img.id}
                  className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border/70"
                >
                  <img
                    src={img.url ?? undefined}
                    alt={img.prompt}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Modules */}
        <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.16 }} className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            AI modules
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Card
                  key={mod.title}
                  role="button"
                  tabIndex={0}
                  onClick={() => setView(mod.view)}
                  onKeyDown={(e) => e.key === "Enter" && setView(mod.view)}
                  className="group cursor-pointer border-border/70 bg-card/60 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium">{mod.title}</h3>
                        <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {mod.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {mod.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.section>

        {/* Architecture */}
        <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.2 }} className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            System architecture
          </h2>
          <Card className="border-border/70 bg-card/60">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex-1 rounded-lg border border-border/70 bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Server className="h-4 w-4 text-primary" /> Client
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    React 19 · Tailwind 4 · shadcn/ui · TanStack Query · Zustand
                  </p>
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-primary lg:block" />
                <ArrowDown className="h-4 w-4 shrink-0 self-center text-primary lg:hidden" />
                <div className="flex-1 rounded-lg border border-border/70 bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4 text-primary" /> Next.js API Routes
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SSE streaming · REST · multipart uploads · typed contracts
                  </p>
                </div>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-primary lg:block" />
                <ArrowDown className="h-4 w-4 shrink-0 self-center text-primary lg:hidden" />
                <div className="flex-1 rounded-lg border border-border/70 bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Cpu className="h-4 w-4 text-primary" /> Z-AI SDK
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    LLM · VLM · Diffusion · ASR · TTS
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-3">
                <ArrowDown className="hidden h-4 w-4 shrink-0 self-center text-primary lg:hidden" />
                <div className="flex-1 rounded-lg border border-dashed border-border/70 bg-transparent p-4 lg:ml-[calc(33.333%)]">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Database className="h-4 w-4 text-primary" /> Prisma ORM → SQLite
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conversations, messages, memories, images and transcripts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Engineering highlights */}
        <motion.section {...fadeUp} transition={{ duration: 0.4, delay: 0.24 }} className="mt-8 pb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Engineering highlights
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Real-time SSE token streaming with server-side accumulation",
              "Self-updating long-term memory: auto-extraction, dedup and rolling summaries",
              "Prompt Optimizer: LLM meta-prompting rewrites any prompt before execution, with per-mode strategies",
              "Server-only SDK isolation — zero credentials in the client bundle",
              "Full persistence: history, memories, prompts and transcripts in SQLite",
              "End-to-end TypeScript types shared between API and UI",
              "Safety-filter resilience: flagged image prompts are auto-rewritten and retried",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-lg border border-border/70 bg-card/40 p-3 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
