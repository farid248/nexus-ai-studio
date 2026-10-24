"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStudioStore } from "@/lib/studio-store";
import { StudioSidebar, NAV_ITEMS } from "./sidebar";
import { DashboardView } from "./views/dashboard-view";
import { ChatView } from "./views/chat-view";
import { MemoryView } from "./views/memory-view";
import { VisionView } from "./views/vision-view";
import { ImageStudioView } from "./views/image-studio-view";
import { SpeechView } from "./views/speech-view";
import { cn } from "@/lib/utils";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 text-muted-foreground hover:text-foreground"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

function Header() {
  return (
    <header className="flex-none border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Nexus AI</span>
            <Badge
              variant="outline"
              className="hidden font-mono text-[10px] uppercase tracking-widest text-primary sm:inline-flex"
            >
              studio
            </Badge>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs text-muted-foreground">
              6 AI modules online
            </span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const view = useStudioStore((s) => s.view);
  const setView = useStudioStore((s) => s.setView);

  return (
    <nav
      aria-label="Module navigation"
      className="flex-none border-b border-border/70 md:hidden"
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="flex-none border-t border-border/70 bg-background/80 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 sm:px-6">
        <p className="text-[11px] text-muted-foreground">
          Nexus AI Studio — Multimodal AI Platform
        </p>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/80">
          <span className="rounded border border-border/60 px-1.5 py-0.5">Next.js 16</span>
          <span className="rounded border border-border/60 px-1.5 py-0.5">React 19</span>
          <span className="hidden rounded border border-border/60 px-1.5 py-0.5 sm:inline">Prisma</span>
          <span className="hidden rounded border border-border/60 px-1.5 py-0.5 sm:inline">Z-AI SDK</span>
        </div>
      </div>
    </footer>
  );
}

function StudioShell() {
  const view = useStudioStore((s) => s.view);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <MobileNav />
      <div className="flex min-h-0 flex-1">
        <StudioSidebar />
        <main className="min-h-0 flex-1 overflow-hidden">
          {view === "dashboard" && <DashboardView />}
          {view === "chat" && <ChatView />}
          {view === "memory" && <MemoryView />}
          {view === "vision" && <VisionView />}
          {view === "images" && <ImageStudioView />}
          {view === "speech" && <SpeechView />}
        </main>
      </div>
      <Footer />
    </div>
  );
}

export function AiStudio() {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StudioShell />
    </QueryClientProvider>
  );
}
