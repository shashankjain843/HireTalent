import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CandidateCardPayload, ChatMessage } from "./types";

interface WidgetStore {
  sessionToken: string | null;
  conversationId: string | null;
  messages: ChatMessage[];
  shortlist: CandidateCardPayload[];
  swipeHistory: Array<{ candidateId: string; direction: "left" | "right" }>;
  primaryColor: string;

  setSessionToken: (token: string | null) => void;
  setConversationId: (id: string | null) => void;
  setPrimaryColor: (color: string) => void;
  appendMessages: (messages: ChatMessage[]) => void;
  addUserMessage: (message: ChatMessage) => void;
  addToShortlist: (candidate: CandidateCardPayload) => void;
  removeFromShortlist: (candidateId: string) => void;
  pushSwipeHistory: (entry: { candidateId: string; direction: "left" | "right" }) => void;
  popSwipeHistory: () => { candidateId: string; direction: "left" | "right" } | null;
  resetWidgetState: () => void;
}

const DEFAULT_PRIMARY_COLOR = "#4f46e5";

export const useWidgetStore = create<WidgetStore>()(
  persist(
    (set, get) => ({
      sessionToken: null,
      conversationId: null,
      messages: [],
      shortlist: [],
      swipeHistory: [],
      primaryColor: DEFAULT_PRIMARY_COLOR,

      setSessionToken: (token) => set({ sessionToken: token }),
      setConversationId: (id) => set({ conversationId: id }),
      setPrimaryColor: (color) => {
        const nextColor = color || DEFAULT_PRIMARY_COLOR;
        set((state) => (state.primaryColor === nextColor ? state : { primaryColor: nextColor }));
      },

      appendMessages: (messages) =>
        set((state) => {
          const existingIds = new Set(state.messages.map((m) => m.id));
          const deduped = messages.filter((m) => !existingIds.has(m.id));
          return { messages: [...state.messages, ...deduped] };
        }),

      addUserMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      addToShortlist: (candidate) =>
        set((state) => ({
          shortlist: state.shortlist.some((c) => c.candidate_id === candidate.candidate_id)
            ? state.shortlist
            : [...state.shortlist, candidate],
        })),

      removeFromShortlist: (candidateId) =>
        set((state) => ({
          shortlist: state.shortlist.filter((candidate) => candidate.candidate_id !== candidateId),
        })),

      pushSwipeHistory: (entry) =>
        set((state) => ({
          swipeHistory: [...state.swipeHistory, entry],
        })),

      popSwipeHistory: () => {
        const history = get().swipeHistory;
        const last = history.at(-1) ?? null;
        set({ swipeHistory: history.slice(0, -1) });
        return last;
      },

      resetWidgetState: () =>
        set({
          sessionToken: null,
          conversationId: null,
          messages: [],
          shortlist: [],
          swipeHistory: [],
          primaryColor: DEFAULT_PRIMARY_COLOR,
        }),
    }),
    {
      name: "talent-finder-widget-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        conversationId: state.conversationId,
        messages: state.messages,
        shortlist: state.shortlist,
        swipeHistory: state.swipeHistory,
        primaryColor: state.primaryColor,
      }),
    },
  ),
);
