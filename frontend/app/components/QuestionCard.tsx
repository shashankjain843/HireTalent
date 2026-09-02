"use client";

import { cn } from "@/lib/cn";
import type { QuestionCardPayload } from "@/lib/types";
import { motion } from "framer-motion";
import { HelpCircle, SkipForward } from "lucide-react";
import { useState } from "react";

interface QuestionCardProps {
  payload: QuestionCardPayload;
  onAnswer: (value: string) => void;
  onSkip: () => void;
  disabled?: boolean;
  align?: "center" | "start";
}

export function QuestionCard({
  payload,
  onAnswer,
  onSkip,
  disabled,
  align = "center",
}: QuestionCardProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const isMultiSelect = payload.multi_select ?? payload.field_key === "skills";

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onAnswer(trimmed);
      setInputValue("");
    }
  };

  const toggleSelection = (value: string) => {
    setSelectedValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const submitSelectedOptions = () => {
    if (selectedValues.length === 0) return;
    onAnswer(selectedValues.join(", "));
    setSelectedValues([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "w-full",
        align === "center" ? "max-w-md mx-auto" : "max-w-[85%] mr-auto",
      )}
    >
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-md overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {payload.question}
          </h3>
          {payload.why && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {payload.why}
            </p>
          )}
        </div>

        {payload.options && payload.options.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {payload.options.map((opt) => (
              <button
                key={opt.value}
                disabled={disabled}
                onClick={() =>
                  isMultiSelect ? toggleSelection(opt.value) : onAnswer(opt.value)
                }
                className={cn(
                  "rounded-full border border-indigo-200 dark:border-indigo-700 px-3.5 py-1.5 text-sm",
                  "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                  isMultiSelect && selectedValues.includes(opt.value)
                    ? "bg-indigo-100 dark:bg-indigo-900/50"
                    : "",
                  "transition-colors disabled:opacity-50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {isMultiSelect && payload.options && payload.options.length > 0 && (
          <div className="px-5 pb-4">
            <button
              onClick={submitSelectedOptions}
              disabled={disabled || selectedValues.length === 0}
              className={cn(
                "w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white",
                "hover:bg-indigo-700 transition-colors disabled:opacity-50",
              )}
            >
              Send selected options
            </button>
          </div>
        )}

        {payload.allow_free_text && (
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={disabled}
                placeholder="Type your answer..."
                className={cn(
                  "flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm",
                  "bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
                  "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  "disabled:opacity-50",
                )}
              />
              <button
                onClick={handleSubmit}
                disabled={disabled || !inputValue.trim()}
                className={cn(
                  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white",
                  "hover:bg-indigo-700 transition-colors disabled:opacity-50",
                )}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {payload.skippable && (
          <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-2.5">
            <button
              onClick={onSkip}
              disabled={disabled}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip this question
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
