"use client";

import { findCandidateById } from "@/lib/hiringCandidates";
import { cancelWidgetCall, getWidgetDirectChatThread, scheduleWidgetCall } from "@/lib/api";
import { useWidgetStore } from "@/lib/widgetStore";
import type { CandidateCallItem } from "@/lib/types";
import { ArrowLeft, Calendar, CalendarCheck2, Clock3, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type DateRange, DayPicker } from "react-day-picker";
import { useEffect, useMemo, useState } from "react";
import "react-day-picker/style.css";

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

export default function WidgetCandidateProfilePage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useWidgetStore();
  const candidateId = params.candidateId;
  const candidate = findCandidateById(candidateId, store.shortlist, store.messages);
  const [loadingMeeting, setLoadingMeeting] = useState(false);
  const [meeting, setMeeting] = useState<CandidateCallItem | null>(null);
  const [activeView, setActiveView] = useState<"chat" | "schedule">("chat");
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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

  async function loadMeeting() {
    if (!store.sessionToken || !candidate) return;
    setLoadingMeeting(true);
    setError(null);
    try {
      const thread = await getWidgetDirectChatThread(store.sessionToken, candidate.candidate_id);
      const preferred =
        thread.calls.find((call) => call.status.toLowerCase() === "scheduled") ?? thread.calls[0] ?? null;
      setMeeting(preferred);
      if (preferred?.status.toLowerCase() === "scheduled") {
        setSelectedSlot(preferred.scheduled_for);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load meeting state.");
    } finally {
      setLoadingMeeting(false);
    }
  }

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "schedule" && candidate) {
      setActiveView("schedule");
      const element = document.getElementById("schedule-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    setActiveView("chat");
  }, [candidate, searchParams]);

  useEffect(() => {
    void loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessionToken, candidate?.candidate_id]);

  useEffect(() => {
    if (!daysInRange.length) {
      setSelectedDayKey("");
      return;
    }
    if (!daysInRange.some((day) => formatDateInput(day) === selectedDayKey)) {
      setSelectedDayKey(formatDateInput(daysInRange[0]));
    }
  }, [daysInRange, selectedDayKey]);

  if (!candidate) {
    return (
      <main className="flex min-h-screen w-full flex-col bg-zinc-50 px-4 py-6">
        <button
          onClick={() => router.push("/widget")}
          className="mb-4 flex w-fit items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">Candidate data is not available in this widget session.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col bg-zinc-50 px-4 py-4">
      <header className="mb-4 rounded-3xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label="Go back"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-zinc-900">{candidate.name}</h1>
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

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
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
            <div className="rounded-2xl bg-zinc-100 px-4 py-3">
              <p className="text-xs text-zinc-400">Experience</p>
              <p className="mt-1 font-medium text-zinc-900">{candidate.experience_years} years</p>
            </div>
          )}
          {candidate.hourly_rate != null && (
            <div className="rounded-2xl bg-zinc-100 px-4 py-3">
              <p className="text-xs text-zinc-400">Rate</p>
              <p className="mt-1 font-medium text-zinc-900">${candidate.hourly_rate}/hr</p>
            </div>
          )}
          {candidate.availability && (
            <div className="rounded-2xl bg-zinc-100 px-4 py-3">
              <p className="text-xs text-zinc-400">Availability</p>
              <p className="mt-1 font-medium text-zinc-900">{candidate.availability}</p>
            </div>
          )}
          <div className="rounded-2xl bg-zinc-100 px-4 py-3">
            <p className="text-xs text-zinc-400">Location</p>
            <p className="mt-1 font-medium text-zinc-900">{candidate.location ?? "Remote / flexible"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setActiveView("chat");
              router.push(`/widget/chat/${candidate.candidate_id}`);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              activeView === "chat"
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
            Chat Now
          </button>
          <button
            onClick={() => {
              setActiveView("schedule");
              document.getElementById("schedule-section")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              activeView === "schedule"
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            }`}
            type="button"
          >
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </button>
        </div>
      </section>

      {activeView === "schedule" && (
        <section
          id="schedule-section"
          className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-semibold text-zinc-900">Schedule a meeting</h2>
          {loadingMeeting ? (
            <p className="mt-1 text-sm text-zinc-500">Loading meeting status...</p>
          ) : meeting && meeting.status.toLowerCase() === "scheduled" ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <CalendarCheck2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                  <div>
                    <p className="font-semibold text-emerald-700">Meeting scheduled</p>
                    <p className="text-emerald-700/80">
                      {formatSlotDate(meeting.scheduled_for)} at {formatSlotTime(meeting.scheduled_for)}
                    </p>
                  </div>
                </div>
              </div>
              {meeting.meeting_link ? (
                <a
                  href={meeting.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open meeting link
                </a>
              ) : (
                <p className="text-xs text-zinc-600">Meeting link is not available yet.</p>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!store.sessionToken) return;
                  setError(null);
                  setCancelling(true);
                  try {
                    await cancelWidgetCall(store.sessionToken, candidate.candidate_id);
                    setMeeting(null);
                    setSelectedSlot(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not cancel meeting.");
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Meeting"}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-3 rounded-2xl border border-zinc-200 p-3">
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
                  <div className="mt-3">
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
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-zinc-300 text-zinc-600"
                            }`}
                            type="button"
                          >
                            {formatDayChip(day)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3">
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
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                            }`}
                            type="button"
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
                <div className="mt-3 flex items-start gap-3 rounded-2xl bg-zinc-100 px-4 py-3">
                  <Clock3 className="mt-0.5 h-4 w-4 text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Ready to confirm</p>
                    <p className="text-xs text-zinc-500">
                      {formatSlotDate(selectedSlot)} at {formatSlotTime(selectedSlot)}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  if (!store.sessionToken || !selectedSlot) return;
                  setError(null);
                  setScheduling(true);
                  try {
                    await scheduleWidgetCall(store.sessionToken, candidate.candidate_id, {
                      scheduled_for: selectedSlot,
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      duration_minutes: 30,
                    });
                    await loadMeeting();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not schedule meeting.");
                  } finally {
                    setScheduling(false);
                  }
                }}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                disabled={!selectedSlot || scheduling}
              >
                {scheduling ? "Scheduling..." : "Confirm Meeting"}
              </button>
            </>
          )}
          {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        </section>
      )}
    </main>
  );
}
