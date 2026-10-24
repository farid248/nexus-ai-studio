// Shared API contracts between the studio frontend and /api routes

export type StudioView = "dashboard" | "chat" | "memory" | "vision" | "images" | "speech";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface MemoryDTO {
  id: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  source: "auto" | "manual";
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedImageDTO {
  id: string;
  prompt: string;
  size: string;
  url: string | null;
  /** processing | done | failed — jobs poll until done/failed. */
  status?: string;
  /** Human-readable failure reason when status === "failed". */
  errorMessage?: string | null;
  createdAt: string;
  /** POST response only: set when the API auto-translated a non-English prompt. */
  translatedPrompt?: string | null;
}

export interface TranscriptionDTO {
  id: string;
  fileName: string;
  text: string;
  duration: number | null;
  createdAt: string;
}

export interface PromptOptimizationDTO {
  id: string;
  originalPrompt: string;
  optimizedPrompt: string;
  mode: "chat" | "image" | "vision";
  improvements: string[];
  summary: string;
}

export interface StatsDTO {
  conversations: number;
  messages: number;
  images: number;
  transcriptions: number;
  memories: number;
  optimizations: number;
  optimizationsApplied: number;
  recentImages: GeneratedImageDTO[];
}

export const MEMORY_CATEGORY_META: Record<
  string,
  { label: string; className: string }
> = {
  personal: {
    label: "Personal",
    className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  preference: {
    label: "Preference",
    className: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  goal: {
    label: "Goal",
    className: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  skill: {
    label: "Skill",
    className: "bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/30",
  },
  project: {
    label: "Project",
    className: "bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/30",
  },
  fact: {
    label: "Fact",
    className: "bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};

export const IMAGE_SIZES = [
  { value: "1024x1024", label: "Square", hint: "1024 × 1024", ratio: "1 / 1" },
  { value: "1152x864", label: "Landscape", hint: "1152 × 864", ratio: "4 / 3" },
  { value: "1344x768", label: "Wide", hint: "1344 × 768", ratio: "16 / 9" },
  { value: "864x1152", label: "Portrait", hint: "864 × 1152", ratio: "3 / 4" },
  { value: "768x1344", label: "Tall", hint: "768 × 1344", ratio: "9 / 16" },
] as const;

export type ImageSizeValue = (typeof IMAGE_SIZES)[number]["value"];

export const TTS_VOICES = [
  { value: "tongtong", label: "Tongtong", hint: "Warm & friendly" },
  { value: "chuichui", label: "Chuichui", hint: "Lively & cute" },
  { value: "xiaochen", label: "Xiaochen", hint: "Calm & professional" },
  { value: "jam", label: "Jam", hint: "British gentleman" },
  { value: "kazi", label: "Kazi", hint: "Clear & standard" },
  { value: "douji", label: "Douji", hint: "Natural flow" },
  { value: "luodo", label: "Luodo", hint: "Expressive" },
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number]["value"];

export const TTS_MAX_CHARS = 1024;
