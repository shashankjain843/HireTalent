"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, listCandidateOpportunities } from "@/lib/candidateApi";
import type { CandidateOpportunitySummary } from "@/lib/types";

const STORAGE_KEY = "candidate_portal_token";

export default function CandidateOpportunitiesPage() {
  const router = useRouter();
  const [items, setItems] = useState<CandidateOpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      router.replace("/candidate");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listCandidateOpportunities(token);
      setItems(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        router.replace("/candidate?reason=expired");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    router.replace("/candidate");
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your chats</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Open a conversation to view and send messages.
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="shrink-0 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
        >
          Sign out
        </button>
      </div>

      {/* 🚀 Phase 7: AI Mock Interview Practice & Readiness Score Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-5 shadow-sm border border-indigo-800/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-xs">
                Phase 7 AI Feature
              </span>
              <span className="text-xs text-indigo-200 font-medium">
                Candidate Practice Arena
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              AI Mock Interview Practice & Skill Readiness Score
            </h2>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              Test your role depth with adaptive AI probing questions, view targeted skill gaps, and optionally share a verified score with hiring managers.
            </p>
          </div>

          <Link
            href="/candidate/practice"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-indigo-950 text-xs font-bold shadow-md transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>🎙️</span>
            <span>Launch Mock Interview</span>
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No chats yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const title =
              item.requirement.role_title?.trim() || "Role discussion";
            return (
              <li key={item.conversation_id}>
                <Link
                  href={`/candidate/opportunities/${item.conversation_id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {`Updated ${new Date(item.updated_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
