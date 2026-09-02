from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

# ── Auth & Users ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    company_name: Optional[str] = None
    role: str = "admin"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    tenant_id: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserResponse

class TenantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: str = "standard"
    settings: Optional[Dict[str, Any]] = None
    status: str = "active"
    created_at: Optional[datetime] = None

class TenantCreate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    plan: Optional[str] = "standard"

# ── Candidate Schemas ────────────────────────────────────────────────────────

class CandidateCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = "Candidate"
    department: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    current_location: Optional[str] = "Remote"
    availability: Optional[str] = "Immediate"
    years_of_experience: Optional[float] = 0.0
    hourly_rate: Optional[float] = None
    salary_expectation: Optional[float] = None
    skills: List[Any] = []
    source: Optional[str] = "direct"
    niche_data: Optional[Dict[str, Any]] = None
    consent_granted: Optional[bool] = True
    consent_granted_at: Optional[datetime] = None
    consent_type: Optional[str] = "data_processing_and_storage"
    lifecycle_status: Optional[str] = "Active Employee"
    talent_pool: Optional[str] = None
    is_internal_candidate: Optional[bool] = False

class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    current_location: Optional[str] = None
    availability_status: Optional[str] = None
    years_of_experience: Optional[float] = None
    hourly_rate: Optional[float] = None
    skills: Optional[List[Any]] = None
    expertise: Optional[List[str]] = None
    niche_data: Optional[Dict[str, Any]] = None
    lifecycle_status: Optional[str] = None
    talent_pool: Optional[str] = None
    is_internal_candidate: Optional[bool] = None
    is_active: Optional[bool] = None
    send_invite_email: Optional[bool] = False

class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    current_location: Optional[str] = None
    availability_status: Optional[str] = None
    availability: Optional[str] = None
    years_of_experience: Optional[float] = None
    hourly_rate: Optional[float] = None
    skills: List[Any] = []
    expertise: List[str] = []
    source: Optional[str] = "chat"
    resume_file_ref: Optional[str] = None
    parsing_confidence: Optional[float] = 1.0
    niche_data: Optional[Dict[str, Any]] = None
    consent_granted: bool = True
    consent_granted_at: Optional[datetime] = None
    consent_type: Optional[str] = "data_processing_and_storage"
    lifecycle_status: str = "Active Employee"
    talent_pool: Optional[str] = None
    is_internal_candidate: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None

# ── Job Schemas ──────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    niche: Optional[str] = "tech"
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    experience_min_years: Optional[float] = 0.0
    experience_max_years: Optional[float] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location_preference: Optional[str] = "Remote"
    remote_ok: Optional[bool] = True
    creation_source: Optional[str] = "manual"
    raw_jd_text: Optional[str] = None
    niche_criteria: Optional[Dict[str, Any]] = None
    status: Optional[str] = "published"

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    niche: Optional[str] = None
    must_have_skills: Optional[List[str]] = None
    nice_to_have_skills: Optional[List[str]] = None
    experience_min_years: Optional[float] = None
    experience_max_years: Optional[float] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location_preference: Optional[str] = None
    remote_ok: Optional[bool] = None
    status: Optional[str] = None

class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    owner_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    niche: str = "tech"
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    experience_min_years: Optional[float] = 0.0
    experience_max_years: Optional[float] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location_preference: Optional[str] = None
    remote_ok: bool = True
    creation_source: str = "manual"
    status: str = "published"
    niche_criteria: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class JDExtractRequest(BaseModel):
    jd_text: str

# ── Match & Swipe Schemas ───────────────────────────────────────────────────

class SwipeRequest(BaseModel):
    candidate_id: Optional[str] = None
    match_id: Optional[str] = None
    direction: str
    reason: Optional[str] = None

class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    candidate_id: str
    job_id: str
    hard_filter_passed: bool
    ai_score: float
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    experience_fit: Optional[str] = None
    semantic_notes: Optional[str] = None
    niche_notes: Optional[str] = None
    explanation: str
    status: str
    candidate: Optional[CandidateResponse] = None
    job: Optional[JobResponse] = None
    created_at: Optional[datetime] = None

# ── Interview Schemas ────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    match_id: Optional[str] = None
    candidate_id: str
    job_id: Optional[str] = None
    scheduled_for: datetime
    timezone: Optional[str] = "UTC"
    duration_minutes: Optional[int] = 45
    meeting_link: Optional[str] = None
    note: Optional[str] = None

class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    match_id: Optional[str] = None
    candidate_id: str
    job_id: Optional[str] = None
    scheduled_for: datetime
    timezone: str = "UTC"
    duration_minutes: int = 45
    meeting_link: Optional[str] = None
    note: Optional[str] = None
    status: str = "scheduled"
    created_at: Optional[datetime] = None

# ── Message Schemas (Match-scoped recruiter<->candidate thread) ──────────────

class MessageCreate(BaseModel):
    body: str
    sender_role: Optional[str] = "recruiter"  # "recruiter", "candidate"
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    match_id: str
    sender_id: Optional[str] = None
    sender_role: str = "recruiter"
    body: str
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: Optional[datetime] = None

# ── Notification Schemas ────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: Optional[str] = None
    type: str
    channel: str
    title: str
    message: str
    status: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    created_at: Optional[datetime] = None

# ── Analytics Schemas ────────────────────────────────────────────────────────

class FunnelStageMetric(BaseModel):
    stage: str
    count: int
    conversion_pct: float

class HiringFunnelResponse(BaseModel):
    total_candidates: int
    hard_filter_passed: int
    shortlisted: int
    interviewing: int
    hired: int
    rejected: int
    funnel: List[FunnelStageMetric]
    avg_time_to_hire_days: float
    source_effectiveness: Dict[str, int]
    niche_breakdown: Dict[str, int]
