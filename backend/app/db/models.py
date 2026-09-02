import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Enum,
)
from sqlalchemy.orm import relationship
from app.db.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    logo_url = Column(String(512), nullable=True)
    plan = Column(String(50), default="standard")
    settings = Column(JSON, nullable=True, default=dict)
    status = Column(String(50), default="active")  # active, suspended, trial
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    candidates = relationship("Candidate", back_populates="tenant", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="tenant", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="tenant", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="tenant", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="tenant", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="admin")  # superadmin, admin, editor, candidate
    is_active = Column(Boolean, default=True)
    portal_token = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    tenant = relationship("Tenant", back_populates="users")
    jobs = relationship("Job", back_populates="owner")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    current_location = Column(String(255), nullable=True)
    availability = Column(String(100), default="Immediate")
    years_of_experience = Column(Float, nullable=True, default=0.0)
    hourly_rate = Column(Float, nullable=True)
    salary_expectation = Column(Float, nullable=True)
    
    # Skills stored as structured JSON: [{"name": "React", "level": "Senior", "category": "Frontend"}]
    skills = Column(JSON, default=list)
    
    # Dual-intake metadata
    source = Column(String(50), default="chat")  # "chat", "bulk_upload", "direct", "manual"
    resume_file_ref = Column(String(512), nullable=True)
    parsing_confidence = Column(Float, default=1.0)
    raw_transcript = Column(Text, nullable=True)
    candidate_notes = Column(Text, nullable=True)
    
    # Niche-specific structured fields (Tech vs Sales)
    # Tech: github_url, portfolio_url, tech_stack_breakdown
    # Sales: quota_attainment, deal_size_range, sales_cycle_months, vertical_experience, communication_score
    niche_data = Column(JSON, default=dict)

    # Candidate explicit data consent tracking (GDPR/Compliance)
    consent_granted = Column(Boolean, default=True, nullable=False)
    consent_granted_at = Column(DateTime(timezone=True), default=get_utc_now)
    consent_type = Column(String(100), default="data_processing_and_storage")

    # Lifecycle & Employee roster mapping
    lifecycle_status = Column(String(50), default="Active Employee")  # "Active Employee", "Internal Candidate", "Inactive"
    talent_pool = Column(String(100), nullable=True)
    is_internal_candidate = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    tenant = relationship("Tenant", back_populates="candidates")
    matches = relationship("Match", back_populates="candidate", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    niche = Column(String(50), default="tech")  # "tech", "sales"
    
    # Must-have skills for hard filtering (strict: failure excludes candidate)
    must_have_skills = Column(JSON, default=list)  # ["React", "TypeScript"]
    nice_to_have_skills = Column(JSON, default=list)  # ["Next.js", "TailwindCSS"]
    
    experience_min_years = Column(Float, default=0.0)
    experience_max_years = Column(Float, nullable=True)
    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    location_preference = Column(String(255), nullable=True)
    remote_ok = Column(Boolean, default=True)
    
    # Dual-intake source
    creation_source = Column(String(50), default="manual")  # "manual", "ai_extracted", "chat"
    raw_jd_text = Column(Text, nullable=True)

    # Niche-specific criteria configuration
    # e.g. {"min_quota_attainment": 100, "deal_size_tier": "Enterprise", "target_verticals": ["SaaS"]}
    niche_criteria = Column(JSON, default=dict)

    status = Column(String(50), default="published")  # "draft", "published", "archived", "closed"
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    tenant = relationship("Tenant", back_populates="jobs")
    owner = relationship("User", back_populates="jobs")
    matches = relationship("Match", back_populates="job", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="job", cascade="all, delete-orphan")


class Match(Base):
    __tablename__ = "matches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Hard filter check (strict flag)
    hard_filter_passed = Column(Boolean, default=True, nullable=False)

    # AI Ranking score (0 - 100)
    ai_score = Column(Float, default=0.0, nullable=False)

    # Structured explainability breakdown
    matched_skills = Column(JSON, default=list)
    missing_skills = Column(JSON, default=list)
    experience_fit = Column(String(255), nullable=True)
    semantic_notes = Column(Text, nullable=True)
    niche_notes = Column(Text, nullable=True)
    
    # MANDATORY: Human-readable 2-3 line plain-text explanation
    explanation = Column(Text, nullable=False)

    # Hiring pipeline state
    # pending -> shortlisted / rejected -> interviewing -> hired
    status = Column(String(50), default="pending", index=True)
    rejection_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    tenant = relationship("Tenant", back_populates="matches")
    candidate = relationship("Candidate", back_populates="matches")
    job = relationship("Job", back_populates="matches")
    interviews = relationship("Interview", back_populates="match", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="match", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    match_id = Column(String(36), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String(36), nullable=True)
    sender_role = Column(String(50), default="recruiter")  # "recruiter", "candidate"
    body = Column(Text, nullable=False)
    attachment_name = Column(String(255), nullable=True)
    attachment_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    match = relationship("Match", back_populates="messages")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    match_id = Column(String(36), ForeignKey("matches.id", ondelete="CASCADE"), nullable=True)
    candidate_id = Column(String(36), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True)

    scheduled_for = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(100), default="UTC")
    duration_minutes = Column(Integer, default=45)
    meeting_link = Column(String(512), nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(50), default="scheduled")  # scheduled, completed, cancelled

    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    tenant = relationship("Tenant", back_populates="interviews")
    match = relationship("Match", back_populates="interviews")
    candidate = relationship("Candidate", back_populates="interviews")
    job = relationship("Job", back_populates="interviews")


class InterviewPracticeSession(Base):
    __tablename__ = "interview_practice_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    niche = Column(String(50), default="tech")  # Denormalized at time of session
    transcript = Column(JSON, default=list)  # Structured Q&A turns
    overall_score = Column(Float, nullable=True)  # 0-100
    strong_areas = Column(JSON, default=list)  # ["Clear structured answer on prior project ownership"]
    weak_areas = Column(JSON, default=list)  # ["Vague on Kubernetes scaling..."]
    suggestions = Column(JSON, default=list)  # ["Prepare one concrete story about handling a production incident"]
    shared_with_company = Column(Boolean, default=False, nullable=False)
    shared_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    candidate = relationship("Candidate", backref="practice_sessions")
    job = relationship("Job", backref="practice_sessions")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    recipient_id = Column(String(36), nullable=True)
    recipient_email = Column(String(255), nullable=True)
    recipient_phone = Column(String(50), nullable=True)
    
    type = Column(String(100), nullable=False)  # shortlist_alert, interview_scheduled, status_update
    channel = Column(String(50), default="in_app")  # in_app, email, sms
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="unread")  # unread, read, sent, failed

    related_entity_type = Column(String(50), nullable=True)  # candidate, match, interview, job
    related_entity_id = Column(String(36), nullable=True)

    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    tenant = relationship("Tenant", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(36), nullable=True)
    actor_name = Column(String(255), nullable=True)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE_JOB, SHORTLIST_CANDIDATE, REJECT_CANDIDATE, etc.
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=True)
    changes = Column(JSON, nullable=True)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    tenant = relationship("Tenant", back_populates="audit_logs")


