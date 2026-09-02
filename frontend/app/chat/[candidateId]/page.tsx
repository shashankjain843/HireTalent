"use client";

import { cn } from "@/lib/cn";
import {
  contactCandidate,
  contactCandidateAttachment,
  getDirectChatThread,
  initiateDirectChatThread,
} from "@/lib/api";
import { findCandidateById } from "@/lib/hiringCandidates";
import {
  DIRECT_CHAT_PING_INTERVAL_MS,
  DIRECT_CHAT_STALE_SOCKET_MS,
  getDirectThreadWebSocketUrl,
  getReconnectDelayMs,
} from "@/lib/realtime";
import { useChatStore } from "@/lib/store";
import type { OutreachMessage } from "@/lib/types";
import { ArrowLeft, Calendar, ImagePlus, Paperclip, SendHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DISALLOWED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dmg", ".apk", ".js"];

export default function ClientChatPage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const store = useChatStore();
  const candidateId = params.candidateId;
  const candidate = findCandidateById(candidateId, store.shortlist, store.messages);
  const conversationId = store.conversationId;

  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [composeSender, setComposeSender] = useState<"client" | "candidate">("client");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    if (!conversationId || !candidate) return;
    setLoading(true);
    setError(null);

    try {
      const thread = await initiateDirectChatThread(conversationId, candidate.candidate_id);
      setMessages(thread.messages);
    } catch {
      try {
        const thread = await getDirectChatThread(conversationId, candidate.candidate_id);
        setMessages(thread.messages);
      } catch (threadError) {
        setError(threadError instanceof Error ? threadError.message : "Could not load chat.");
      }
    } finally {
      setLoading(false);
    }
  }, [candidate, conversationId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: sending || uploading ? "auto" : "smooth" });
  }, [messages, sending, uploading]);

  useEffect(() => {
    if (!conversationId || !candidate) return;

    const wsUrl = getDirectThreadWebSocketUrl(conversationId, candidate.candidate_id);
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let staleTimer: number | null = null;
    let disposed = false;
    let reconnectAttempt = 0;

    const armStaleTimer = () => {
      if (staleTimer !== null) window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }, DIRECT_CHAT_STALE_SOCKET_MS);
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        reconnectAttempt += 1;
        connectSocket();
      }, getReconnectDelayMs(reconnectAttempt));
    };

    const connectSocket = () => {
      if (disposed) return;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectAttempt = 0;
        armStaleTimer();
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, DIRECT_CHAT_PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        armStaleTimer();
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          if (payload.type !== "direct_thread_updated") return;
        } catch {
          return;
        }
        void loadThread();
      };

      socket.onclose = () => {
        if (pingTimer !== null) window.clearInterval(pingTimer);
        if (staleTimer !== null) window.clearTimeout(staleTimer);
        pingTimer = null;
        staleTimer = null;
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connectSocket();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (staleTimer !== null) window.clearTimeout(staleTimer);
      socket?.close();
    };
  }, [candidate, conversationId, loadThread]);

  const isSendingRef = useRef(false);

  async function handleSend() {
    if (!conversationId || !candidate || !input.trim() || sending || isSendingRef.current) return;
    const message = input.trim();
    
    isSendingRef.current = true;
    const optimisticCreatedAt = new Date().toISOString();

    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { sender: "client", message, created_at: optimisticCreatedAt },
    ]);

    try {
      await contactCandidate(conversationId, candidate.candidate_id, message, composeSender);
      setInput("");
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
      isSendingRef.current = false;
    }
  }

  async function handleAttachmentSelected(file: File | null) {
    if (!conversationId || !candidate || !file || uploading) return;
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
      await contactCandidateAttachment(
        conversationId,
        candidate.candidate_id,
        file,
        null,
        composeSender,
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

  if (!candidate || !conversationId) {
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
            Chat is only available after starting a client conversation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">{candidate.name}</h1>
            <p className="text-xs text-zinc-400">{candidate.title}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/client-profile/${candidate.candidate_id}?view=schedule`)}
          className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800"
          title="Schedule meeting"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading conversation...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-400">No messages yet. Start the direct 1:1 conversation.</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.created_at}-${index}`}
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                message.sender === "client"
                  ? "ml-auto bg-indigo-600 text-white"
                  : "mr-auto bg-zinc-800 text-zinc-100",
              )}
            >
              {message.message?.trim() ? (
                <p className="whitespace-pre-wrap">{message.message}</p>
              ) : null}
              {message.attachment_url && message.attachment_name ? (
                <>
                  {message.attachment_media_type?.startsWith("image/") ? (
                    <a href={message.attachment_url} target="_blank" rel="noreferrer">
                      <img
                        src={message.attachment_url}
                        alt={message.attachment_name}
                        className="mt-2 max-h-48 rounded-lg border border-white/20 object-cover"
                      />
                    </a>
                  ) : null}
                  <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block rounded-lg bg-black/20 px-2.5 py-1.5 text-xs underline"
                  >
                    {message.attachment_media_type?.startsWith("image/")
                      ? "Open image: "
                      : "Attachment: "}
                    {message.attachment_name}
                  </a>
                </>
              ) : null}
              <p className="mt-1 text-[10px] opacity-75">
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-zinc-700 p-0.5 text-[11px] text-zinc-300">
            <button
              type="button"
              onClick={() => setComposeSender("client")}
              className={`rounded-full px-2 py-0.5 ${
                composeSender === "client" ? "bg-indigo-600 text-white" : "text-zinc-300"
              }`}
            >
              As Client
            </button>
            <button
              type="button"
              onClick={() => setComposeSender("candidate")}
              className={`rounded-full px-2 py-0.5 ${
                composeSender === "candidate" ? "bg-indigo-600 text-white" : "text-zinc-300"
              }`}
            >
              As Candidate
            </button>
          </div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.repeat && !sending) {
                e.preventDefault();
                void handleSend();
              }
            }}
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
          <p className="mt-2 text-[11px] text-zinc-400">Uploading... {uploadPercent}%</p>
        )}
        <p className="mt-2 text-[11px] text-zinc-400">
          Sending as: {composeSender === "candidate" ? "Candidate (proxy reply)" : "Client"}
        </p>
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
