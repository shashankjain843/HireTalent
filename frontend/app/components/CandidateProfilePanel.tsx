"use client";

import { cn } from "@/lib/cn";
import type { CandidateCallItem, CandidateCardPayload } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, MessageCircle, X } from "lucide-react";
import { type DateRange, DayPicker } from "react-day-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import "react-day-picker/style.css";

interface CandidateProfilePanelProps {
  candidate: CandidateCardPayload | null;
  onClose: () => void;
  onChatNow: () => void;
  initialView?: "profile" | "schedule";
  persistedMeeting?: CandidateCallItem | null;
  onScheduleCall: (payload: {
    scheduled_for: string;
    timezone: string;
    duration_minutes: number;
  }) => Promise<{ meeting_link?: string | null }>;
  onCancelCall?: () => Promise<void>;
}

type PanelView = "profile" | "schedule";
type MeetingRecord = {
  scheduledSlot: string;
  meetingLink: string | null;
};

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

  for (const h of hours) {
    const dt = new Date(`${dayKey}T${String(h).padStart(2, "0")}:00:00`);
    slots.push(dt.toISOString());
  }

  return slots;
}

function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSlotDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
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
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMaxDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function CandidateProfilePanel({
  candidate,
  onClose,
  onChatNow,
  initialView = "profile",
  persistedMeeting = null,
  onScheduleCall,
  onCancelCall,
}: CandidateProfilePanelProps) {
  const [view, setView] = useState<PanelView>(initialView);

  const [scheduledMeetingsByCandidate, setScheduledMeetingsByCandidate] = useState<
    Record<string, MeetingRecord>
  >({});
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedDayKey, setSelectedDayKey] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledLink, setScheduledLink] = useState<string | null>(null);

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
    setView(initialView);
  }, [initialView, candidate?.candidate_id]);

  useEffect(() => {
    if (!candidate) {
      setScheduled(false);
      setScheduledLink(null);
      return;
    }

    const candidateKey = String(candidate.candidate_id);
    const cachedMeeting = scheduledMeetingsByCandidate[candidateKey];
    const existingMeeting =
      cachedMeeting ??
      (persistedMeeting
        ? {
            scheduledSlot: persistedMeeting.scheduled_for,
            meetingLink: persistedMeeting.meeting_link ?? null,
          }
        : undefined);

    if (persistedMeeting && !cachedMeeting) {
      setScheduledMeetingsByCandidate((prev) => ({
        ...prev,
        [candidateKey]: {
          scheduledSlot: persistedMeeting.scheduled_for,
          meetingLink: persistedMeeting.meeting_link ?? null,
        },
      }));
    }

    if (!existingMeeting) {
      setScheduled(false);
      setScheduledLink(null);
      return;
    }

    setSelectedSlot(existingMeeting.scheduledSlot);
    setScheduled(true);
    setScheduledLink(existingMeeting.meetingLink);
  }, [candidate, persistedMeeting, scheduledMeetingsByCandidate]);

  useEffect(() => {
    if (!daysInRange.length) {
      setSelectedDayKey("");
      return;
    }

    const hasSelectedDay = daysInRange.some(
      (day) => formatDateInput(day) === selectedDayKey,
    );
    if (!hasSelectedDay) {
      setSelectedDayKey(formatDateInput(daysInRange[0]));
    }
  }, [daysInRange, selectedDayKey]);

  const resetState = useCallback(() => {
    setView("profile");
    setSelectedRange(undefined);
    setSelectedDayKey("");
    setSelectedSlot(null);
    setScheduling(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSchedule = async () => {
    if (!candidate || !selectedSlot) return;
    setScheduling(true);
    try {
      const result = await onScheduleCall({
        scheduled_for: selectedSlot,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        duration_minutes: 30,
      });
      const meetingLink = result.meeting_link ?? null;
      const candidateKey = String(candidate.candidate_id);
      setScheduledMeetingsByCandidate((prev) => ({
        ...prev,
        [candidateKey]: {
          scheduledSlot: selectedSlot,
          meetingLink,
        },
      }));
      setScheduledLink(meetingLink);
      setScheduled(true);
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async () => {
    if (!candidate || !onCancelCall) return;
    setCancelling(true);
    try {
      await onCancelCall();
      const candidateKey = String(candidate.candidate_id);
      setScheduledMeetingsByCandidate((prev) => {
        const next = { ...prev };
        delete next[candidateKey];
        return next;
      });
      setScheduled(false);
      setScheduledLink(null);
      setSelectedSlot(null);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <AnimatePresence>
      {candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  {candidate.name}
                </h3>
                <p className="text-sm text-zinc-300">{candidate.title}</p>
                {candidate.location && (
                  <p className="text-xs text-zinc-500">{candidate.location}</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {view === "profile" && (
                <div className="space-y-4">
                  {candidate.bio && (
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {candidate.bio}
                    </p>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Matched because</p>
                    <p className="text-sm text-zinc-200">{candidate.match_reason}</p>
                  </div>
                  {candidate.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full bg-indigo-900/30 px-2.5 py-0.5 text-xs text-indigo-300 font-medium"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {view === "schedule" && (
                <div className="space-y-4">
                  {scheduled ? (
                    <div className="text-center py-4 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-green-900/30 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-green-400">
                        Meeting scheduled!
                      </p>
                      <p className="text-xs text-zinc-400">
                        {formatSlotDate(selectedSlot!)} at {formatSlotTime(selectedSlot!)}
                      </p>
                      {scheduledLink && (
                        <a
                          href={scheduledLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-xs text-indigo-400 underline"
                        >
                          Open meeting link
                        </a>
                      )}
                      {onCancelCall && (
                        <button
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="w-full rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950/30 disabled:opacity-50 transition-colors"
                        >
                          {cancelling ? "Cancelling..." : "Cancel Meeting"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">
                          Pick a date range
                        </p>
                        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                          <DayPicker
                            mode="range"
                            selected={selectedRange}
                            onSelect={(range) => {
                              setSelectedRange(range);
                              setSelectedSlot(null);
                            }}
                            disabled={[
                              { before: getMinDate() },
                              { after: getMaxDate() },
                            ]}
                            numberOfMonths={1}
                            className="text-zinc-200"
                            classNames={{
                              month_caption:
                                "text-sm font-semibold text-zinc-100 mb-2",
                              weekday: "text-xs text-zinc-400",
                              day_button:
                                "h-9 w-9 rounded-md text-sm hover:bg-zinc-700",
                              selected: "bg-indigo-600 text-white",
                              range_start: "bg-indigo-600 text-white",
                              range_middle: "bg-indigo-900/50 text-indigo-100",
                              range_end: "bg-indigo-600 text-white",
                              today: "border border-emerald-500",
                              disabled: "text-zinc-600 line-through",
                            }}
                          />
                        </div>
                      </div>

                      {timeSlots.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-2">
                            Pick a day in your selected range
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {daysInRange.map((day) => {
                              const dayKey = formatDateInput(day);
                              const isSelected = dayKey === selectedDayKey;
                              return (
                                <button
                                  key={dayKey}
                                  onClick={() => {
                                    setSelectedDayKey(dayKey);
                                    setSelectedSlot(null);
                                  }}
                                  className={cn(
                                    "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                    isSelected
                                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500",
                                  )}
                                >
                                  {formatDayChip(day)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {timeSlots.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-2">
                            Choose a time slot for {selectedDay ? formatDayChip(selectedDay) : ""}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {timeSlots.map((slot) => (
                              <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                  selectedSlot === slot
                                    ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                                    : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500",
                                )}
                              >
                                {formatSlotTime(slot)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleSchedule}
                        disabled={!selectedSlot || scheduling}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {scheduling ? "Scheduling..." : "Confirm Meeting"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bottom two-action bar */}
            <div className="shrink-0 border-t border-zinc-700 px-5 py-3">
              {scheduled && selectedSlot && (
                <p className="mb-2 text-center text-xs text-zinc-400">
                  Already scheduled on {formatSlotDate(selectedSlot)} at{" "}
                  {formatSlotTime(selectedSlot)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={onChatNow}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    "bg-indigo-600 text-white hover:bg-indigo-500",
                  )}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat Now
                </button>
                <button
                  onClick={() => setView("schedule")}
                  disabled={scheduled}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    scheduled
                      ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                      : view === "schedule"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Meeting
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
