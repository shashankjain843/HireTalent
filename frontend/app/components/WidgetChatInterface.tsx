"use client";

import { createWidgetSession, sendWidgetConfirm, sendWidgetMessage, sendWidgetSwipe } from "@/lib/api";
import type { ActionResponse } from "@/lib/adminTypes";
import { getLatestCandidateBatch } from "@/lib/hiringCandidates";
import { getStarterActions, trackActionClick } from "@/lib/publicApi";
import { getWidgetSessionStartupError } from "@/lib/widgetSessionErrors";
import { useWidgetStore } from "@/lib/widgetStore";
import type { CandidateCardPayload, ChatMessage } from "@/lib/types";
import { Send, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandidateDeck } from "./CandidateDeck";
import { ConversationMessageRenderer } from "./ConversationMessageRenderer";
import { TypingIndicator } from "./TypingIndicator";

const MAX_WIDGET_MESSAGE_LENGTH = 12000;

export function WidgetChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottomRef = useRef<HTMLDivElement>(null);

  const botId = searchParams.get("bot_id") ?? "";
  const embedToken = searchParams.get("embed_token") ?? "";
  const primaryColor = searchParams.get("primary_color") ?? "#4f46e5";

  const store = useWidgetStore();
  const [input, setInput] = useState("");
  const [booting, setBooting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterActions, setStarterActions] = useState<ActionResponse[]>([]);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const tenantSlug =
    searchParams.get("tenant_slug") ??
    searchParams.get("tenant") ??
    process.env.NEXT_PUBLIC_TENANT_SLUG ??
    null;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [store.messages, loading, scrollToBottom]);

  useEffect(() => {
    if (primaryColor) {
      store.setPrimaryColor(primaryColor);
    }
  }, [primaryColor, store]);

  useEffect(() => {
    let cancelled = false;
    async function bootSession() {
      if (store.sessionToken) return;
      if (!botId || !embedToken) {
        setError("Missing bot configuration. Provide bot_id and embed_token in widget URL.");
        return;
      }
      setBooting(true);
      setError(null);
      try {
        const session = await createWidgetSession(botId, embedToken);
        if (cancelled) return;
        store.setSessionToken(session.session_token);
        if (session.welcome_text?.trim()) {
          store.appendMessages([
            {
              id: crypto.randomUUID(),
              conversation_id: "",
              role: "assistant",
              text: session.welcome_text,
              stage: "collecting_requirements",
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(getWidgetSessionStartupError(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void bootSession();
    return () => {
      cancelled = true;
    };
  }, [botId, embedToken, store]);

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    getStarterActions(tenantSlug)
      .then((actions) => {
        if (!cancelled) setStarterActions(actions);
      })
      .catch(() => {
        if (!cancelled) setStarterActions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const isBusy = booting || loading;

  const visibleMessages = useMemo(
    () => store.messages.filter((message) => message.role !== "system"),
    [store.messages],
  );
  const candidateCards = useMemo(() => getLatestCandidateBatch(store.messages), [store.messages]);
  const isShowingCandidates = store.messages.at(-1)?.stage === "showing_candidates";
  const hasUserMessage = useMemo(
    () => store.messages.some((message) => message.role === "user"),
    [store.messages],
  );

  const handleSend = useCallback(async (text?: string, actionId?: string | null) => {
    const messageText = text ?? input.trim();
    if (!messageText || !store.sessionToken || isBusy) return;
    if (messageText.length > MAX_WIDGET_MESSAGE_LENGTH) {
      setError(`Message is too long. Keep it under ${MAX_WIDGET_MESSAGE_LENGTH} characters.`);
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: "",
      role: "user",
      text: messageText,
      stage: "collecting_requirements",
      created_at: new Date().toISOString(),
    };
    store.addUserMessage(userMessage);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const response = await sendWidgetMessage(store.sessionToken, messageText, actionId);
      store.setConversationId(response.conversation_id);
      store.appendMessages(response.messages);
      setSwipeIndex(0);
    } catch (err) {
      const detail =
        err instanceof Error && err.message ? err.message.replace(/^API error \d+:\s*/, "") : null;
      setError(detail || "Message failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [input, isBusy, store]);

  const handleSwipe = useCallback(
    async (card: CandidateCardPayload, direction: "left" | "right") => {
      if (!store.sessionToken || isBusy) return;
      const candidateId = card.candidate_id;

      if (direction === "right") {
        store.addToShortlist(card);
      }
      store.pushSwipeHistory({ candidateId, direction });

      setLoading(true);
      setError(null);
      try {
        const response = await sendWidgetSwipe(store.sessionToken, {
          candidate_id: candidateId,
          direction,
        });
        if (response.messages.length > 0) {
          store.setConversationId(response.conversation_id);
          store.appendMessages(response.messages);
          setSwipeIndex(0);
        } else {
          setSwipeIndex((prev) => prev + 1);
        }
      } catch (err) {
        store.popSwipeHistory();
        if (direction === "right") {
          store.removeFromShortlist(candidateId);
        }
        const detail =
          err instanceof Error && err.message ? err.message.replace(/^API error \d+:\s*/, "") : null;
        setError(detail || "Swipe failed. Please retry.");
      } finally {
        setLoading(false);
      }
    },
    [isBusy, store],
  );

  const handleUndo = useCallback(async () => {
    if (!store.sessionToken || isBusy) return;
    const lastSwipe = store.swipeHistory.at(-1);
    if (!lastSwipe) return;
    setLoading(true);
    setError(null);
    try {
      await sendWidgetSwipe(store.sessionToken, {
        candidate_id: "00000000-0000-0000-0000-000000000000",
        direction: "undo",
      });
      setSwipeIndex((prev) => Math.max(0, prev - 1));
      store.popSwipeHistory();
      if (lastSwipe.direction === "right") {
        store.removeFromShortlist(lastSwipe.candidateId);
      }
    } catch (err) {
      const detail =
        err instanceof Error && err.message ? err.message.replace(/^API error \d+:\s*/, "") : null;
      setError(detail || "Undo failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [isBusy, store]);

  const handleConfirm = useCallback(async () => {
    if (!store.sessionToken || isBusy) return;
    setLoading(true);
    setError(null);
    try {
      const response = await sendWidgetConfirm(store.sessionToken);
      store.setConversationId(response.conversation_id);
      store.appendMessages(response.messages);
      setSwipeIndex(0);
    } catch (err) {
      const detail =
        err instanceof Error && err.message ? err.message.replace(/^API error \d+:\s*/, "") : null;
      setError(detail || "Confirmation failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [isBusy, store]);

  const getStarterText = useCallback((action: ActionResponse) => {
    const template = action.prompt_template?.trim() ?? "";
    // Treat bracketed tokens as unresolved placeholders and fall back to title.
    if (template && !/\{[^}]+\}/.test(template)) {
      return template;
    }
    return action.title.trim();
  }, []);

  const handleStarterAction = useCallback(
    async (action: ActionResponse) => {
      const starterText = getStarterText(action);
      if (!starterText || isBusy || !store.sessionToken) return;
      if (tenantSlug) {
        void trackActionClick(tenantSlug, action.id).catch(() => {});
      }
      await handleSend(starterText, action.id);
    },
    [getStarterText, handleSend, isBusy, store.sessionToken, tenantSlug],
  );

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-white text-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold">Talent Finder</h1>
          <p className="text-xs text-zinc-500">Hiring assistant widget</p>
        </div>
        {store.shortlist.length > 0 && (
          <button
            onClick={() => router.push("/widget/shortlisted")}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
            type="button"
          >
            <Star className="h-3.5 w-3.5" />
            {store.shortlist.length}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        <ConversationMessageRenderer
          messages={visibleMessages}
          loading={isBusy}
          onSendText={(text) => void handleSend(text)}
          onConfirmSummary={() => void handleConfirm()}
          onEditSummary={() => void handleSend("I want to edit my requirements")}
          cardAlign="start"
        />
        {isShowingCandidates && (
          <CandidateDeck
            cards={candidateCards}
            currentIndex={swipeIndex}
            loading={isBusy}
            onSwipeLeft={(card) => void handleSwipe(card, "left")}
            onSwipeRight={(card) => void handleSwipe(card, "right")}
            onUndo={() => void handleUndo()}
            onViewProfile={(card) => router.push(`/widget/candidate/${card.candidate_id}`)}
            shortlistedCandidateIds={store.shortlist.map((candidate) => candidate.candidate_id)}
            align="start"
          />
        )}
        {!hasUserMessage && starterActions.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Starter actions
            </p>
            <div className="grid gap-2">
              {starterActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => void handleStarterAction(action)}
                  disabled={isBusy || !store.sessionToken}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left hover:bg-zinc-50 disabled:opacity-60"
                >
                  <span className="block text-sm font-medium text-zinc-800">
                    {action.title}
                  </span>
                  {action.description && (
                    <span className="block text-xs text-zinc-500 mt-0.5">
                      {action.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {!hasUserMessage && !tenantSlug && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Starter actions unavailable: set a `tenant_slug` query param or configure `NEXT_PUBLIC_TENANT_SLUG`.
          </div>
        )}
        {loading && <TypingIndicator />}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-200 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void handleSend()}
            disabled={isBusy || !store.sessionToken}
            placeholder="Type your requirement..."
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isBusy || !store.sessionToken || !input.trim()}
            style={{ backgroundColor: store.primaryColor }}
            className="rounded-lg p-2 text-white disabled:opacity-60"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
