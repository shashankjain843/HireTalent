"use client";

import {
  contactWidgetCandidate,
  contactWidgetCandidateAttachment,
  getWidgetDirectChatThread,
  initiateWidgetDirectChatThread,
} from "@/lib/api";
import { findCandidateById } from "@/lib/hiringCandidates";
import { useWidgetStore } from "@/lib/widgetStore";
import type { OutreachMessage } from "@/lib/types";
import { ArrowLeft, Calendar, ImagePlus, Paperclip, SendHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DISALLOWED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dmg", ".apk", ".js"];

export default function WidgetCandidateChatPage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const store = useWidgetStore();
  const candidateId = params.candidateId;
  const candidate = findCandidateById(candidateId, store.shortlist, store.messages);
  const sessionToken = store.sessionToken;

  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    if (!sessionToken || !candidate) return;
    setLoading(true);
    setError(null);

    try {
      const thread = await initiateWidgetDirectChatThread(sessionToken, candidate.candidate_id);
      setMessages(thread.messages);
    } catch {
      try {
        const thread = await getWidgetDirectChatThread(sessionToken, candidate.candidate_id);
        setMessages(thread.messages);
      } catch (threadError) {
        setError(threadError instanceof Error ? threadError.message : "Could not load chat.");
      }
    } finally {
      setLoading(false);
    }
  }, [candidate, sessionToken]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: sending || uploading ? "auto" : "smooth" });
  }, [messages, sending, uploading]);

  async function handleSend() {
    if (!sessionToken || !candidate || !input.trim()) return;
    const message = input.trim();
    const optimisticCreatedAt = new Date().toISOString();

    setSending(true);
    setError(null);
    setMessages((current) => [...current, { sender: "client", message, created_at: optimisticCreatedAt }]);

    try {
      await contactWidgetCandidate(sessionToken, candidate.candidate_id, message);
      setInput("");
      await loadThread();
    } catch {
      setMessages((current) =>
        current.filter(
          (entry) =>
            !(
              entry.sender === "client" &&
              entry.message === message &&
              entry.created_at === optimisticCreatedAt
            ),
        ),
      );
      setError("Couldn't send the message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleAttachmentSelected(file: File | null) {
    if (!sessionToken || !candidate || !file || uploading) return;
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

    const optimisticCreatedAt = new Date().toISOString();
    const optimisticText = `[Uploading attachment] ${file.name}`;
    setUploading(true);
    setMessages((current) => [
      ...current,
      { sender: "client", message: optimisticText, created_at: optimisticCreatedAt },
    ]);

    try {
      await contactWidgetCandidateAttachment(
        sessionToken,
        candidate.candidate_id,
        file,
        null,
        (percent) => setUploadPercent(percent),
      );
      await loadThread();
    } catch {
      setMessages((current) =>
        current.filter(
          (entry) =>
            !(
              entry.sender === "client" &&
              entry.message === optimisticText &&
              entry.created_at === optimisticCreatedAt
            ),
        ),
      );
      setUploadError("Couldn't upload attachment. Please try again.");
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  }

  if (!candidate || !sessionToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-zinc-50 px-4 py-6">
        <button
          onClick={() => router.push("/widget")}
          className="mb-4 flex w-fit items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">
            Chat is available after a widget conversation starts and a candidate is selected.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col bg-white text-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label="Go back"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">{candidate.name}</h1>
            <p className="text-xs text-zinc-500">{candidate.title}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/widget/candidate/${candidate.candidate_id}?view=schedule`)}
          className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          title="Schedule meeting"
          type="button"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages yet. Start the direct 1:1 conversation.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.created_at}-${index}`}
              className={
                message.sender === "client"
                  ? "ml-auto max-w-[80%] rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white"
                  : "mr-auto max-w-[80%] rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-900"
              }
            >
              {message.message?.trim() ? <p className="whitespace-pre-wrap">{message.message}</p> : null}
              <p className="mt-1 text-[10px] opacity-75">
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-zinc-200 px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            title="Add image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSend()}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || uploading || !input.trim()}
            className="rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50"
            title="Send message"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
        {uploading && <p className="mt-2 text-[11px] text-zinc-500">Uploading... {uploadPercent}%</p>}
        {uploadError && <p className="mt-2 text-[11px] text-rose-400">{uploadError}</p>}
        {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            void handleAttachmentSelected(e.target.files?.[0] ?? null);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleAttachmentSelected(e.target.files?.[0] ?? null);
            e.currentTarget.value = "";
          }}
        />
      </footer>
    </main>
  );
}
