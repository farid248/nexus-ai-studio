"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Brain,
  Check,
  Eraser,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MEMORY_CATEGORY_META, type MemoryDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = Object.keys(MEMORY_CATEGORY_META);

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function ImportanceDots({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  const editable = !!onChange;
  return (
    <div className="flex items-center gap-1" aria-label={`Importance ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <button
          key={dot}
          type="button"
          disabled={!editable}
          aria-label={editable ? `Set importance ${dot}` : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(dot);
          }}
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-all",
            dot <= value ? "bg-primary" : "bg-border",
            editable && "h-2 w-2 hover:scale-125 cursor-pointer"
          )}
        />
      ))}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Memory editor dialog (add + edit)                                   */
/* ------------------------------------------------------------------ */

interface MemoryFormState {
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
}

const EMPTY_FORM: MemoryFormState = {
  content: "",
  category: "personal",
  importance: 3,
  pinned: false,
};

function MemoryDialog({
  open,
  onOpenChange,
  initial,
  title,
  description,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: MemoryFormState;
  title: string;
  description: string;
  onSubmit: (state: MemoryFormState) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = React.useState<MemoryFormState>(initial);

  React.useEffect(() => {
    if (open) setForm(initial);
  }, [open]);

  const valid = form.content.trim().length >= 4 && form.content.trim().length <= 300;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label htmlFor="memory-content" className="text-xs font-medium">
              Memory
            </label>
            <textarea
              id="memory-content"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={3}
              placeholder="e.g. The user is an AI engineer from Cairo who loves TypeScript."
              className="w-full resize-none rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
            <p className="text-right font-mono text-[10px] text-muted-foreground/70">
              {form.content.trim().length}/300
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Category</label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {MEMORY_CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Importance</label>
              <div className="flex h-9 items-center rounded-md border border-border/70 bg-secondary/30 px-3">
                <ImportanceDots
                  value={form.importance}
                  onChange={(v) => setForm((f) => ({ ...f, importance: v }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">Pin to top</p>
              <p className="text-[10px] text-muted-foreground">
                Always injected first into every chat
              </p>
            </div>
            <Switch
              checked={form.pinned}
              onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
              aria-label="Pin memory"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || submitting} onClick={() => onSubmit(form)}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save memory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Memory card                                                         */
/* ------------------------------------------------------------------ */

function MemoryCard({
  memory,
  onEdit,
}: {
  memory: MemoryDTO;
  onEdit: (m: MemoryDTO) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const meta = MEMORY_CATEGORY_META[memory.category] ?? MEMORY_CATEGORY_META.fact;

  const patch = async (data: Record<string, unknown>, successTitle: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memory.id, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Update failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast({ title: successTitle });
    } catch (err) {
      toast({
        title: "Memory update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/memories?id=${memory.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Delete failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast({ title: "Memory forgotten" });
    } catch (err) {
      toast({
        title: "Could not delete memory",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={cn(
        "group border-border/70 bg-card/60 transition-all hover:border-primary/40",
        memory.pinned && "border-primary/40 bg-primary/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", meta.className)}>
              {meta.label}
            </Badge>
            <span
              className="flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground"
              title={memory.source === "auto" ? "Extracted automatically from chat" : "Added manually"}
            >
              {memory.source === "auto" ? (
                <Sparkles className="h-2.5 w-2.5" />
              ) : (
                <User className="h-2.5 w-2.5" />
              )}
              {memory.source}
            </span>
            {memory.pinned && <Pin className="h-3 w-3 fill-primary text-primary" />}
          </div>
          <ImportanceDots value={memory.importance} />
        </div>

        <p className="mt-2.5 text-sm leading-relaxed">{memory.content}</p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <p className="truncate font-mono text-[10px] text-muted-foreground/70">
            used {memory.useCount}×
            {memory.lastUsedAt && ` · ${format(new Date(memory.lastUsedAt), "MMM d, HH:mm")}`}
          </p>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
              disabled={busy}
              onClick={() => patch({ pinned: !memory.pinned }, memory.pinned ? "Unpinned" : "Pinned to top")}
            >
              <Pin className={cn("h-3.5 w-3.5", memory.pinned && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Edit memory"
              disabled={busy}
              onClick={() => onEdit(memory)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label="Delete memory"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Memory view                                                         */
/* ------------------------------------------------------------------ */

export function MemoryView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<MemoryDTO | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const { data: memories, isLoading } = useQuery<MemoryDTO[]>({
    queryKey: ["memories"],
    queryFn: async () => {
      const res = await fetch("/api/memories");
      if (!res.ok) throw new Error("Failed to load memories");
      return res.json();
    },
    staleTime: 5_000,
  });

  const stats = React.useMemo(() => {
    const list = memories ?? [];
    return {
      total: list.length,
      auto: list.filter((m) => m.source === "auto").length,
      manual: list.filter((m) => m.source === "manual").length,
      pinned: list.filter((m) => m.pinned).length,
    };
  }, [memories]);

  const filtered = React.useMemo(() => {
    let list = memories ?? [];
    if (categoryFilter !== "all") {
      list = list.filter((m) => m.category === categoryFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => m.content.toLowerCase().includes(q));
    }
    return list;
  }, [memories, categoryFilter, search]);

  const addMemory = async (form: MemoryFormState) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: form.content.trim(),
          category: form.category,
          importance: form.importance,
          pinned: form.pinned,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add memory");
      }
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      setAddOpen(false);
      toast({ title: "Memory saved", description: "The agent will remember this from now on." });
    } catch (err) {
      toast({
        title: "Could not save memory",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const editMemory = async (form: MemoryFormState) => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          content: form.content.trim(),
          category: form.category,
          importance: form.importance,
          pinned: form.pinned,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update memory");
      }
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      setEditTarget(null);
      toast({ title: "Memory updated" });
    } catch (err) {
      toast({
        title: "Could not update memory",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearAll = async () => {
    try {
      const res = await fetch("/api/memories?all=true", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to clear memories");
      }
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["memories"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "Memory cleared", description: `${data.deleted} memories forgotten.` });
    } catch (err) {
      toast({
        title: "Could not clear memory",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <motion.div {...fadeUp} transition={{ duration: 0.35 }}>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">Agent Memory</h1>
              <p className="text-xs text-muted-foreground">
                Long-term memory — the agent remembers you across every conversation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add memory
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={!memories || memories.length === 0}
                  >
                    <Eraser className="h-4 w-4" /> Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Forget everything?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all {stats.total} memories. The agent will
                      no longer remember anything about you in future chats.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep memories</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={clearAll}
                    >
                      Forget everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total memories" value={stats.total} icon={Brain} />
            <MiniStat label="Auto-extracted" value={stats.auto} icon={Sparkles} />
            <MiniStat label="Added manually" value={stats.manual} icon={User} />
            <MiniStat label="Pinned" value={stats.pinned} icon={Pin} />
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.08 }} className="mt-4">
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">How it works: </span>
            after every chat exchange, an extraction pipeline distills new durable facts
            about you into this store (deduplicated automatically). Everything here is
            injected into the system prompt of <span className="text-primary">every</span>{" "}
            conversation, and long chats get a rolling summary so focus never fades.
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.11 }} className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories…"
                aria-label="Search memories"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["all", ...CATEGORIES].map((c) => {
                const active = categoryFilter === c;
                const label =
                  c === "all" ? "All" : MEMORY_CATEGORY_META[c].label;
                return (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/70 bg-secondary/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* List */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.14 }} className="mt-4 pb-4">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/70 bg-secondary/20 px-6 py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary/60">
                <Brain className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {memories && memories.length > 0
                  ? "No memories match your filters"
                  : "The agent doesn't know you yet"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
                {memories && memories.length > 0
                  ? "Try a different search term or category."
                  : "Chat with Nexus and it will automatically remember durable facts about you — your name, goals, skills and preferences. You can also add memories manually."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} onEdit={setEditTarget} />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Add / edit dialogs */}
      <MemoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        initial={EMPTY_FORM}
        title="Add a memory"
        description="Teach the agent something about you — it will be remembered in every future conversation."
        onSubmit={addMemory}
        submitting={submitting}
      />
      <MemoryDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        initial={
          editTarget
            ? {
                content: editTarget.content,
                category: editTarget.category,
                importance: editTarget.importance,
                pinned: editTarget.pinned,
              }
            : EMPTY_FORM
        }
        title="Edit memory"
        description="Correct or refine what the agent remembers."
        onSubmit={editMemory}
        submitting={submitting}
      />
    </div>
  );
}
