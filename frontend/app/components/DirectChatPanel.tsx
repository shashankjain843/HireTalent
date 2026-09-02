"use client";

import { cn } from "@/lib/cn";
import type { CandidateCardPayload, OutreachMessage } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ImagePlus, Paperclip, SendHorizontal, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

interface DirectChatPanelProps {
  candidate: CandidateCardPayload | null;
  open: boolean;
  messages: OutreachMessage[];
  loading?: boolean;
  onClose: () => void;
  onScheduleMeeting: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onSendAttachment: (file: File, onProgress: (percent: number) => void) => Promise<void>;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DISALLOWED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dmg", ".apk", ".js"];

export function DirectChatPanel({
  candidate,
  open,
  messages,
  loading,
  onClose,
  onScheduleMeeting,
  onSendMessage,
  onSendAttachment,
}: DirectChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const normalizedMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          Boolean(m.message?.trim().length) ||
          Boolean(m.attachment_url && m.attachment_name),
      ),
    [messages],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const nextCount = normalizedMessages.length;
    const behavior = sending || uploading ? "auto" : "smooth";
    endOfMessagesRef.current?.scrollIntoView({ behavior, block: "end" });
    prevMessageCountRef.current = nextCount;
  }, [normalizedMessages, open, loading, sending, uploading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSendMessage(text);
      setInput("");
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentSelected = async (file: File | null) => {
    if (!file || uploading) return;
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
    setUploadPercent(0);
    try {
      await onSendAttachment(file, (percent) => setUploadPercent(percent));
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  };

  return (
    <AnimatePresence>
      {open && candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="fixed bottom-0 left-1/2 z-[80] flex h-[90vh] w-full max-w-lg -translate-x-1/2 flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">{candidate.name}</h3>
                <p className="text-xs text-zinc-400">{candidate.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onScheduleMeeting}
                  className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  title="Schedule meeting"
                >
                  <Calendar className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  title="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loading ? (
                <p className="text-sm text-zinc-400">Loading conversation...</p>
              ) : normalizedMessages.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  No messages yet. Start the direct 1:1 conversation.
                </p>
              ) : (
                normalizedMessages.map((m, idx) => (
                  <div
                    key={`${m.created_at}-${idx}`}
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                      m.sender === "client"
                        ? "ml-auto bg-indigo-600 text-white"
                        : "mr-auto bg-zinc-800 text-zinc-100",
                    )}
                  >
                    {m.message?.trim() ? (
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    ) : null}
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
                          className="mt-1 block rounded-lg bg-black/20 px-2.5 py-1.5 text-xs underline"
                        >
                          {m.attachment_media_type?.startsWith("image/")
                            ? "Open image: "
                            : "Attachment: "}
                          {m.attachment_name}
                        </a>
                      </>
                    ) : null}
                    <p className="mt-1 text-[10px] opacity-75">
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
              <div ref={endOfMessagesRef} />
            </div>

            <footer className="border-t border-zinc-700 px-3 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
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
              {uploading && (
                <div className="mt-2">
                  <div className="h-1.5 w-full rounded-full bg-zinc-800">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Uploading... {uploadPercent}%
                  </p>
                </div>
              )}
              {uploadError && (
                <p className="mt-2 text-[11px] text-rose-400">{uploadError}</p>
              )}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

