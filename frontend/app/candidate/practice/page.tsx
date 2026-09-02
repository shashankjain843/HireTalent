"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  startMockInterviewPractice,
  getSkillReadiness,
  type SkillReadinessResponse,
} from "@/lib/candidateApi";

const STORAGE_KEY = "candidate_portal_token";

export default function MockInterviewHubPage() {
  const router = useRouter();
  const [niche, setNiche] = useState<"tech" | "sales">("tech");
  const [readiness, setReadiness] = useState<SkillReadinessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadReadiness = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    try {
      setLoading(true);
      const res = await getSkillReadiness(token || undefined, undefined, niche);
      setReadiness(res);
    } catch (e) {
      console.error("Failed to load readiness", e);
    } finally {
      setLoading(false);
    }
  }, [niche]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  async function handleStartPractice() {
    try {
      setStarting(true);
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const res = await startMockInterviewPractice(token || undefined, undefined, niche);
      router.push(`/candidate/practice/${res.session_id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start mock interview");
      setStarting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              AI Practice Arena
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-zinc-900 dark:text-zinc-50">
            AI Mock Interview & Skill Readiness
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            Practice role-specific interview questions, receive real-time adaptive follow-ups, and get a private structured evaluation report.
          </p>
        </div>
        <Link
          href="/candidate/opportunities"
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-4"
        >
          ← Back to Chats
        </Link>
      </div>

      {/* Role Niche Switcher */}
      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit">
        <button
          type="button"
          onClick={() => setNiche("tech")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            niche === "tech"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          💻 Engineering & Tech Track
        </button>
        <button
          type="button"
          onClick={() => setNiche("sales")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            niche === "sales"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          🎯 Sales & GTM Track
        </button>
      </div>

      {/* Feature 2: Skill Readiness Scorecard Widget */}
      {readiness && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Role Readiness Evaluation
              </span>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {readiness.job_title}
              </h2>
            </div>
            <div className="flex items-baseline gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-lg">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {Math.round(readiness.readiness_percent)}%
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">
                Ready
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, readiness.readiness_percent)}%` }}
            />
          </div>

          {/* Matched vs Missing Skills Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                <span>✓</span> Matched Strengths ({readiness.matched_skills.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {readiness.matched_skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium"
                  >
                    {s}
                  </span>
                ))}
                {readiness.matched_skills.length === 0 && (
                  <span className="text-xs text-zinc-400">No matching skills identified</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <span>⚡</span> Targeted Gaps / Focus Areas ({readiness.missing_skills.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {readiness.missing_skills.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium"
                  >
                    {s}
                  </span>
                ))}
                {readiness.missing_skills.length === 0 && (
                  <span className="text-xs text-zinc-400">All core skills covered!</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              {readiness.practice_cta}
            </p>
            <button
              type="button"
              disabled={starting}
              onClick={handleStartPractice}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              {starting ? "Launching AI Room…" : "🚀 Start AI Mock Interview"}
            </button>
          </div>
        </div>
      )}

      {/* Feature Explainer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5">
          <div className="text-base">🎙️</div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Niche-Aware Questions
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Questions dynamically adapt to Tech architecture or Sales discovery calls based on your target role.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5">
          <div className="text-base">🔍</div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Adaptive Probing
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            If your answer is brief or lacks specifics, the AI interviewer naturally asks 1–2 follow-up probes to test depth.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5">
          <div className="text-base">🔒</div>
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            100% Private by Default
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Practice reports stay private. You decide if and when to share a verified score with hiring companies.
          </p>
        </div>
      </div>
    </div>
  );
}
