"use client";

import type { CandidateCardPayload } from "@/lib/types";
import { X } from "lucide-react";

interface CandidateProfileModalProps {
  candidate: CandidateCardPayload;
  onClose: () => void;
}

export function CandidateProfileModal({ candidate, onClose }: CandidateProfileModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">{candidate.name}</h3>
            <p className="text-sm text-zinc-500">{candidate.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 text-sm text-zinc-700 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-zinc-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Match score</p>
              <p className="font-medium">{Math.round(candidate.match_score)}%</p>
            </div>
            {candidate.experience_years != null && (
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Experience</p>
                <p className="font-medium">{candidate.experience_years} years</p>
              </div>
            )}
            {candidate.hourly_rate != null && (
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Rate</p>
                <p className="font-medium">${candidate.hourly_rate}/hr</p>
              </div>
            )}
            {candidate.availability && (
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <p className="text-xs text-zinc-500">Availability</p>
                <p className="font-medium">{candidate.availability}</p>
              </div>
            )}
          </div>

          {candidate.location && (
            <div>
              <p className="text-xs text-zinc-500">Location</p>
              <p className="font-medium text-zinc-900">{candidate.location}</p>
            </div>
          )}

          {candidate.skills.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-zinc-500">Skills</p>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span
                    key={skill.name}
                    className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {candidate.bio && (
            <div>
              <p className="text-xs text-zinc-500">Bio</p>
              <p className="leading-relaxed text-zinc-700">{candidate.bio}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-zinc-500">Why this match</p>
            <p className="leading-relaxed text-zinc-700">{candidate.match_reason}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
