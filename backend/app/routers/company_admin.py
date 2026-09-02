from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User, Tenant, Action, Playbook, Category, KnowledgeSource,
    KnowledgeChunk, SkillConfig, WidgetConfig, AuditLog, Candidate,
    InterviewPracticeSession
)
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user
from app.schemas.domain import LoginRequest, TokenResponse, UserResponse
from app.routers.candidates import map_candidate_to_response

router = APIRouter(prefix="/company", tags=["Company Admin Console"])

@router.post("/auth/login", response_model=TokenResponse)
def company_login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid company email or password")
    if user.role not in ["admin", "editor", "viewer", "superadmin"]:
        raise HTTPException(status_code=403, detail="Access denied for company console")

    access_token = create_access_token({
        "sub": user.id,
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id
    })

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            tenant_id=user.tenant_id,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )

@router.get("/auth/me", response_model=UserResponse)
def get_company_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

# ── Actions ──────────────────────────────────────────────────────────────────

@router.get("/actions")
def list_company_actions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Action)
    if current_user.role != "superadmin":
        query = query.filter(Action.tenant_id == current_user.tenant_id)
    return query.order_by(Action.sort_order.asc(), Action.created_at.desc()).all()

@router.post("/actions")
def create_company_action(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    action = Action(
        tenant_id=current_user.tenant_id,
        title=payload.get("title", "New Action"),
        description=payload.get("description"),
        prompt_template=payload.get("prompt_template"),
        icon=payload.get("icon"),
        category_id=payload.get("category_id"),
        playbook_id=payload.get("playbook_id"),
        is_pinned=payload.get("is_pinned", False),
        is_active=payload.get("is_active", True)
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@router.put("/actions/{action_id}")
def update_company_action(
    action_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    for k, v in payload.items():
        if hasattr(action, k) and v is not None:
            setattr(action, k, v)
    db.commit()
    db.refresh(action)
    return action

@router.delete("/actions/{action_id}", status_code=204)
def delete_company_action(
    action_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    action = db.query(Action).filter(Action.id == action_id).first()
    if action:
        db.delete(action)
        db.commit()
    return None

@router.get("/actions/starters")
@router.get("/starter-actions")
@router.get("/actions/starter")
def get_starter_actions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Action)
    if current_user.role != "superadmin":
        query = query.filter(Action.tenant_id == current_user.tenant_id)
    actions = query.filter(Action.is_pinned == True).limit(6).all()
    if not actions:
        actions = query.limit(4).all()
    return actions

# ── Playbooks ────────────────────────────────────────────────────────────────

@router.get("/playbooks")
def list_company_playbooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Playbook)
    if current_user.role != "superadmin":
        query = query.filter(Playbook.tenant_id == current_user.tenant_id)
    return query.all()

@router.post("/playbooks")
def create_company_playbook(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pb = Playbook(
        tenant_id=current_user.tenant_id,
        name=payload.get("name", "New Playbook"),
        slug=payload.get("slug", "playbook"),
        config_json=payload.get("config_json", {}),
        is_default=payload.get("is_default", False)
    )
    db.add(pb)
    db.commit()
    db.refresh(pb)
    return pb

# ── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories/access")
def get_category_access(current_user: User = Depends(get_current_user)):
    return {"can_manage_categories": True, "role": current_user.role}

@router.get("/categories")
def list_company_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Category)
    if current_user.role != "superadmin":
        query = query.filter(Category.tenant_id == current_user.tenant_id)
    return query.all()

@router.post("/categories")
def create_company_category(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cat = Category(
        tenant_id=current_user.tenant_id or "default",
        name=payload.get("name", "New Category"),
        slug=payload.get("slug", "new-category"),
        description=payload.get("description", ""),
        icon=payload.get("icon", "Folder"),
        parent_id=payload.get("parent_id"),
        is_active=True
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.patch("/categories/{category_id}")
def update_company_category(
    category_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.items():
        if hasattr(cat, k) and v is not None:
            setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categories/{category_id}")
def delete_company_category(
    category_id: str,
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if cat:
        db.delete(cat)
        db.commit()
    return {"ok": True}

@router.get("/categories/tree")
def get_categories_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Category)
    if current_user.role != "superadmin":
        query = query.filter(Category.tenant_id == current_user.tenant_id)
    cats = query.all()
    
    # Build tree nodes with guaranteed children array
    return [
        {
            "id": c.id,
            "tenant_id": c.tenant_id,
            "name": c.name,
            "slug": c.slug,
            "description": c.description or "",
            "icon": c.icon or "Folder",
            "parent_id": c.parent_id,
            "sort_order": c.sort_order or 0,
            "is_active": c.is_active,
            "category_type": "custom",
            "department": "Engineering" if "tech" in c.name.lower() else "Sales",
            "knowledge_count": 0,
            "action_count": 0,
            "automation_enabled": False,
            "children": []
        }
        for c in cats
    ]

@router.get("/categories/analytics/heatmap")
@router.get("/categories/heatmap")
def get_category_heatmap(window_days: int = 30):
    return []

@router.get("/categories/analytics/gap")
@router.get("/categories/gap")
def get_category_gap(window_days: int = 30):
    return []

@router.get("/categories/{category_id}/visibility")
def get_category_visibility(
    category_id: str,
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if cat and cat.visibility_matrix and len(cat.visibility_matrix) > 0:
        return cat.visibility_matrix
    return [
        {"role": "admin", "permission_level": "publish", "inherits_to_children": True},
        {"role": "editor", "permission_level": "edit", "inherits_to_children": True},
        {"role": "viewer", "permission_level": "view", "inherits_to_children": True}
    ]

@router.put("/categories/{category_id}/visibility")
def update_category_visibility(
    category_id: str,
    payload: List[Dict[str, Any]],
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    cleaned = [
        {
            "role": str(row.get("role", "admin")),
            "permission_level": str(row.get("permission_level", "none")),
            "inherits_to_children": bool(row.get("inherits_to_children", False))
        }
        for row in payload
    ]
    if cat:
        cat.visibility_matrix = cleaned
        db.commit()
        db.refresh(cat)
        return cat.visibility_matrix
    return cleaned

@router.get("/categories/{category_id}/knowledge-sources")
def get_category_knowledge_sources(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeSource)
    if current_user.role != "superadmin":
        query = query.filter(KnowledgeSource.tenant_id == current_user.tenant_id)
    return query.all()

@router.post("/categories/knowledge-sources/bulk-move")
def bulk_move_knowledge_sources(payload: Dict[str, Any]):
    return {"ok": True, "moved_count": 0}

@router.get("/categories/{category_id}/policy")
def get_category_policy(category_id: str):
    return {
        "id": f"policy-{category_id}",
        "category_id": category_id,
        "policy_text": "Standard category governance rules apply.",
        "rule_type": "standard",
        "is_active": True
    }

@router.put("/categories/{category_id}/policy")
def update_category_policy(category_id: str, payload: Dict[str, Any]):
    return {
        "id": f"policy-{category_id}",
        "category_id": category_id,
        "policy_text": payload.get("policy_text", ""),
        "rule_type": payload.get("rule_type", "standard"),
        "is_active": payload.get("is_active", True)
    }

@router.post("/categories/{category_id}/policy/simulate")
def simulate_category_policy(category_id: str, payload: Dict[str, Any]):
    return {
        "allowed": True,
        "matched_rules": [],
        "explanation": "No policy violations detected."
    }

@router.put("/categories/{category_id}/automation")
def update_category_automation(category_id: str, payload: Dict[str, Any]):
    return {
        "category_id": category_id,
        "auto_categorization_enabled": payload.get("auto_categorization_enabled", False),
        "keywords": payload.get("keywords", []),
        "confidence_threshold": payload.get("confidence_threshold", 0.7)
    }

# ── Knowledge Sources & Inspector ───────────────────────────────────────────

@router.get("/knowledge")
@router.get("/knowledge/sources")
def list_knowledge_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeSource)
    if current_user.role != "superadmin":
        query = query.filter(KnowledgeSource.tenant_id == current_user.tenant_id)
    return query.all()

@router.post("/knowledge")
def create_knowledge_source(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = KnowledgeSource(
        tenant_id=current_user.tenant_id or "default",
        title=payload.get("title", "Untitled Source"),
        source_type=payload.get("source_type", "text"),
        connector_kind=payload.get("connector_kind"),
        sync_frequency=payload.get("sync_frequency", "manual"),
        source_url=payload.get("source_url"),
        status="indexed",
        chunk_count=1
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    
    # Add initial chunk if text content provided
    raw_content = payload.get("raw_content")
    if raw_content:
        chunk = KnowledgeChunk(
            source_id=source.id,
            content=raw_content,
            chunk_index=0,
            chunk_metadata={"source": source.title}
        )
        db.add(chunk)
        db.commit()
        
    return source

@router.delete("/knowledge/{source_id}")
def delete_knowledge_source(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if source:
        db.delete(source)
        db.commit()
    return {"ok": True}

@router.post("/knowledge/{source_id}/retry")
def retry_knowledge_source(
    source_id: str,
    db: Session = Depends(get_db)
):
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if source:
        source.status = "indexed"
        source.last_synced_at = get_utc_now()
        db.commit()
        db.refresh(source)
    return source

@router.get("/knowledge/sync/summary")
@router.get("/knowledge/summary")
def get_knowledge_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id or "default"
    sources_cnt = db.query(KnowledgeSource).filter(KnowledgeSource.tenant_id == tenant_id).count()
    chunks_cnt = db.query(KnowledgeChunk).count()
    return {
        "total_sources": sources_cnt,
        "indexed_sources": sources_cnt,
        "syncing_sources": 0,
        "failed_sources": 0,
        "total_chunks": chunks_cnt,
        "embedded_chunks": chunks_cnt,
        "embedding_coverage_pct": 100.0,
        "avg_chunks_per_source": round(chunks_cnt / max(sources_cnt, 1), 1)
    }

@router.get("/knowledge-gaps")
def list_knowledge_gaps():
    return []

@router.get("/knowledge/{source_id}/chunks")
def list_knowledge_chunks(
    source_id: str,
    db: Session = Depends(get_db)
):
    return db.query(KnowledgeChunk).filter(KnowledgeChunk.source_id == source_id).all()

@router.post("/knowledge/qa-sandbox")
def run_qa_sandbox(payload: Dict[str, Any]):
    prompt = payload.get("prompt", "")
    return {
        "answer": f"Simulated AI retrieval answer for: '{prompt}'. All relevant organizational documents were scanned.",
        "confidence": 0.94,
        "citations": [],
        "skill_run_id": None
    }

@router.post("/knowledge/qa-sandbox/mark-gap")
def mark_qa_gap(payload: Dict[str, Any]):
    return {"ok": True}

@router.post("/knowledge/{source_id}/auto-categorize")
def auto_categorize_knowledge_source(source_id: str):
    return {
        "source_id": source_id,
        "predicted_category_id": None,
        "confidence": 0.85,
        "applied": False
    }

# ── Employees / Candidate Roster ─────────────────────────────────────────────

@router.get("/employees")
def list_company_employees(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate)
    if current_user.role != "superadmin":
        query = query.filter(Candidate.tenant_id == current_user.tenant_id)
    candidates = query.order_by(Candidate.created_at.desc()).all()
    return [map_candidate_to_response(c) for c in candidates]

@router.get("/candidates/{candidate_id}/practice-results")
@router.get("/employees/{candidate_id}/practice-results")
def get_candidate_shared_practice_results(
    candidate_id: str,
    db: Session = Depends(get_db)
):
    """
    Company Admin View: ONLY returns mock interview practice sessions
    that the candidate has explicitly chosen to share (shared_with_company == True).
    Private sessions are never exposed.
    """
    sessions = db.query(InterviewPracticeSession).filter(
        InterviewPracticeSession.candidate_id == candidate_id,
        InterviewPracticeSession.shared_with_company == True
    ).order_by(InterviewPracticeSession.created_at.desc()).all()

    return [
        {
            "id": s.id,
            "candidate_id": s.candidate_id,
            "job_id": s.job_id,
            "job_title": s.job.title if s.job else f"{s.niche.title()} Role",
            "niche": s.niche,
            "overall_score": s.overall_score,
            "strong_areas": s.strong_areas,
            "weak_areas": s.weak_areas,
            "suggestions": s.suggestions,
            "shared_at": s.shared_at,
            "created_at": s.created_at
        }
        for s in sessions
    ]

# ── Skills Config ────────────────────────────────────────────────────────────

@router.get("/skills/configs")
@router.get("/skill-configs")
def list_skill_configs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SkillConfig)
    if current_user.role != "superadmin":
        query = query.filter(SkillConfig.tenant_id == current_user.tenant_id)
    return query.all()

@router.put("/skill-configs")
def upsert_skill_config(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template_id = payload.get("template_id", "default")
    config = db.query(SkillConfig).filter(
        SkillConfig.tenant_id == current_user.tenant_id,
        SkillConfig.skill_template_id == template_id
    ).first()
    if not config:
        config = SkillConfig(
            tenant_id=current_user.tenant_id or "default",
            skill_template_id=template_id,
            config_overrides=payload.get("config_overrides", {}),
            is_enabled=payload.get("is_enabled", True)
        )
        db.add(config)
    else:
        config.config_overrides = payload.get("config_overrides", config.config_overrides)
        config.is_enabled = payload.get("is_enabled", config.is_enabled)
    db.commit()
    db.refresh(config)
    return config

@router.get("/skill-configs/analytics/timeseries")
def get_skill_usage_timeseries(window_days: int = 7):
    return []

@router.get("/skill-runs")
def list_company_skill_runs(page: int = 1):
    return []

# ── Widget Admin Config ──────────────────────────────────────────────────────

@router.get("/widget/config")
@router.get("/widget-admin/config")
def get_company_widget_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cfg = db.query(WidgetConfig).filter(WidgetConfig.tenant_id == current_user.tenant_id).first()
    if not cfg:
        cfg = WidgetConfig(
            tenant_id=current_user.tenant_id or "default",
            bot_id="talent_iq_bot",
            name="HireTalentIQ Talent Assistant"
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return {
        "bot_id": cfg.bot_id,
        "name": cfg.name,
        "welcome_text": cfg.welcome_text,
        "primary_color": cfg.primary_color,
        "launcher_position": cfg.launcher_position,
        "allowed_domains": cfg.allowed_domains or ["*"],
        "active_token_last4": "9988"
    }

@router.get("/widget-admin/access")
def get_widget_admin_access(current_user: User = Depends(get_current_user)):
    return {"can_manage_widget": True, "role": current_user.role}

# ── Audit Logs ───────────────────────────────────────────────────────────────

@router.get("/audit")
@router.get("/audit-logs")
def list_company_audit_logs(
    page: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if current_user.role != "superadmin":
        query = query.filter(AuditLog.tenant_id == current_user.tenant_id)
    return query.order_by(AuditLog.created_at.desc()).limit(100).all()
