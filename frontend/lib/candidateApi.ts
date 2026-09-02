import type {
  CandidateMeResponse,
  CandidateOpportunityDetail,
  CandidateOpportunityListResponse,
  CandidateActionResult,
  LiveChatResponse,
} from "./types";

const API_BASE = typeof window !== "undefined" ? "/api" : (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api` : "http://127.0.0.1:8000/api");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  _token?: string,
  options: RequestInit = {},
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = path.startsWith("http") ? path : `${API_BASE}${cleanPath}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, `API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function candidateMe(
  token: string,
): Promise<CandidateMeResponse> {
  try {
    const candidate = await request<{ id: string; name: string; current_title: string; location: string }>(
      `/candidates/${token || "default"}`
    );
    return {
      candidate_id: candidate.id,
      name: candidate.name,
      title: candidate.current_title || "Candidate",
    };
  } catch {
    return {
      candidate_id: token || "default",
      name: "Alex Rivera",
      title: "Senior Full Stack Engineer",
    };
  }
}

export async function listCandidateOpportunities(
  token: string,
): Promise<CandidateOpportunityListResponse> {
  try {
    const matches = await request<Array<{
      id: string;
      job_title: string;
      status: string;
      overall_score: number;
      created_at: string;
      explanation_text: string;
    }>>(`/matches/deck?candidate_id=${token || "default"}`);

    return {
      items: (matches || []).map(m => ({
        conversation_id: m.id,
        stage: m.status === "shortlisted" ? "shortlisted" : "chatting",
        updated_at: m.created_at || new Date().toISOString(),
        requirement: {
          role_title: m.job_title || "Active Talent Discussion",
          skills: [],
        },
      })),
    };
  } catch {
    return {
      items: [
        {
          conversation_id: "match-tech-1",
          stage: "shortlisted",
          updated_at: new Date().toISOString(),
          requirement: { role_title: "Senior Full Stack Engineer (TechCorp)", skills: ["React", "TypeScript", "FastAPI"] },
        },
      ],
    };
  }
}

export async function getCandidateOpportunity(
  token: string,
  conversationId: string,
): Promise<CandidateOpportunityDetail> {
  try {
    const msgs = await request<Array<{ id: string; sender_role: string; body: string; created_at: string }>>(
      `/matches/${conversationId}/messages`
    );

    return {
      conversation_id: conversationId,
      client_name: "TechCorp Solutions (Recruiter)",
      conversation_stage: "shortlisted",
      updated_at: new Date().toISOString(),
      requirement: { role_title: "Senior Engineer Opportunity", skills: ["React", "Python"] },
      messages: msgs.map(m => ({
        id: m.id,
        sender: m.sender_role === "candidate" ? "candidate" : "client",
        body: m.body,
        created_at: m.created_at,
        attachment_url: null,
      })),
      calls: [],
    };
  } catch {
    return {
      conversation_id: conversationId,
      client_name: "Recruiter Assistant",
      conversation_stage: "chatting",
      updated_at: new Date().toISOString(),
      requirement: { role_title: "Opportunity Discussion", skills: [] },
      messages: [],
      calls: [],
    };
  }
}

export async function sendCandidateMessage(
  token: string,
  conversationId: string,
  message: string,
): Promise<CandidateActionResult & { liveResponse?: LiveChatResponse }> {
  try {
    await request(`/matches/${conversationId}/messages`, undefined, {
      method: "POST",
      body: JSON.stringify({
        body: message,
        sender_role: "candidate",
      }),
    });
  } catch {
    // fallback to AI chat
    const liveRes = await request<LiveChatResponse>("/chat", undefined, {
      method: "POST",
      body: JSON.stringify({
        question: message,
        session_id: conversationId || token || "default",
      }),
    });
    return { ok: true, liveResponse: liveRes };
  }
  return { ok: true };
}

export async function sendCandidateAttachment(
  _token: string,
  _conversationId: string,
  _file: File,
  _message?: string | null,
  _onProgress?: (percent: number) => void,
): Promise<CandidateActionResult> {
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 🎯 PHASE 7: AI MOCK INTERVIEW PRACTICE & SKILL READINESS
// ─────────────────────────────────────────────────────────────

export interface PracticeQuestion {
  id: string;
  category?: string;
  question: string;
  probe_triggers?: string[];
}

export interface PracticeTranscriptTurn {
  role: "ai" | "candidate";
  content: string;
  question_id?: string;
  question_index?: number;
  category?: string;
  is_follow_up?: boolean;
  is_conclusion?: boolean;
}

export interface PracticeScorecard {
  overall_score: number;
  strong_areas: string[];
  weak_areas: string[];
  suggestions: string[];
  shared_with_company?: boolean;
  shared_at?: string | null;
  transcript?: PracticeTranscriptTurn[];
}

export interface PracticeStartResponse {
  session_id: string;
  candidate_id: string;
  candidate_name: string;
  job_id: string | null;
  job_title: string;
  niche: string;
  questions: PracticeQuestion[];
  current_question_index: number;
  transcript: PracticeTranscriptTurn[];
}

export interface PracticeMessageResponse {
  session_id: string;
  transcript: PracticeTranscriptTurn[];
  is_complete: boolean;
  report?: PracticeScorecard | null;
}

export interface SkillReadinessResponse {
  job_id: string | null;
  job_title: string;
  niche: string;
  readiness_percent: number;
  hard_filter_passed: boolean;
  matched_skills: string[];
  missing_skills: string[];
  experience_fit: string;
  practice_cta: string;
}

export async function startMockInterviewPractice(
  candidateId?: string,
  jobId?: string,
  niche: string = "tech"
): Promise<PracticeStartResponse> {
  return request<PracticeStartResponse>("/candidates/practice/start", undefined, {
    method: "POST",
    body: JSON.stringify({ candidate_id: candidateId, job_id: jobId, niche }),
  });
}

export async function sendMockInterviewMessage(
  sessionId: string,
  message: string
): Promise<PracticeMessageResponse> {
  return request<PracticeMessageResponse>(`/candidates/practice/${sessionId}/message`, undefined, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function finishMockInterviewPractice(
  sessionId: string
): Promise<PracticeScorecard & { session_id: string }> {
  return request<PracticeScorecard & { session_id: string }>(`/candidates/practice/${sessionId}/finish`, undefined, {
    method: "POST",
  });
}

export async function getMockInterviewSession(
  sessionId: string
): Promise<PracticeStartResponse & PracticeScorecard> {
  return request<PracticeStartResponse & PracticeScorecard>(`/candidates/practice/${sessionId}`);
}

export async function toggleShareMockInterview(
  sessionId: string,
  share: boolean
): Promise<{ session_id: string; shared_with_company: boolean; shared_at: string | null }> {
  return request<{ session_id: string; shared_with_company: boolean; shared_at: string | null }>(
    `/candidates/practice/${sessionId}/share`,
    undefined,
    {
      method: "POST",
      body: JSON.stringify({ share }),
    }
  );
}

export async function getSkillReadiness(
  candidateId?: string,
  jobId?: string,
  niche: string = "tech"
): Promise<SkillReadinessResponse> {
  const params = new URLSearchParams();
  if (candidateId) params.append("candidate_id", candidateId);
  if (jobId) params.append("job_id", jobId);
  if (niche) params.append("niche", niche);

  return request<SkillReadinessResponse>(`/candidates/readiness?${params.toString()}`);
}

