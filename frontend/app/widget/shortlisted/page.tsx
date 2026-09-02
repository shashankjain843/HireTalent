"use client";

import { getWidgetDirectChatThread } from "@/lib/api";
import type { CandidateCallItem } from "@/lib/types";
import { useWidgetStore } from "@/lib/widgetStore";
import { ArrowLeft, Calendar, CalendarCheck, MessageCircle } from "lucide-react";
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

export default function WidgetShortlistedPage() {
  const router = useRouter();
  const store = useWidgetStore();
  const [candidateMeetings, setCandidateMeetings] = useState<Record<string, CandidateCallItem | null>>(
    {},
  );

  useEffect(() => {
    if (!store.sessionToken || store.shortlist.length === 0) return;
    let cancelled = false;
    void Promise.all(
      store.shortlist.map(async (candidate) => {
        try {
          const thread = await getWidgetDirectChatThread(store.sessionToken!, candidate.candidate_id);
          const latestCall =
            thread.calls.find((call) => call.status.toLowerCase() === "scheduled") ?? thread.calls[0] ?? null;
          return {
            candidateId: candidate.candidate_id,
            latestCall,
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
  }, [store.sessionToken, store.shortlist]);

  return (
    <main className="flex min-h-screen w-full flex-col bg-zinc-50 px-4 py-4">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <button
          onClick={() => router.push("/widget")}
          className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          aria-label="Back to widget chat"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-semibold text-zinc-900">Shortlisted</h1>
          <p className="text-xs text-zinc-500">{store.shortlist.length} candidates</p>
        </div>
        <div className="h-8 w-8" />
      </header>

      {store.shortlist.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">No shortlisted candidates yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {store.shortlist.map((candidate) => {
            const meeting = candidateMeetings[candidate.candidate_id];
            const isScheduled = Boolean(meeting && meeting.status.toLowerCase() === "scheduled");
            return (
              <section
                key={candidate.candidate_id}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">{candidate.name}</h2>
                    <p className="text-sm text-zinc-500">{candidate.title}</p>
                    {candidate.location && <p className="mt-1 text-xs text-zinc-400">{candidate.location}</p>}
                  </div>
                  <button
                    onClick={() => store.removeFromShortlist(candidate.candidate_id)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                {isScheduled && meeting && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    <span>{formatMeetingTime(meeting)}</span>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => router.push(`/widget/candidate/${candidate.candidate_id}`)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    type="button"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => router.push(`/widget/candidate/${candidate.candidate_id}?view=schedule`)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    type="button"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule
                  </button>
                  <button
                    onClick={() => router.push(`/widget/chat/${candidate.candidate_id}`)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                    type="button"
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
