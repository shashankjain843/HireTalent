"use client";

import { cn } from "@/lib/cn";
import type { CandidateCardPayload } from "@/lib/types";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  Briefcase,
  Clock,
  DollarSign,
  MapPin,
  Star,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from "lucide-react";
import { useState } from "react";

interface CandidateSwipeCardProps {
  card: CandidateCardPayload;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onViewProfile?: () => void;
  onUndo?: () => void;
  showUndo?: boolean;
  disabled?: boolean;
  isShortlisted?: boolean;
  align?: "center" | "start";
}

const SWIPE_THRESHOLD = 100;
const TUTORIAL_KEY = "swipe-tutorial-dismissed";

function SwipeTutorialOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 rounded-2xl bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-6"
    >
      <div className="flex items-center gap-8">
        <motion.div
          animate={{ x: [0, -30, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <div className="rounded-full bg-red-500/20 p-3">
            <ThumbsDown className="w-6 h-6 text-red-400" />
          </div>
          <span className="text-xs font-medium text-red-300">Swipe Left</span>
          <span className="text-[11px] text-zinc-400">Reject</span>
        </motion.div>

        <div className="w-px h-16 bg-zinc-600" />

        <motion.div
          animate={{ x: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <div className="rounded-full bg-green-500/20 p-3">
            <ThumbsUp className="w-6 h-6 text-green-400" />
          </div>
          <span className="text-xs font-medium text-green-300">Swipe Right</span>
          <span className="text-[11px] text-zinc-400">Shortlist</span>
        </motion.div>
      </div>

      <button
        onClick={onDismiss}
        className="rounded-lg bg-white/10 px-6 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
      >
        Got it
      </button>
    </motion.div>
  );
}

export function CandidateSwipeCard({
  card,
  onSwipeLeft,
  onSwipeRight,
  onViewProfile,
  onUndo,
  showUndo,
  disabled,
  isShortlisted,
  align = "center",
}: CandidateSwipeCardProps) {
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY);
    } catch {
      return false;
    }
  });

  const dismissTutorial = () => {
    setShowTutorial(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const leftOpacity = useTransform(x, [-150, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, 150], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (disabled) return;
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipeLeft();
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipeRight();
    }
  };

  const initials = card.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const rating = Math.max(1, Math.min(5, (card.match_score / 100) * 5));
  const roundedRating = rating.toFixed(1);

  return (
    <div
      className={cn(
        "relative w-full",
        align === "center" ? "max-w-sm mx-auto" : "max-w-[85%] mr-auto",
      )}
    >
      <AnimatePresence>
        {showTutorial && <SwipeTutorialOverlay onDismiss={dismissTutorial} />}
      </AnimatePresence>

      {!showTutorial && !isShortlisted && (
        <div className="flex items-center justify-between px-5 py-1.5 text-[11px] text-zinc-500">
          <span>&larr; Reject</span>
          <span>Shortlist &rarr;</span>
        </div>
      )}

      <motion.div
        style={{ x, rotate }}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        whileDrag={{ cursor: "grabbing" }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden cursor-grab select-none"
      >
        {/* Swipe overlays */}
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-0 bg-red-500/10 z-10 flex items-center justify-center pointer-events-none"
        >
          <div className="rounded-full bg-red-100 dark:bg-red-900/40 p-4">
            <ThumbsDown className="w-8 h-8 text-red-500" />
          </div>
        </motion.div>
        <motion.div
          style={{ opacity: rightOpacity }}
          className="absolute inset-0 bg-green-500/10 z-10 flex items-center justify-center pointer-events-none"
        >
          <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-4">
            <ThumbsUp className="w-8 h-8 text-green-500" />
          </div>
        </motion.div>

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-5 pt-5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {initials}
            </div>
            <div>
              <h4 className="text-white font-semibold text-base">{card.name}</h4>
              <p className="text-indigo-100 text-sm">{card.title}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <div
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                card.match_score >= 80
                  ? "bg-green-400/20 text-green-100"
                  : card.match_score >= 60
                    ? "bg-amber-400/20 text-amber-100"
                    : "bg-red-400/20 text-red-100",
              )}
            >
              {Math.round(card.match_score)}% match
            </div>
            <div className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
              {roundedRating}/5 rating
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {card.location && (
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <MapPin className="w-3.5 h-3.5" />
                {card.location}
              </div>
            )}
            {card.experience_years != null && (
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <Briefcase className="w-3.5 h-3.5" />
                {card.experience_years}y exp
              </div>
            )}
            {card.hourly_rate != null && (
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <DollarSign className="w-3.5 h-3.5" />
                ${card.hourly_rate}/hr
              </div>
            )}
            {card.availability && (
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                {card.availability}
              </div>
            )}
          </div>

          {card.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.skills.map((skill) => (
                <span
                  key={skill.name}
                  className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          )}

          {/* AI Explainability Box */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              AI Match Insights & Explanation
            </div>
            <p className="text-xs text-indigo-950/80 dark:text-indigo-200/90 leading-relaxed font-normal">
              {card.match_reason}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-3 space-y-2">
          {onViewProfile && (
            <button
              onClick={onViewProfile}
              disabled={disabled}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              View Profile
            </button>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onSwipeLeft}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <ThumbsDown className="w-4 h-4" />
              Skip
            </button>

            {showUndo && onUndo && (
              <button
                onClick={onUndo}
                disabled={disabled}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </button>
            )}

            <button
              onClick={onSwipeRight}
              disabled={disabled || isShortlisted}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="w-4 h-4" />
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
