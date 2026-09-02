"use client";

import { cn } from "@/lib/cn";
import { confirmRequirements, sendMessage, swipeCandidate } from "@/lib/api";
import type { ActionResponse } from "@/lib/adminTypes";
import { getLatestCandidateBatch } from "@/lib/hiringCandidates";
import { getStarterActions, trackActionClick } from "@/lib/publicApi";
import { useChatStore } from "@/lib/store";
import type { CandidateCardPayload, QuestionCardPayload } from "@/lib/types";
import { AnimatePresence } from "framer-motion";
import { RotateCcw, Send, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CandidateDeck } from "./CandidateDeck";
import { ConversationMessageRenderer } from "./ConversationMessageRenderer";
import { TypingIndicator } from "./TypingIndicator";

export function ChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useChatStore();
  const [input, setInput] = useState("");
  const [starterActions, setStarterActions] = useState<ActionResponse[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const skippedQuestionIdsRef = useRef<Set<string>>(new Set());
  const tenantSlug =
    searchParams.get("tenant_slug") ??
    searchParams.get("tenant") ??
    process.env.NEXT_PUBLIC_TENANT_SLUG ??
    null;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [store.messages, store.loading, scrollToBottom]);

  useEffect(() => {
    const latestSystemMessage = [...store.messages]
      .reverse()
      .find((message) => message.role === "system" && message.text);
    if (!latestSystemMessage?.text) return;
    if (latestSystemMessage.stage !== "confirming_requirements") return;
    setSystemNotice(latestSystemMessage.text);
  }, [store.messages]);

  useEffect(() => {
    if (!systemNotice) return;
    const timeoutId = window.setTimeout(() => {
      setSystemNotice(null);
    }, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [systemNotice]);

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

  const shouldSuppressQuestion = useCallback((payload: QuestionCardPayload) => {
    const normalizedQuestion = payload.question.trim().toLowerCase();
    return (
      payload.field_key === "availability" &&
      normalizedQuestion.includes("start") &&
      normalizedQuestion.includes("need")
    );
  }, []);

  const getStarterText = useCallback((action: ActionResponse) => {
    const template = action.prompt_template?.trim() ?? "";
    // Treat bracketed tokens as unresolved placeholders and fall back to title.
    if (template && !/\{[^}]+\}/.test(template)) {
      return template;
    }
    return action.title.trim();
  }, []);

  const isSendingRef = useRef(false);

  const handleSend = useCallback(
    async (text?: string, actionId?: string | null) => {
      const messageText = text ?? input.trim();
      
      // Prevent duplicate sends with a synchronous lock + loading state check
      if (!messageText || store.loading || isSendingRef.current) return;
      
      isSendingRef.current = true;
      setInput("");

      store.addUserMessage(messageText);
      store.setLoading(true);

      try {
        const res = await sendMessage(messageText, store.conversationId, tenantSlug, actionId);
        if (!store.conversationId) {
          store.setConversationId(res.conversation_id);
        }
        store.addAssistantMessages(res.messages);
      } catch (err) {
        console.error("Chat error:", err);
        store.addAssistantMessages([
          {
            id: crypto.randomUUID(),
            conversation_id: store.conversationId ?? "",
            role: "assistant",
            text: "Sorry, something went wrong. Please try again.",
            stage: store.stage,
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        store.setLoading(false);
        isSendingRef.current = false;
      }
    },
    [input, store, tenantSlug],
  );

  const handleStarterAction = useCallback(
    async (action: ActionResponse) => {
      const starterText = getStarterText(action);
      if (!starterText || store.loading) return;
      if (tenantSlug) {
        void trackActionClick(tenantSlug, action.id).catch(() => {});
      }
      await handleSend(starterText, action.id);
    },
    [getStarterText, handleSend, store.loading, tenantSlug],
  );

  const handleConfirm = async () => {
    if (!store.conversationId || store.loading) return;
    store.setLoading(true);
    try {
      const res = await confirmRequirements(store.conversationId, null, tenantSlug);
      store.addAssistantMessages(res.messages);
      setSwipeIndex(0);
    } catch {
      // handled by message
    } finally {
      store.setLoading(false);
    }
  };

  const handleSwipe = async (
    card: CandidateCardPayload,
    direction: "left" | "right",
  ) => {
    if (!store.conversationId || store.loading) return;

    if (direction === "right") {
      store.addToShortlist(card);
    }

    store.setLoading(true);
    try {
      const res = await swipeCandidate(
        store.conversationId,
        card.candidate_id,
        direction,
      );
      if (res.messages.length > 0) {
        store.addAssistantMessages(res.messages);
        setSwipeIndex(0);
      } else {
        setSwipeIndex((prev) => prev + 1);
      }
      if (direction === "right") {
        router.push(`/client-profile/${card.candidate_id}`);
      }
    } catch {
      // handled silently
    } finally {
      store.setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!store.conversationId || store.loading) return;
    store.setLoading(true);
    try {
      await swipeCandidate(store.conversationId, "00000000-0000-0000-0000-000000000000", "undo");
      setSwipeIndex((prev) => Math.max(0, prev - 1));
      store.rewindCandidate();
    } catch {
      // handled silently
    } finally {
      store.setLoading(false);
    }
  };

  const candidateCards = getLatestCandidateBatch(store.messages);

  const isShowingCandidates = store.stage === "showing_candidates";

  useEffect(() => {
    const latestQuestion = [...store.messages]
      .reverse()
      .find((message) => message.ui_payload?.type === "question_card");
    if (!latestQuestion || store.loading) return;
    if (skippedQuestionIdsRef.current.has(latestQuestion.id)) return;

    const payload = latestQuestion.ui_payload as QuestionCardPayload;
    if (!payload.skippable || !shouldSuppressQuestion(payload)) return;

    skippedQuestionIdsRef.current.add(latestQuestion.id);
    void handleSend("skip");
  }, [handleSend, shouldSuppressQuestion, store.loading, store.messages]);

  return (
    <div className="relative flex flex-col h-screen max-w-lg mx-auto bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Talent Finder
          </h1>
          <p className="text-xs text-zinc-500">AI-powered candidate matching</p>
        </div>
        <div className="flex items-center gap-2">
          {store.shortlist.length > 0 && (
            <button
              onClick={() => router.push("/shortlisted")}
              className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
            >
              <Star className="w-3.5 h-3.5" />
              {store.shortlist.length}
            </button>
          )}
          <button
            onClick={() => store.resetChat()}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            title="Start over"
          >
            <RotateCcw className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {store.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Find your perfect candidate
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
              Describe who you&apos;re looking for and I&apos;ll help you find the best
              match. Just type your requirements below.
            </p>
            {!tenantSlug && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                Starter actions unavailable: set a `tenant_slug` query param or configure `NEXT_PUBLIC_TENANT_SLUG`.
              </p>
            )}
            {starterActions.length > 0 && (
              <div className="mt-5 w-full max-w-md space-y-2 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Starter actions
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {starterActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => void handleStarterAction(action)}
                      disabled={store.loading}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60"
                    >
                      <span className="block font-medium">{action.title}</span>
                      {action.description && (
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {action.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="popLayout">
          <ConversationMessageRenderer
            messages={store.messages}
            loading={store.loading}
            onSendText={(val) => void handleSend(val)}
            onConfirmSummary={handleConfirm}
            onEditSummary={() => void handleSend("I want to edit my requirements")}
            shouldSuppressQuestion={shouldSuppressQuestion}
          />
        </AnimatePresence>

        {isShowingCandidates && (
          <CandidateDeck
            cards={candidateCards}
            currentIndex={swipeIndex}
            loading={store.loading}
            onSwipeLeft={(card) => void handleSwipe(card, "left")}
            onSwipeRight={(card) => void handleSwipe(card, "right")}
            onViewProfile={(card) => router.push(`/client-profile/${card.candidate_id}`)}
            onUndo={() => void handleUndo()}
            shortlistedCandidateIds={store.shortlist.map((candidate) => candidate.candidate_id)}
          />
        )}

        {store.loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.repeat && !store.loading) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={store.loading}
            placeholder={
              store.messages.length === 0
                ? "e.g. I need a senior React developer..."
                : "Type your response..."
            }
            className={cn(
              "flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm",
              "bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
              "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500",
              "disabled:opacity-50",
            )}
          />
          <button
            onClick={() => handleSend()}
            disabled={store.loading || !input.trim()}
            className={cn(
              "rounded-xl bg-indigo-600 p-2.5 text-white",
              "hover:bg-indigo-700 transition-colors disabled:opacity-50",
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      {systemNotice && (
        <div
          className="fixed bottom-20 left-1/2 z-[55] flex w-[92%] max-w-md -translate-x-1/2 items-start justify-between gap-3 rounded-lg border border-indigo-400/50 bg-indigo-950/95 px-4 py-3 text-sm text-indigo-100 shadow-lg"
        >
          <span>{systemNotice}</span>
          <button
            onClick={() => setSystemNotice(null)}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-indigo-100/90 hover:bg-indigo-800/40"
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