# ─────────────────────────────────────────────────────────────
# 🏢 ADMIN CONSOLE SUPPORT ENTITIES (Actions, Playbooks, Categories, KB, Policies)
# ─────────────────────────────────────────────────────────────

class Action(Base):
    __tablename__ = "actions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    category_id = Column(String(36), nullable=True)
    playbook_id = Column(String(36), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prompt_template = Column(Text, nullable=True)
    input_schema_json = Column(JSON, nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_pinned = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    click_count = Column(Integer, default=0)
    status = Column(String(50), default="published")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)


class Playbook(Base):
    __tablename__ = "playbooks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    version = Column(Integer, default=1)
    status = Column(String(50), default="published")
    config_json = Column(JSON, default=dict)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    parent_id = Column(String(36), nullable=True)
    path = Column(String(512), default="/")
    depth = Column(Integer, default=0)
    color_token = Column(String(50), nullable=True)
    icon_key = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    auto_categorization_enabled = Column(Boolean, default=False)
    auto_categorization_keywords = Column(JSON, default=list)
    auto_categorization_threshold = Column(Float, default=0.7)
    visibility_matrix = Column(JSON, default=list)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)


class CategoryPolicy(Base):
    __tablename__ = "category_policies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String(36), nullable=False)
    version = Column(Integer, default=1)
    system_instructions = Column(Text, default="")
    retrieval_top_k = Column(Integer, default=4)
    min_score = Column(Float, nullable=True)
    source_priority = Column(JSON, nullable=True)
    citation_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50), default="file")  # file, url, text
    connector_kind = Column(String(50), nullable=True)
    sync_frequency = Column(String(50), default="manual")
    source_url = Column(String(512), nullable=True)
    status = Column(String(50), default="indexed")
    chunk_count = Column(Integer, default=0)
    last_synced_at = Column(DateTime(timezone=True), default=get_utc_now)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    chunks = relationship("KnowledgeChunk", back_populates="source", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, default=0)
    chunk_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    source = relationship("KnowledgeSource", back_populates="chunks")


class SkillTemplate(Base):
    __tablename__ = "skill_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    skill_type = Column(String(100), nullable=False)
    default_config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    last_updated_at = Column(DateTime(timezone=True), default=get_utc_now)
    last_updated_by = Column(String(255), nullable=True)


class SkillConfig(Base):
    __tablename__ = "skill_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(String(36), nullable=False)
    template_name = Column(String(255), nullable=True)
    template_description = Column(Text, nullable=True)
    skill_type = Column(String(100), nullable=True)
    config_overrides = Column(JSON, default=dict)
    default_config = Column(JSON, default=dict)
    is_enabled = Column(Boolean, default=True)
    status = Column(String(50), default="Stable")
    icon_key = Column(String(50), default="skill")
    tooltip = Column(String(255), nullable=True)
    api_consumption_30d = Column(Integer, default=0)
    success_rate_30d = Column(Float, default=100.0)
    avg_latency_ms_30d = Column(Float, default=240.0)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    rule_type = Column(String(100), nullable=False)
    config = Column(JSON, default=dict)
    is_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)


class PolicyViolation(Base):
    __tablename__ = "policy_violations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_rule_id = Column(String(36), nullable=True)
    skill_run_id = Column(String(36), nullable=True)
    violation_type = Column(String(100), nullable=False)
    severity = Column(String(50), default="medium")
    message = Column(Text, nullable=False)
    resource_type = Column(String(100), default="Candidate")
    resource_id = Column(String(36), nullable=True)
    deep_link_path = Column(String(255), default="/company-admin")
    details = Column(JSON, default=dict)
    enforcement_applied = Column(String(50), default="warn")
    created_at = Column(DateTime(timezone=True), default=get_utc_now)


class WidgetConfig(Base):
    __tablename__ = "widget_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    bot_id = Column(String(100), default="talent_iq_bot")
    name = Column(String(255), default="HireTalentIQ Assistant")
    welcome_text = Column(Text, default="Hi! I am your AI Talent Assistant. How can I help you find or apply for roles today?")
    primary_color = Column(String(50), default="#4f46e5")
    launcher_position = Column(String(50), default="right")
    allowed_domains = Column(JSON, default=lambda: ["*"])
    embed_token = Column(String(255), default=generate_uuid)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)
