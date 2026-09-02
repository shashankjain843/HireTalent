"use client";

import type { CandidateCallItem, CandidateCardPayload } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, CalendarCheck, ChevronDown, ChevronUp, MessageCircle, Star, X } from "lucide-react";
import { useState } from "react";

interface ShortlistTrayProps {
  candidates: CandidateCardPayload[];
  candidateMeetings: Record<string, CandidateCallItem | null>;
  unreadByCandidate: Record<string, number>;
  onChatNow: (candidate: CandidateCardPayload) => void;
  onScheduleMeeting: (candidate: CandidateCardPayload) => void;
  onRemove: (candidateId: string) => void;
}

function formatMeetingTime(meeting: CandidateCallItem): string {
  const date = new Date(meeting.scheduled_for);
  if (Number.isNaN(date.getTime())) {
    return meeting.scheduled_for;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hasScheduledMeeting(meeting: CandidateCallItem | null | undefined): meeting is CandidateCallItem {
  return Boolean(meeting && meeting.status.toLowerCase() === "scheduled");
}

export function ShortlistTray({
  candidates,
  candidateMeetings,
  unreadByCandidate,
  onChatNow,
  onScheduleMeeting,
  onRemove,
}: ShortlistTrayProps) {
  const [expanded, setExpanded] = useState(false);

  if (candidates.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg z-30"
    >
      <div className="mx-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          <span className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Shortlisted ({candidates.length})
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
                {candidates.map((c) => {
                  const meeting = candidateMeetings[c.candidate_id];
                  const isScheduled = hasScheduledMeeting(meeting);
                  const unreadCount = unreadByCandidate[c.candidate_id] ?? 0;
                  return (
                    <div key={c.candidate_id} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {c.name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">{c.title}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isScheduled ? (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                              <CalendarCheck className="h-3.5 w-3.5" />
                              <span>{formatMeetingTime(meeting)}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => onScheduleMeeting(c)}
                              className="rounded-md border border-indigo-300 p-1.5 text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                              aria-label={`Schedule meeting with ${c.name}`}
                              title="Schedule meeting"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onChatNow(c)}
                            className="relative rounded-md border border-zinc-300 p-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            aria-label={`Chat now with ${c.name}`}
                            title="Chat now"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {unreadCount > 0 && (
                              <span className="absolute -right-1.5 -top-1.5 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => onRemove(c.candidate_id)}
                            className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            aria-label={`Remove ${c.name} from shortlist`}
                          >
                            <X className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
