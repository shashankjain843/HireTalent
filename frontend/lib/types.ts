export type ConversationStage =
  | "collecting_requirements"
  | "asking_followups"
  | "confirming_requirements"
  | "showing_candidates"
  | "refining_results";

export type UIPayloadType =
  | "text"
  | "question_card"
  | "quick_reply_chips"
  | "candidate_card"
  | "summary_card";

export type SwipeDirection = "left" | "right" | "undo";
export type MessageRole = "user" | "assistant" | "system";

export interface QuickReplyOption {
  label: string;
  value: string;
}

export interface QuestionCardPayload {
  type: "question_card";
  field_key?: string | null;
  question: string;
  why?: string | null;
  options?: QuickReplyOption[] | null;
  multi_select?: boolean;
  allow_free_text: boolean;
  skippable: boolean;
}

export interface QuickReplyChipsPayload {
  type: "quick_reply_chips";
  chips: QuickReplyOption[];
}

export interface CandidateSkill {
  name: string;
  level?: string | null;
}

export interface CandidateCardPayload {
  type: "candidate_card";
  candidate_id: string;
  name: string;
  title: string;
  location?: string | null;
  skills: CandidateSkill[];
  experience_years?: number | null;
  hourly_rate?: number | null;
  availability?: string | null;
  match_score: number;
  match_reason: string;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface RequirementField {
  key: string;
  label: string;
  value: string;
  confidence?: number | null;
}

export interface SummaryCardPayload {
  type: "summary_card";
  fields: RequirementField[];
  overall_confidence: number;
}

export type UIPayload =
  | QuestionCardPayload
  | QuickReplyChipsPayload
  | CandidateCardPayload
  | SummaryCardPayload;

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  text?: string | null;
  ui_payload?: UIPayload | null;
  stage: ConversationStage;
  created_at: string;
}

export interface ConversationResponse {
  conversation_id: string;
  stage: ConversationStage;
  messages: ChatMessage[];
}

export interface ShortlistResponse {
  conversation_id: string;
  candidates: CandidateCardPayload[];
}

export interface CandidateContactResponse {
  status: string;
  note: string;
}

export interface DirectChatThreadResponse {
  conversation_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_title: string;
  messages: OutreachMessage[];
  calls: CandidateCallItem[];
}

export interface OutreachMessage {
  message?: string | null;
  created_at: string;
  sender?: "client" | "candidate";
  attachment_name?: string | null;
  attachment_url?: string | null;
  attachment_media_type?: string | null;
  attachment_size?: number | null;
  options?: string[] | null;
}

export interface CandidateCallItem {
  scheduled_for: string;
  timezone: string;
  duration_minutes: number;
  meeting_link?: string | null;
  note?: string | null;
  status: string;
}


/** Candidate portal (Bearer portal_token) */
export interface RequirementSnapshot {
  role_title?: string | null;
  skills: string[];
  seniority?: string | null;
  location_preference?: string | null;
  remote_ok?: boolean | null;
  budget_min?: number | null;
  budget_max?: number | null;
  availability?: string | null;
  project_duration?: string | null;
  additional_notes?: string | null;
  confidence?: number | null;
}

export interface CandidateOpportunitySummary {
  conversation_id: string;
  stage: string;
  updated_at: string;
  shortlisted_at?: string | null;
  requirement: RequirementSnapshot;
}

export interface CandidateOpportunityListResponse {
  items: CandidateOpportunitySummary[];
}

export interface CandidateOpportunityDetail {
  conversation_id: string;
  client_name: string;
  conversation_stage: string;
  updated_at: string;
  shortlisted_at?: string | null;
  requirement: RequirementSnapshot;
  messages: OutreachMessage[];
  calls: CandidateCallItem[];
}

export interface CandidateMeResponse {
  candidate_id: string;
  name: string;
  title: string;
}

export interface CandidateActionResult {
  ok: boolean;
  error?: string | null;
  stage?: string | null;
}

export interface WidgetSessionResponse {
  session_token: string;
  welcome_text: string;
}

export interface WidgetMessageResponse {
  conversation_id: string;
  messages: ChatMessage[];
}

export interface WidgetSwipeRequest {
  candidate_id: string;
  direction: SwipeDirection;
  reason?: string | null;
}

export interface WidgetAdminConfig {
  bot_id: string;
  name: string;
  welcome_text: string;
  primary_color: string;
  launcher_position: string;
  allowed_domains: string[];
  active_token_last4?: string | null;
}

export interface WidgetRotateTokenResponse {
  embed_token: string;
  last4: string;
}

export interface LiveChatResponse {
  message: string;
  options: string[];
}
