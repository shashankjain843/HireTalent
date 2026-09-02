"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  getMockInterviewSession,
  sendMockInterviewMessage,
  finishMockInterviewPractice,
  toggleShareMockInterview,
  type PracticeTranscriptTurn,
  type PracticeScorecard,
} from "@/lib/candidateApi";

export default function MockInterviewRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [transcript, setTranscript] = useState<PracticeTranscriptTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [scorecard, setScorecard] = useState<PracticeScorecard | null>(null);
  const [shared, setShared] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId || typeof sessionId !== "string") return;
    const sid: string = sessionId;

    async function load() {
      try {
        setLoading(true);
        const data = await getMockInterviewSession(sid);
        setSessionData(data);
        setTranscript(data.transcript || []);
        if (data.overall_score !== null && data.overall_score !== undefined) {
          setScorecard({
            overall_score: data.overall_score,
            strong_areas: data.strong_areas || [],
            weak_areas: data.weak_areas || [],
            suggestions: data.suggestions || [],
            shared_with_company: data.shared_with_company,
            shared_at: data.shared_at,
          });
          setShared(!!data.shared_with_company);
        }
      } catch (err) {
        console.error("Failed to load session", err);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [sessionId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, sending]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const msg = inputText.trim();
    if (!msg || sending || !sessionId) return;

    setInputText("");
    setSending(true);

    // Optimistic candidate message
    const updated = [...transcript, { role: "candidate" as const, content: msg }];
    setTranscript(updated);

    try {
      const res = await sendMockInterviewMessage(sessionId, msg);
      setTranscript(res.transcript);
      if (res.is_complete && res.report) {
        setScorecard(res.report);
        setShared(!!res.report.shared_with_company);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to process message");
    } finally {
      setSending(false);
    }
  }

  async function handleFinishEarly() {
    if (!sessionId || sending) return;
    if (!confirm("Are you ready to end the interview and generate your feedback report?")) return;

    try {
      setSending(true);
      const res = await finishMockInterviewPractice(sessionId);
      setScorecard(res);
      setShared(!!res.shared_with_company);
      if (res.transcript) setTranscript(res.transcript);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to finish practice");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleShare() {
    if (!sessionId || sharingLoading) return;
    const newShareState = !shared;
    try {
      setSharingLoading(true);
      await toggleShareMockInterview(sessionId, newShareState);
      setShared(newShareState);
      setShareNotice(
        newShareState
          ? "✓ Scorecard successfully shared with the hiring company!"
          : "✓ Practice scorecard set to private."
      );
      setTimeout(() => setShareNotice(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update sharing preference");
    } finally {
      setSharingLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-sm text-zinc-500">
        Preparing AI Interviewer & question rubric…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Live Mock Practice
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {sessionData?.job_title || "Role Practice"}
            </span>
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">
            {sessionData?.niche === "sales" ? "🎯 Sales Discovery & Objection Arena" : "💻 Engineering & Architecture Room"}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {!scorecard && (
            <button
              type="button"
              disabled={sending || transcript.length <= 2}
              onClick={handleFinishEarly}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-all disabled:opacity-40"
            >
              Finish & Grade Early
            </button>
          )}
          <Link
            href="/candidate/practice"
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all"
          >
            Exit Room
          </Link>
        </div>
      </div>

      {/* Main Grid: Chat vs Scorecard */}
      <div className="grid grid-cols-1 gap-4">
        {/* If Scorecard is available, show Structured Feedback Report */}
        {scorecard ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
            {/* Score Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 p-5 rounded-xl border border-indigo-100 dark:border-zinc-700">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Performance Evaluation
                </span>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  AI Practice Scorecard
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Structured assessment based on role competency, technical depth, and response clarity.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl shadow-xs">
                  <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                    {Math.round(scorecard.overall_score)}
                    <span className="text-sm font-normal text-zinc-400">/100</span>
                  </div>
                  <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                    Overall Score
                  </div>
                </div>
              </div>
            </div>

            {/* Sharing Consent Notice & Action */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Share Scorecard with Company
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      shared
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {shared ? "Shared with Company" : "Private Only"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {shared
                    ? "Hiring managers can see your verified score, strengths, and suggestions."
                    : "This practice session is strictly private. Toggle to showcase your preparation to recruiters."}
                </p>
              </div>

              <button
                type="button"
                disabled={sharingLoading}
                onClick={handleToggleShare}
                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all shrink-0 ${
                  shared
                    ? "bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {sharingLoading ? "Updating…" : shared ? "Make Private" : "Share Scorecard"}
              </button>
            </div>

            {shareNotice && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                {shareNotice}
              </p>
            )}

            {/* Rubric Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strong Areas */}
              <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>✓</span> Strong Areas & Strengths
                </h3>
                <ul className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200">
                  {scorecard.strong_areas?.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                  {(!scorecard.strong_areas || scorecard.strong_areas.length === 0) && (
                    <li className="text-zinc-500 italic">No specific strengths recorded</li>
                  )}
                </ul>
              </div>

              {/* Weak Areas */}
              <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span>⚡</span> Areas for Growth & Gaps
                </h3>
                <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                  {scorecard.weak_areas?.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                  {(!scorecard.weak_areas || scorecard.weak_areas.length === 0) && (
                    <li className="text-zinc-500 italic">No major weak areas flagged</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Suggestions */}
            <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <span>💡</span> Actionable Recommendations & Pro Tips
              </h3>
              <ul className="space-y-1.5 text-xs text-indigo-950 dark:text-indigo-200">
                {scorecard.suggestions?.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Transcript Accordion / Review */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Full Interview Transcript Review
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {transcript.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      t.role === "ai"
                        ? "bg-zinc-100 dark:bg-zinc-800/70 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                        : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100 border border-indigo-200/60 dark:border-indigo-800 ml-4"
                    }`}
                  >
                    <div className="font-semibold text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
                      {t.role === "ai" ? "🤖 AI Interviewer" : "👤 Your Answer"}
                      {t.is_follow_up && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          Probing Follow-up
                        </span>
                      )}
                    </div>
                    <div>{t.content}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back CTA */}
            <div className="flex justify-end pt-2">
              <Link
                href="/candidate/practice"
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-all"
              >
                ← Return to Practice Arena
              </Link>
            </div>
          </div>
        ) : (
          /* Live Interview Chat Area */
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-[650px] shadow-sm overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transcript.map((turn, idx) => {
                const isAi = turn.role === "ai";
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
                  >
                    <div className="text-[11px] font-medium text-zinc-400 mb-1 px-1 flex items-center gap-1.5">
                      {isAi ? "🤖 AI Interviewer" : "👤 You"}
                      {turn.is_follow_up && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                          🔍 Follow-up Probe
                        </span>
                      )}
                      {turn.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {turn.category}
                        </span>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                        isAi
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-sm border border-zinc-200/80 dark:border-zinc-700"
                          : "bg-indigo-600 text-white rounded-tr-sm"
                      }`}
                    >
                      {turn.content}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex flex-col items-start">
                  <div className="text-[11px] font-medium text-zinc-400 mb-1 px-1">
                    🤖 AI Interviewer
                  </div>
                  <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs flex items-center gap-1.5">
                    <span className="animate-pulse">Analyzing your response & formulating next question…</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input & Actions */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-end gap-2"
            >
              <textarea
                rows={2}
                value={inputText}
                disabled={sending}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder="Type your structured answer here (Press Enter to send)…"
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none shadow-xs"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all h-[38px] shrink-0"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
