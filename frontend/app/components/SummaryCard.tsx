"use client";

import { cn } from "@/lib/cn";
import type { SummaryCardPayload } from "@/lib/types";
import { motion } from "framer-motion";
import { CheckCircle2, Pencil } from "lucide-react";

interface SummaryCardProps {
  payload: SummaryCardPayload;
  onConfirm: () => void;
  onEdit: () => void;
  disabled?: boolean;
  align?: "center" | "start";
}

export function SummaryCard({
  payload,
  onConfirm,
  onEdit,
  disabled,
  align = "center",
}: SummaryCardProps) {
  const visibleFields = payload.fields.filter((field) => field.key !== "additional_notes");

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
          <div className="mb-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Requirement Summary
            </h3>
          </div>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Your answers:
          </p>

          <div className="space-y-2">
            {visibleFields.map((field) => (
              <div
                key={field.key}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-zinc-500 dark:text-zinc-400 shrink-0">
                  {field.label}
                </span>
                <span className="text-zinc-900 dark:text-zinc-100 text-right font-medium">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-3 flex items-center gap-3">
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium",
              "bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50",
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            Looks good, find candidates
          </button>
          <button
            onClick={onEdit}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
              "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300",
              "hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50",
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>
    </motion.div>
  );
}
