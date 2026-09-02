"use client";

import type { CandidateCardPayload } from "@/lib/types";
import { CandidateSwipeCard } from "./CandidateSwipeCard";

interface CandidateDeckProps {
  cards: CandidateCardPayload[];
  currentIndex: number;
  loading: boolean;
  onSwipeLeft: (card: CandidateCardPayload) => void;
  onSwipeRight: (card: CandidateCardPayload) => void;
  onUndo?: () => void;
  onViewProfile?: (card: CandidateCardPayload) => void;
  shortlistedCandidateIds?: string[];
  align?: "center" | "start";
}

export function CandidateDeck({
  cards,
  currentIndex,
  loading,
  onSwipeLeft,
  onSwipeRight,
  onUndo,
  onViewProfile,
  shortlistedCandidateIds = [],
  align = "center",
}: CandidateDeckProps) {
  const currentCard = cards[currentIndex];
  if (!currentCard) return null;

  return (
    <CandidateSwipeCard
      card={currentCard}
      onSwipeLeft={() => onSwipeLeft(currentCard)}
      onSwipeRight={() => onSwipeRight(currentCard)}
      onViewProfile={onViewProfile ? () => onViewProfile(currentCard) : undefined}
      onUndo={onUndo}
      showUndo={currentIndex > 0}
      disabled={loading}
      isShortlisted={shortlistedCandidateIds.includes(currentCard.candidate_id)}
      align={align}
    />
  );
}
