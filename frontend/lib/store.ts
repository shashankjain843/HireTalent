import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  CandidateCardPayload,
  ChatMessage,
  ConversationStage,
} from "./types";

interface ChatStore {
  conversationId: string | null;
  stage: ConversationStage;
  messages: ChatMessage[];
  shortlist: CandidateCardPayload[];
  loading: boolean;
  currentCandidateIndex: number;

  setConversationId: (id: string) => void;
  setStage: (stage: ConversationStage) => void;
  addUserMessage: (text: string) => void;
  addAssistantMessages: (msgs: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  addToShortlist: (card: CandidateCardPayload) => void;
  removeFromShortlist: (candidateId: string) => void;
  advanceCandidate: () => void;
  rewindCandidate: () => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversationId: null,
      stage: "collecting_requirements",
      messages: [],
      shortlist: [],
      loading: false,
      currentCandidateIndex: 0,

      setConversationId: (id) => set({ conversationId: id }),
      setStage: (stage) => set({ stage }),

      addUserMessage: (text) => {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          conversation_id: get().conversationId ?? "",
          role: "user",
          text,
          stage: get().stage,
          created_at: new Date().toISOString(),
        };
        set((s) => ({ messages: [...s.messages, msg] }));
      },

      addAssistantMessages: (msgs) =>
        set((s) => {
          const existingIds = new Set(s.messages.map((m) => m.id));
          const deduped = msgs.filter((m) => !existingIds.has(m.id));
          return {
            messages: [...s.messages, ...deduped],
            stage: msgs.length > 0 ? msgs[msgs.length - 1].stage : s.stage,
          };
        }),

      setLoading: (loading) => set({ loading }),

      addToShortlist: (card) =>
        set((s) => ({
          shortlist: s.shortlist.some((c) => c.candidate_id === card.candidate_id)
            ? s.shortlist
            : [...s.shortlist, card],
        })),

      removeFromShortlist: (candidateId) =>
        set((s) => ({
          shortlist: s.shortlist.filter((c) => c.candidate_id !== candidateId),
        })),

      advanceCandidate: () =>
        set((s) => ({ currentCandidateIndex: s.currentCandidateIndex + 1 })),

      rewindCandidate: () =>
        set((s) => ({
          currentCandidateIndex: Math.max(0, s.currentCandidateIndex - 1),
        })),

      resetChat: () =>
        set({
          conversationId: null,
          stage: "collecting_requirements",
          messages: [],
          shortlist: [],
          loading: false,
          currentCandidateIndex: 0,
        }),
    }),
    {
      name: "talent-finder-chat-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversationId: state.conversationId,
        stage: state.stage,
        messages: state.messages,
        shortlist: state.shortlist,
        currentCandidateIndex: state.currentCandidateIndex,
      }),
    },
  ),
);
