"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Brain,
  Check,
  Code2,
  Copy,
  History,
  Lightbulb,
  MessageSquareText,
  Mic,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useStudioStore } from "@/lib/studio-store";
import type { ChatMessageDTO, ConversationSummary, MemoryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Markdown } from "../markdown";
import { PromptOptimizer } from "../prompt-optimizer";

const SUGGESTIONS = [
  {
    icon: Brain,
    text: "Remember that I'm an AI engineer from Cairo who loves TypeScript",
  },
  {
    icon: Lightbulb,
    text: "What do you remember about me so far?",
  },
  {
    icon: Code2,
    text: "Write a TypeScript debounce hook with generics and full types",
  },
  {
    icon: Zap,
    text: "Give me 5 impressive project ideas for an AI engineer portfolio",
  },
];

/* ------------------------------------------------------------------ */
/* Conversation list (shared between desktop aside and mobile sheet)   */
/* ------------------------------------------------------------------ */

function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const closeConversation = useStudioStore((s) => s.closeConversation);

  const { data: conversations, isLoading } = useQuery<ConversationSummary[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
  });

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      if (activeId === id) closeConversation();
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "Conversation deleted" });
    } catch (err) {
      toast({
        title: "Could not delete conversation",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-border/70 p-3">
        <Button
          className="w-full gap-2"
          variant="outline"
          onClick={() => {
            closeConversation();
            onSelect("");
          }}
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          History
        </p>
        {isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet.
            <br />
            Your history persists in SQLite.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(conv.id)}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(conv.id)}
                  className={cn(
                    "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                    activeId === conv.id
                      ? "bg-primary/12 text-primary"
                      : "text-foreground/80 hover:bg-secondary/70"
                  )}
                >
                  <MessageSquareText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium leading-tight">
                      {conv.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {conv.messageCount} msg · {format(new Date(conv.updatedAt), "MMM d")}
                    </p>
                  </div>
                  <button
                    aria-label={`Delete ${conv.title}`}
                    onClick={(e) => deleteConversation(e, conv.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Message bubbles                                                     */
/* ------------------------------------------------------------------ */

function MessageRow({ message }: { message: ChatMessageDTO }) {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div className={cn("group max-w-[85%] sm:max-w-[75%]")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md border border-border/70 bg-secondary/50"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">
              {message.content}
            </p>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <span>{format(new Date(message.createdAt), "HH:mm")}</span>
          {!isUser && (
            <button
              onClick={copy}
              aria-label="Copy message"
              className="rounded p-0.5 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
      {isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/60 text-muted-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex w-full gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border/70 bg-secondary/50 px-4 py-3">
        <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
        <span className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat view                                                           */
/* ------------------------------------------------------------------ */

export function ChatView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const conversationId = useStudioStore((s) => s.conversationId);
  const setConversationId = useStudioStore((s) => s.setConversationId);
  const closeConversation = useStudioStore((s) => s.closeConversation);

  const [input, setInput] = React.useState("");
  const [localMessages, setLocalMessages] = React.useState<ChatMessageDTO[]>([]);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [showMobileList, setShowMobileList] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickToBottom = React.useRef(true);

  const { data: serverMessages, isLoading: messagesLoading } = useQuery<ChatMessageDTO[]>({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  const { data: conversations } = useQuery<ConversationSummary[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
  });

  const { data: memories } = useQuery<MemoryDTO[]>({
    queryKey: ["memories"],
    queryFn: async () => {
      const res = await fetch("/api/memories");
      if (!res.ok) throw new Error("Failed to load memories");
      return res.json();
    },
    staleTime: 5_000,
  });
  const memoryCount = memories?.length ?? 0;
  const setView = useStudioStore((s) => s.setView);

  const activeTitle =
    conversations?.find((c) => c.id === conversationId)?.title ?? "New conversation";

  // Sync server messages into local state (optimistic updates live on top)
  React.useEffect(() => {
    setLocalMessages(serverMessages ?? []);
  }, [serverMessages]);

  // Reset streaming state when switching conversations
  React.useEffect(() => {
    setStreamingContent("");
    stickToBottom.current = true;
  }, [conversationId]);

  // Auto scroll while streaming / on new messages
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [localMessages, streamingContent, isStreaming]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  /* ---------------- Voice input (mic → ASR → composer) ---------------- */

  const transcribeBlob = React.useCallback(
    async (blob: Blob) => {
      try {
        const fd = new FormData();
        fd.append("file", blob, "voice-input.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.text) {
          setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          requestAnimationFrame(resizeTextarea);
          if (data.qualityWarning) {
            // Arabic speech isn't supported by the ASR engine — the text that
            // landed in the composer is likely inaccurate. Tell the user why.
            toast({
              title: "Arabic voice input isn’t supported",
              description:
                "The ASR engine is optimized for English & Chinese — the transcribed text is probably inaccurate. Please type your message instead.",
            });
          }
        } else {
          throw new Error(data.error ?? "Transcription failed");
        }
      } catch (err) {
        toast({
          title: "Voice input failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const {
    isRecording,
    seconds: recordSeconds,
    start: startRecording,
    stop: stopRecording,
  } = useVoiceRecorder(transcribeBlob);

  /* ---------------- Streaming send ---------------- */

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");
    requestAnimationFrame(resizeTextarea);
    stickToBottom.current = true;

    const optimisticUser: ChatMessageDTO = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticUser]);
    setIsStreaming(true);
    setStreamingContent("");

    // Tracks the real conversation id for THIS send — it may change mid-flight
    // when the server creates a new conversation (X-Conversation-Id header).
    // Capturing it locally avoids a stale `conversationId` closure in finally.
    let activeConvId = conversationId;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Chat request failed");
      }

      // Adopt the (possibly new) conversation id from the response header
      const headerId = res.headers.get("X-Conversation-Id");
      if (headerId && headerId !== conversationId) {
        setConversationId(headerId);
        activeConvId = headerId;
      }

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta: string | undefined = json.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setStreamingContent(full);
            }
          } catch {
            // ignore malformed keep-alive chunks
          }
        }
      }
    } catch (err) {
      toast({
        title: "Chat error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      await queryClient.invalidateQueries({ queryKey: ["messages", activeConvId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      // Background memory extraction finishes a few seconds after the reply —
      // refresh the memory list once more to catch the new facts.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["memories"] });
      }, 6_000);
    }
  };

  const showEmptyState = !conversationId && localMessages.length === 0;

  return (
    <div className="relative flex h-full min-h-0">
      {/* Desktop conversation panel */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar/30 md:flex">
        <ConversationList
          activeId={conversationId}
          onSelect={(id) => setConversationId(id || null)}
        />
      </aside>

      {/* Mobile conversation drawer */}
      <Sheet open={showMobileList} onOpenChange={setShowMobileList}>
        <SheetContent side="left" className="w-72 border-r border-border/70 bg-background p-0">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <ConversationList
            activeId={conversationId}
            onSelect={(id) => {
              setConversationId(id || null);
              setShowMobileList(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <div className="flex-none border-b border-border/70 bg-background/70 backdrop-blur">
          <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Conversation history"
              className="h-8 w-8 md:hidden"
              onClick={() => setShowMobileList(true)}
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{activeTitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setView("memory")}
                title="Open Agent Memory"
                aria-label={`${memoryCount} active memories — open Agent Memory`}
                className={cn(
                  "flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                  memoryCount > 0
                    ? "border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
                    : "border-border/70 text-muted-foreground/70 hover:text-foreground"
                )}
              >
                <Brain className="h-3 w-3" />
                {memoryCount}
              </button>
              <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                glm-4.6
              </span>
              <span className="rounded border border-primary/30 bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                SSE
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {showEmptyState ? (
              <div className="flex flex-col items-center py-10 text-center sm:py-16">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-semibold">How can I help you today?</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Streaming answers with markdown &amp; code — and a persistent
                  memory that remembers you across every conversation.
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.text}
                        onClick={() => sendMessage(s.text)}
                        className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card/50 p-3.5 text-left text-sm transition-all hover:border-primary/40 hover:bg-primary/5"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground group-hover:text-foreground">
                          {s.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : messagesLoading && localMessages.length === 0 ? (
              <div className="space-y-5">
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="ml-auto h-10 w-1/3" />
                <Skeleton className="h-24 w-3/4" />
              </div>
            ) : (
              <>
                {localMessages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
                {isStreaming &&
                  (streamingContent ? (
                    <div className="flex w-full gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/70 bg-secondary/50 px-4 py-2.5 sm:max-w-[75%]">
                        <div className="streaming-cursor">
                          <Markdown content={streamingContent} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ThinkingIndicator />
                  ))}
              </>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="flex-none border-t border-border/70 bg-background/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-secondary/40 p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeTextarea();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder={
                  isRecording ? "Listening…" : "Ask anything — Enter to send, Shift+Enter for a new line"
                }
                aria-label="Chat message"
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <Button
                type="button"
                size="icon"
                variant={isRecording ? "destructive" : "ghost"}
                aria-label={isRecording ? "Stop recording" : "Record voice message"}
                onClick={isRecording ? stopRecording : startRecording}
                className="h-9 w-9 shrink-0"
              >
                {isRecording ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    <span className="font-mono text-[10px]">{recordSeconds}s</span>
                  </span>
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <PromptOptimizer
                prompt={input}
                mode="chat"
                conversationId={conversationId}
                disabled={isStreaming}
                onApply={(optimized) => {
                  setInput(optimized);
                  requestAnimationFrame(resizeTextarea);
                  textareaRef.current?.focus();
                }}
              />
              <Button
                type="button"
                size="icon"
                aria-label="Send message"
                disabled={!input.trim() || isStreaming}
                onClick={() => sendMessage()}
                className="h-9 w-9 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
              Token streaming over SSE · persistent memory · click the wand to optimize a prompt before sending
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
