"use client";

import { getDirectChatThread } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import type { CandidateCallItem } from "@/lib/types";
import { ArrowLeft, Calendar, CalendarCheck, MessageCircle, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

function getPreferredMeeting(calls: CandidateCallItem[]): CandidateCallItem | null {
  if (calls.length === 0) return null;
  return calls.find((call) => call.status.toLowerCase() === "scheduled") ?? calls[0];
}

export default function ShortlistedPage() {
  const router = useRouter();
  const store = useChatStore();
  const [candidateMeetings, setCandidateMeetings] = useState<Record<string, CandidateCallItem | null>>(
    {},
  );

  useEffect(() => {
    if (!store.conversationId || store.shortlist.length === 0) return;

    let cancelled = false;
    void Promise.all(
      store.shortlist.map(async (candidate) => {
        try {
          const thread = await getDirectChatThread(store.conversationId!, candidate.candidate_id);
          return {
            candidateId: candidate.candidate_id,
            latestCall: getPreferredMeeting(thread.calls),
          };
        } catch {
          return { candidateId: candidate.candidate_id, latestCall: null };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setCandidateMeetings(
        results.reduce<Record<string, CandidateCallItem | null>>((acc, result) => {
          acc[result.candidateId] = result.latestCall;
          return acc;
        }, {}),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [store.conversationId, store.shortlist]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => router.push("/")}
          className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          aria-label="Back to talent finder"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Shortlisted
          </h1>
          <p className="text-xs text-zinc-500">{store.shortlist.length} candidates</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
          <Star className="h-4 w-4" />
        </div>
      </header>

      {store.shortlist.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No shortlisted candidates yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {store.shortlist.map((candidate) => {
            const meeting = candidateMeetings[candidate.candidate_id];
            const isScheduled = Boolean(meeting && meeting.status.toLowerCase() === "scheduled");

            return (
              <section
                key={candidate.candidate_id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {candidate.name}
                    </h2>
                    <p className="text-sm text-zinc-500">{candidate.title}</p>
                    {candidate.location && (
                      <p className="mt-1 text-xs text-zinc-400">{candidate.location}</p>
                    )}
                  </div>
                  <button
                    onClick={() => store.removeFromShortlist(candidate.candidate_id)}
                    className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    aria-label={`Remove ${candidate.name} from shortlist`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isScheduled && meeting && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>{formatMeetingTime(meeting)}</span>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => router.push(`/client-profile/${candidate.candidate_id}`)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => router.push(`/client-profile/${candidate.candidate_id}?view=schedule`)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule
                  </button>
                  <button
                    onClick={() => router.push(`/chat/${candidate.candidate_id}`)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
