import type { CandidateCardPayload, ChatMessage } from "./types";

export function getCandidateCardsFromMessages(
  messages: ChatMessage[],
): CandidateCardPayload[] {
  const seen = new Set<string>();
  const candidates: CandidateCardPayload[] = [];

  for (const message of messages) {
    if (message.ui_payload?.type !== "candidate_card") continue;
    const candidate = message.ui_payload as CandidateCardPayload;
    if (seen.has(candidate.candidate_id)) continue;
    seen.add(candidate.candidate_id);
    candidates.push(candidate);
  }

  return candidates;
}

export function getKnownCandidates(
  shortlist: CandidateCardPayload[],
  messages: ChatMessage[],
): CandidateCardPayload[] {
  const seen = new Set<string>();
  const allCandidates = [...shortlist, ...getCandidateCardsFromMessages(messages)];

  return allCandidates.filter((candidate) => {
    if (seen.has(candidate.candidate_id)) return false;
    seen.add(candidate.candidate_id);
    return true;
  });
}

export function findCandidateById(
  candidateId: string,
  shortlist: CandidateCardPayload[],
  messages: ChatMessage[],
): CandidateCardPayload | null {
  return (
    getKnownCandidates(shortlist, messages).find(
      (candidate) => candidate.candidate_id === candidateId,
    ) ?? null
  );
}

export function getLatestCandidateBatch(
  messages: ChatMessage[],
): CandidateCardPayload[] {
  let lastCandidateIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].ui_payload?.type === "candidate_card") {
      lastCandidateIndex = i;
      break;
    }
  }

  if (lastCandidateIndex === -1) return [];

  let firstCandidateIndex = lastCandidateIndex;
  while (
    firstCandidateIndex > 0 &&
    messages[firstCandidateIndex - 1].ui_payload?.type === "candidate_card"
  ) {
    firstCandidateIndex -= 1;
  }

  return messages
    .slice(firstCandidateIndex, lastCandidateIndex + 1)
    .filter((message) => message.ui_payload?.type === "candidate_card")
    .map((message) => message.ui_payload as CandidateCardPayload);
}
