"use client";

import * as React from "react";
import {
  AudioLines,
  Brain,
  ImagePlus,
  LayoutDashboard,
  MessageSquareText,
  ScanEye,
  type LucideIcon,
} from "lucide-react";
import { useStudioStore } from "@/lib/studio-store";
import type { StudioView } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NavItem {
  id: StudioView;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & stats" },
  { id: "chat", label: "AI Chat", icon: MessageSquareText, hint: "Streaming LLM" },
  { id: "memory", label: "Agent Memory", icon: Brain, hint: "Long-term recall" },
  { id: "vision", label: "Vision", icon: ScanEye, hint: "Image understanding" },
  { id: "images", label: "Image Studio", icon: ImagePlus, hint: "Text → image" },
  { id: "speech", label: "Speech Lab", icon: AudioLines, hint: "STT & TTS" },
];

export function StudioSidebar() {
  const view = useStudioStore((s) => s.view);
  const setView = useStudioStore((s) => s.setView);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-sidebar/50 md:flex">
      <nav aria-label="Modules" className="flex flex-col gap-1 p-3">
        <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          AI Modules
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all",
                active
                  ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_var(--primary)/25]"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{item.label}</span>
                <span className="text-[10px] text-muted-foreground/70 leading-tight">
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-lg border border-border/70 bg-secondary/30 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Runtime
          </p>
          <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
            <li className="flex items-center justify-between">
              <span>LLM</span>
              <span className="font-mono text-primary">glm-4.6</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Memory</span>
              <span className="font-mono text-primary">Auto + Manual</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Vision</span>
              <span className="font-mono text-primary">VLM</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Speech</span>
              <span className="font-mono text-primary">ASR · TTS</span>
            </li>
            <li className="flex items-center justify-between">
              <span>DB</span>
              <span className="font-mono text-primary">SQLite</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
