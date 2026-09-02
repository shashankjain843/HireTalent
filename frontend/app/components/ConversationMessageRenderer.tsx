"use client";

import type { ChatMessage, QuestionCardPayload, SummaryCardPayload } from "@/lib/types";
import { ChatBubble } from "./ChatBubble";
import { QuestionCard } from "./QuestionCard";
import { SummaryCard } from "./SummaryCard";

interface ConversationMessageRendererProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendText: (text: string) => void;
  onConfirmSummary: () => void;
  onEditSummary: () => void;
  shouldSuppressQuestion?: (payload: QuestionCardPayload) => boolean;
  cardAlign?: "center" | "start";
}

function toDisplayText(message: ChatMessage): string | null {
  if (message.text?.trim()) return message.text;
  const payload = message.ui_payload;
  if (!payload) return null;
  if (payload.type === "question_card") {
    return payload.question;
  }
  if (payload.type === "summary_card") {
    if (!payload.fields.length) return "Please confirm the requirement summary.";
    const summary = payload.fields.map((field) => `${field.label}: ${field.value}`).join(", ");
    return `Summary: ${summary}`;
  }
  if (payload.type === "quick_reply_chips") {
    return payload.chips.map((chip) => chip.label).join(" / ");
  }
  return null;
}

export function ConversationMessageRenderer({
  messages,
  loading,
  onSendText,
  onConfirmSummary,
  onEditSummary,
  shouldSuppressQuestion,
  cardAlign = "center",
}: ConversationMessageRendererProps) {
  return messages.map((msg) => {
    if (msg.role === "user") {
      return (
        <ChatBubble key={msg.id} role="user">
          {msg.text}
        </ChatBubble>
      );
    }

    if (msg.role === "system") {
      return null;
    }

    if (msg.ui_payload?.type === "question_card") {
      const payload = msg.ui_payload as QuestionCardPayload;
      if (shouldSuppressQuestion?.(payload)) {
        return null;
      }
      const isLatest = messages.filter((m) => m.ui_payload?.type === "question_card").at(-1)?.id === msg.id;
      return (
        <QuestionCard
          key={msg.id}
          payload={payload}
          onAnswer={onSendText}
          onSkip={() => onSendText("skip")}
          disabled={loading || !isLatest}
          align={cardAlign}
        />
      );
    }

    if (msg.ui_payload?.type === "summary_card") {
      const payload = msg.ui_payload as SummaryCardPayload;
      const isLatest = messages.filter((m) => m.ui_payload?.type === "summary_card").at(-1)?.id === msg.id;
      return (
        <div key={msg.id} className="space-y-2">
          {msg.text && <ChatBubble role="assistant">{msg.text}</ChatBubble>}
          <SummaryCard
            payload={payload}
            onConfirm={onConfirmSummary}
            onEdit={onEditSummary}
            disabled={loading || !isLatest}
            align={cardAlign}
          />
        </div>
      );
    }

    if (msg.ui_payload?.type === "candidate_card") {
      return null;
    }

    const displayText = toDisplayText(msg);
    if (!displayText?.trim()) return null;
    return (
      <ChatBubble key={msg.id} role="assistant">
        {displayText}
      </ChatBubble>
    );
  });
}
