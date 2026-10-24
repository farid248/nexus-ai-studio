import { create } from "zustand";
import type { StudioView } from "./types";

interface StudioState {
  view: StudioView;
  conversationId: string | null;
  setView: (view: StudioView) => void;
  setConversationId: (id: string | null) => void;
  openConversation: (id: string) => void;
  closeConversation: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  view: "dashboard",
  conversationId: null,
  setView: (view) => set({ view }),
  setConversationId: (id) => set({ conversationId: id }),
  openConversation: (id) => set({ view: "chat", conversationId: id }),
  closeConversation: () => set({ conversationId: null }),
}));
