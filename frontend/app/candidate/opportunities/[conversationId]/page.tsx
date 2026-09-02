"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, ImagePlus, Paperclip, SendHorizontal } from "lucide-react";
import {
  ApiError,
  candidateMe,
  sendCandidateAttachment,
  getCandidateOpportunity,
  sendCandidateMessage,
} from "@/lib/candidateApi";
import type { CandidateCallItem, CandidateOpportunityDetail, LiveChatResponse } from "@/lib/types";

const STORAGE_KEY = "candidate_portal_token";
const SESSION_ID_KEY = "chat_session_id";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DISALLOWED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dmg", ".apk", ".js"];
const ACTIVE_CALL_STATUSES = new Set(["scheduled"]);

function formatMeetingTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CandidateOpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const [detail, setDetail] = useState<CandidateOpportunityDetail | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Initialize or retrieve persistent session_id
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    router.replace("/candidate?reason=expired");
  }, [router]);

  const load = useCallback(async () => {
    const t = localStorage.getItem(STORAGE_KEY);
    if (!t) {
      router.replace("/candidate");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await getCandidateOpportunity(t, conversationId);
      setDetail(d);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, handleUnauthorized, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;

    let cancelled = false;
    void candidateMe(token)
      .then((me) => {
        if (cancelled) return;
        setCandidateId(me.candidate_id);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          handleUnauthorized();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleUnauthorized]);

  useLayoutEffect(() => {
    if (!detail) return;
    const nextCount = detail.messages.length;
    const behavior = submitting || uploading ? "auto" : "smooth";
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    prevMessageCountRef.current = nextCount;
  }, [detail, submitting, uploading]);

  // WebSocket logic removed as it's not supported by the new backend
  useEffect(() => {
    return () => {};
  }, []);

  async function onSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const t = localStorage.getItem(STORAGE_KEY);
    const body = messageText.trim();
    if (!t || !detail || !body) return;

    const optimisticCreatedAt = new Date().toISOString();
    
    // 1. Immediately update UI
    setMessageText(""); // Clear input immediately
    setSubmitting(true);
    setError(null);
    
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              { sender: "candidate", message: body, created_at: optimisticCreatedAt },
            ],
          }
        : prev,
    );

    try {
      // 2. Send to backend with persistent sessionId
      const res = await sendCandidateMessage(t, sessionId || conversationId, body);
      
      // 3. Add assistant response when received
      const liveRes = res.liveResponse as LiveChatResponse | undefined;
      if (liveRes?.message) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  { 
                    sender: "client", 
                    message: liveRes.message, 
                    created_at: new Date().toISOString(),
                    options: liveRes.options || []
                  },
                ],
              }
            : prev,
        );
      }
    } catch (e) {
      // 4. Rollback user message on error
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter(
                (msg) =>
                  !(
                    msg.sender === "candidate" &&
                    msg.message === body &&
                    msg.created_at === optimisticCreatedAt
                  ),
              ),
            }
          : prev,
      );
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized();
        return;
      }
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendAttachment(file: File | null) {
    if (!file || uploading || submitting) return;
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token || !detail) return;
    setUploadError(null);
    const lower = file.name.toLowerCase();
    if (DISALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setUploadError("This file type is not allowed.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setUploadError("Attachment exceeds 10MB limit.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadPercent(0);
    const optimisticCreatedAt = new Date().toISOString();
    const optimisticText = `[Uploading attachment] ${file.name}`;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                sender: "candidate",
                message: optimisticText,
                created_at: optimisticCreatedAt,
              },
            ],
          }
        : prev,
    );
    try {
      await sendCandidateAttachment(
        token,
        conversationId,
        file,
        null,
        (percent) => setUploadPercent(percent),
      );
      await load();
    } catch (e) {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter(
                (msg) =>
                  !(
                    msg.sender === "candidate" &&
                    msg.message === optimisticText &&
                    msg.created_at === optimisticCreatedAt
                  ),
              ),
            }
          : prev,
      );
      if (e instanceof ApiError && e.status === 401) {
        handleUnauthorized();
        return;
      }
      setUploadError(e instanceof Error ? e.message : "Could not upload");
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Link
          href="/candidate/opportunities"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to list
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Link
          href="/candidate/opportunities"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← All chats
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {detail.requirement.role_title?.trim() || "Chat"}
        </h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {detail.calls.length > 0 ? (() => {
          const activeCalls = detail.calls.filter((c) => ACTIVE_CALL_STATUSES.has(c.status));
          const pastCalls = detail.calls.filter((c) => !ACTIVE_CALL_STATUSES.has(c.status));

          const renderCallCard = (call: CandidateCallItem, idx: number, isActive: boolean) => {
            const borderClass = isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400";
            const iconBgClass = isActive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
              : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400";
            const titleClass = isActive
              ? "text-emerald-800 dark:text-emerald-200"
              : "text-zinc-500 dark:text-zinc-400";
            const linkClass = isActive
              ? "text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              : "text-zinc-500 hover:text-zinc-400 dark:text-zinc-400";

            return (
              <section
                key={`${call.scheduled_for}-${idx}`}
                className={`rounded-xl border p-4 text-sm ${borderClass}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${iconBgClass}`}>
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {isActive ? "Interview scheduled" : `Interview ${call.status}`}
                    </p>
                    <p className={`mt-1 ${titleClass}`}>
                      {formatMeetingTime(call.scheduled_for)} ({call.timezone})
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide opacity-70">
                      {call.duration_minutes} min • {call.status}
                    </p>
                    {call.note?.trim() ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm opacity-80">
                        {call.note}
                      </p>
                    ) : null}
                    {isActive && call.meeting_link ? (
                      <a
                        href={call.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-3 inline-block text-sm font-medium underline underline-offset-2 ${linkClass}`}
                      >
                        Open meeting link
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          };

          return (
            <div className="space-y-3">
              {activeCalls.map((call, idx) => renderCallCard(call, idx, true))}
              {pastCalls.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCallHistory((v) => !v)}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {showCallHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showCallHistory ? "Hide" : "Show"} {pastCalls.length} previous update{pastCalls.length > 1 ? "s" : ""}
                  </button>
                  {showCallHistory && (
                    <div className="mt-2 space-y-2">
                      {pastCalls.map((call, idx) => renderCallCard(call, idx, false))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })() : null}
        {detail.messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No messages yet. Start the conversation by sending a message.
          </p>
        ) : (
          <ul className="space-y-3">
            {detail.messages.map((m, idx) => (
              <li
                key={`${m.created_at}-${idx}`}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.sender === "candidate"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {m.message?.trim() ? <p className="whitespace-pre-wrap">{m.message}</p> : null}
                {m.attachment_url && m.attachment_name ? (
                  <>
                    {m.attachment_media_type?.startsWith("image/") ? (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.attachment_url}
                          alt={m.attachment_name}
                          className="mt-2 max-h-48 rounded-lg border border-white/20 object-cover"
                        />
                      </a>
                    ) : null}
                    <a
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-2 block rounded-lg px-2.5 py-1.5 text-xs underline ${
                        m.sender === "candidate"
                          ? "bg-indigo-500/70 text-white"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
                      }`}
                    >
                      {m.attachment_media_type?.startsWith("image/")
                        ? "Open image: "
                        : "Attachment: "}
                      {m.attachment_name}
                    </a>
                  </>
                ) : null}
                <p
                  className={`mt-1 text-[10px] ${
                    m.sender === "candidate" ? "text-indigo-100/90" : "text-zinc-500"
                  }`}
                >
                  {new Date(m.created_at).toLocaleString()}
                </p>
                {m.options && m.options.length > 0 && idx === detail.messages.length - 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.preventDefault();
                          setMessageText(opt);
                          // Submit it right away
                          setTimeout(() => {
                            const event = new Event('submit', { cancelable: true, bubbles: true });
                            document.querySelector('form')?.dispatchEvent(event);
                          }, 50);
                        }}
                        disabled={submitting}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
        {submitting && (
          <div className="mr-auto max-w-[80%] rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 italic animate-pulse">
            Typing...
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <form onSubmit={(e) => void onSendMessage(e)} className="space-y-2">
          <label htmlFor="reply" className="sr-only">
            Your message
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting}
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading || submitting}
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Add image"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                void onSendAttachment(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onSendAttachment(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
            <input
              id="reply"
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSendMessage(e);
                }
              }}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={submitting || uploading || !messageText.trim()}
              className="rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50"
              title="Send message"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
          {uploading && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Uploading attachment... {uploadPercent}%
            </p>
          )}
          {uploadError && (
            <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
          )}
        </form>
      </div>

      {error && detail && (
        <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
