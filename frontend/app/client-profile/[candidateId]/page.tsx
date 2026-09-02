"use client";

import { cancelCall, getDirectChatThread, scheduleCall } from "@/lib/api";
import { getSharedPracticeResults, type SharedPracticeResult } from "@/lib/adminApi";
import { findCandidateById } from "@/lib/hiringCandidates";
import { useChatStore } from "@/lib/store";
import type { CandidateCallItem } from "@/lib/types";
import {
  ArrowLeft,
  Calendar,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type DateRange, DayPicker } from "react-day-picker";
import { useEffect, useMemo, useState } from "react";
import "react-day-picker/style.css";

function getPreferredMeeting(calls: CandidateCallItem[]): CandidateCallItem | null {
  if (calls.length === 0) return null;
  return calls.find((call) => call.status.toLowerCase() === "scheduled") ?? calls[0];
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function listDatesInRange(startDate?: Date, endDate?: Date): Date[] {
  if (!startDate || !endDate) return [];
  const days: Date[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function generateTimeSlotsForDate(day?: Date): string[] {
  if (!day) return [];
  const slots: string[] = [];
  const hours = [9, 10, 11, 13, 14, 15, 16, 17];
  const dayKey = formatDateInput(day);

  for (const hour of hours) {
    slots.push(new Date(`${dayKey}T${String(hour).padStart(2, "0")}:00:00`).toISOString());
  }

  return slots;
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatDayChip(date: Date): string {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function getMinDate(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMaxDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default function ClientProfilePage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const store = useChatStore();
  const routeCandidateId = params.candidateId;
  const candidate = findCandidateById(routeCandidateId, store.shortlist, store.messages);
  const resolvedCandidateId = candidate?.candidate_id;

  const [persistedMeeting, setPersistedMeeting] = useState<CandidateCallItem | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysInRange = useMemo(
    () => listDatesInRange(selectedRange?.from, selectedRange?.to),
    [selectedRange],
  );
  const selectedDay = useMemo(
    () => daysInRange.find((day) => formatDateInput(day) === selectedDayKey),
    [daysInRange, selectedDayKey],
  );
  const timeSlots = useMemo(() => generateTimeSlotsForDate(selectedDay), [selectedDay]);

  useEffect(() => {
    if (!store.conversationId || !resolvedCandidateId) return;

    let cancelled = false;
    void getDirectChatThread(store.conversationId, resolvedCandidateId)
      .then((thread) => {
        if (cancelled) return;
        setPersistedMeeting(getPreferredMeeting(thread.calls));
      })
      .catch(() => {
        if (cancelled) return;
        setPersistedMeeting(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCandidateId, store.conversationId]);

  const [sharedPractices, setSharedPractices] = useState<SharedPracticeResult[]>([]);

  useEffect(() => {
    const cid = resolvedCandidateId ?? routeCandidateId;
    if (!cid) return;
    void getSharedPracticeResults(cid)
      .then((res) => {
        setSharedPractices(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        setSharedPractices([]);
      });
  }, [resolvedCandidateId, routeCandidateId]);

  useEffect(() => {
    if (!daysInRange.length) {
      setSelectedDayKey("");
      return;
    }

    if (!daysInRange.some((day) => formatDateInput(day) === selectedDayKey)) {
      setSelectedDayKey(formatDateInput(daysInRange[0]));
    }
  }, [daysInRange, selectedDayKey]);

  useEffect(() => {
    if (persistedMeeting) {
      setSelectedSlot(persistedMeeting.scheduled_for);
      setShowScheduler(true);
      return;
    }
    setSelectedSlot(null);
    setShowScheduler(false);
  }, [persistedMeeting]);

  if (!candidate) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-zinc-50 px-4 py-6 dark:bg-zinc-900">
        <button
          onClick={() => router.push("/")}
          className="mb-4 flex w-fit items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Candidate data is not available in the current client session.
          </p>
        </div>
      </main>
    );
  }

  const scheduled = Boolean(
    persistedMeeting && persistedMeeting.status.toLowerCase() === "scheduled",
  );
  const schedulerNote = persistedMeeting?.note?.trim() ?? "";
  const showMeetingLink = Boolean(persistedMeeting?.meeting_link);

  async function handleSchedule() {
    if (!store.conversationId || !selectedSlot || !resolvedCandidateId) return;
    setScheduling(true);
    setError(null);

    try {
      const result = await scheduleCall(store.conversationId, resolvedCandidateId, {
        scheduled_for: selectedSlot,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        duration_minutes: 30,
      });

      setPersistedMeeting({
        scheduled_for: selectedSlot,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        duration_minutes: 30,
        meeting_link: result.meeting_link ?? null,
        note: result.note,
        status: result.status,
      });
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Could not schedule meeting.");
    } finally {
      setScheduling(false);
    }
  }

  async function handleCancel() {
    if (!store.conversationId || !resolvedCandidateId) return;
    setCancelling(true);
    setError(null);

    try {
      await cancelCall(store.conversationId, resolvedCandidateId);
      setPersistedMeeting(null);
      setSelectedSlot(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel meeting.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
      <header className="mb-4 rounded-3xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {candidate.name}
            </h1>
            <p className="text-sm text-zinc-500">{candidate.title}</p>
            {candidate.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                <MapPin className="h-3.5 w-3.5" />
                {candidate.location}
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
                Candidate Snapshot
              </p>
              <h2 className="mt-1 text-lg font-semibold">{candidate.title}</h2>
            </div>
            <div className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {Math.round(candidate.match_score)}% match
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/85">{candidate.match_reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {candidate.experience_years != null && (
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
              <p className="text-xs text-zinc-400">Experience</p>
              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                {candidate.experience_years} years
              </p>
            </div>
          )}
          {candidate.hourly_rate != null && (
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
              <p className="text-xs text-zinc-400">Rate</p>
              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                ${candidate.hourly_rate}/hr
              </p>
            </div>
          )}
          {candidate.availability && (
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
              <p className="text-xs text-zinc-400">Availability</p>
              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                {candidate.availability}
              </p>
            </div>
          )}
          <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
            <p className="text-xs text-zinc-400">Location</p>
            <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {candidate.location ?? "Remote / flexible"}
            </p>
          </div>
        </div>

        {candidate.bio && (
          <div className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-700">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              About
            </p>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {candidate.bio}
            </p>
          </div>
        )}

        {candidate.skills.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span
                  key={skill.name}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 🎯 Phase 7: Verified AI Mock Interview Practice Scorecard */}
        {sharedPractices.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                  Verified AI Practice Scorecard
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Shared by Candidate
              </span>
            </div>

            {sharedPractices.map((practice) => (
              <div
                key={practice.id}
                className="space-y-3 rounded-xl border border-indigo-200/70 bg-white p-3.5 shadow-xs dark:border-zinc-700 dark:bg-zinc-800/80"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {practice.job_title}
                    </p>
                    <p className="text-[11px] text-zinc-500 capitalize">
                      {practice.niche} Track Practice
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 dark:bg-indigo-900/30">
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {Math.round(practice.overall_score)}
                    </span>
                    <span className="text-[10px] text-zinc-400">/100</span>
                  </div>
                </div>

                {practice.strong_areas?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Strengths:
                    </p>
                    <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {practice.strong_areas.map((st, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {practice.weak_areas?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      Areas for Growth:
                    </p>
                    <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {practice.weak_areas.map((wk, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{wk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push(`/chat/${resolvedCandidateId ?? routeCandidateId}`)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <MessageCircle className="h-4 w-4" />
            Chat Now
          </button>
          <button
            onClick={() => {
              setShowScheduler(true);
              window.setTimeout(() => {
                document.getElementById("schedule-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 0);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </button>
        </div>
      </section>

      {(showScheduler || scheduled) && (
        <section
          id="schedule-section"
          className="mt-4 space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
        <button
          type="button"
          onClick={() => setShowScheduler((value) => !value)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Schedule a meeting
              </h2>
              <p className="text-sm text-zinc-500">
                {scheduled
                  ? "View the confirmed meeting or cancel it before scheduling a new one."
                  : "Pick a date range, choose a slot, and continue the conversation with confidence."}
              </p>
            </div>
          </div>
          <div className="mt-1 text-zinc-400">
            {showScheduler ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </button>

        {showScheduler && scheduled && selectedSlot ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Meeting scheduled
                </p>
                <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                  {formatSlotDate(selectedSlot)} at {formatSlotTime(selectedSlot)}
                </p>
              </div>
              <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Confirmed
              </div>
            </div>

            {showMeetingLink ? (
              <a
                href={persistedMeeting?.meeting_link ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <ExternalLink className="h-4 w-4" />
                Open meeting link
              </a>
            ) : (
              <div className="rounded-xl border border-dashed border-emerald-300 bg-white/70 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Meeting link not available yet
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {schedulerNote ||
                    "The meeting was created successfully, but no join link was returned. This usually depends on calendar/video integration settings."}
                </p>
              </div>
            )}

            {schedulerNote && showMeetingLink && (
              <div className="rounded-xl bg-white/70 px-4 py-3 dark:bg-emerald-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Scheduler note
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {schedulerNote}
                </p>
              </div>
            )}

            <button
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="w-full rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              {cancelling ? "Cancelling..." : "Cancel Meeting"}
            </button>
          </div>
        ) : showScheduler ? (
          <>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={(range) => {
                  setSelectedRange(range);
                  setSelectedSlot(null);
                }}
                disabled={[{ before: getMinDate() }, { after: getMaxDate() }]}
                numberOfMonths={1}
              />
            </div>

            {timeSlots.length > 0 && (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Selected days
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {daysInRange.map((day) => {
                      const dayKey = formatDateInput(day);
                      const isActive = selectedDayKey === dayKey;

                      return (
                        <button
                          key={dayKey}
                          onClick={() => {
                            setSelectedDayKey(dayKey);
                            setSelectedSlot(null);
                          }}
                          className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {formatDayChip(day)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Available slots
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isActive = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                            isActive
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {formatSlotTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {selectedSlot && (
              <div className="flex items-start gap-3 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
                <Clock3 className="mt-0.5 h-4 w-4 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Ready to confirm
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatSlotDate(selectedSlot)} at {formatSlotTime(selectedSlot)}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => void handleSchedule()}
              disabled={!selectedSlot || scheduling}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {scheduling ? "Scheduling..." : "Confirm Meeting"}
            </button>
          </>
        ) : null}

        {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}

        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Next best action
            </p>
            <p className="text-xs text-zinc-500">
              {scheduled
                ? "Open the meeting link if available, or continue the conversation in chat."
                : "Pick a slot above, then confirm the meeting or continue chatting first."}
            </p>
          </div>
        </div>
        </section>
      )}
    </main>
  );
}
