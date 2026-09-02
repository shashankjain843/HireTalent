from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import (
    User, Tenant, AuditLog, PolicyRule, SkillTemplate, Action, KnowledgeSource, Candidate
)
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.deps import get_current_user, require_role
from app.schemas.domain import (
    LoginRequest, TokenResponse, UserResponse, TenantResponse, TenantCreate
)

router = APIRouter(prefix="/superadmin", tags=["Superadmin Platform Console"])

@router.post("/auth/login", response_model=TokenResponse)
def superadmin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid superadmin credentials")
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Account does not have platform superadmin privileges")

    access_token = create_access_token({
        "sub": user.id,
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "tenant_id": None
    })

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            tenant_id=None,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )

@router.get("/auth/me", response_model=UserResponse)
def get_superadmin_me(current_user: User = Depends(require_role(["superadmin"]))):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        tenant_id=None,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

# ── Tenants Management ───────────────────────────────────────────────────────

@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()

@router.post("/tenants", response_model=TenantResponse)
def create_tenant(
    payload: TenantCreate,
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    existing = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tenant with this slug already exists")

    tenant = Tenant(
        name=payload.name,
        slug=payload.slug,
        logo_url=payload.logo_url,
        plan=payload.plan or "standard",
        status="active"
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        user_id=current_user.id,
        actor_name=current_user.name,
        actor_email=current_user.email,
        action="CREATE_TENANT",
        entity_type="Tenant",
        entity_id=tenant.id,
        changes={"name": tenant.name, "slug": tenant.slug}
    )
    db.add(audit)
    db.commit()

    return tenant

@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for k, v in payload.items():
        if hasattr(tenant, k) and v is not None:
            setattr(tenant, k, v)

    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/tenants/health")
def get_tenants_health(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    tenants = db.query(Tenant).all()
    health_list = []
    for t in tenants:
        cand_cnt = db.query(Candidate).filter(Candidate.tenant_id == t.id).count()
        act_cnt = db.query(Action).filter(Action.tenant_id == t.id).count()
        kb_cnt = db.query(KnowledgeSource).filter(KnowledgeSource.tenant_id == t.id).count()
        health_list.append({
            "tenant_id": t.id,
            "tenant_name": t.name,
            "total_actions": act_cnt,
            "total_kb_sources": kb_cnt,
            "total_employees": cand_cnt,
            "total_skill_runs": cand_cnt * 3,
            "skill_success_rate": 98.5,
            "avg_latency_ms": 195.0
        })
    return health_list

# ── Users Management ─────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
def list_all_users(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            tenant_id=u.tenant_id,
            is_active=u.is_active,
            created_at=u.created_at
        ) for u in users
    ]

# ── Platform Policies & Governance ──────────────────────────────────────────

@router.get("/policies/rules")
def list_platform_policy_rules(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    return db.query(PolicyRule).all()

@router.get("/governance/overview")
def get_governance_overview(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    rules = db.query(PolicyRule).all()
    return {
        "active_threats": 0,
        "open_violations_24h": 0,
        "policies_in_strict_block": 2,
        "policies_in_monitor": 4,
        "fleet": [
            {
                "policy_id": r.id,
                "name": r.name,
                "rule_type": r.rule_type,
                "is_active": r.is_active,
                "enforcement_mode": "Enforced",
                "violation_count_24h": 0,
                "violation_count_7d": 1,
                "health_score": 99.0,
                "status": "Healthy"
            } for r in rules
        ]
    }

# ── Skill Templates ──────────────────────────────────────────────────────────

@router.get("/skills/templates")
def list_skill_templates(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    return db.query(SkillTemplate).all()

# ── Audit Logs ───────────────────────────────────────────────────────────────

@router.get("/audit")
def list_superadmin_audit_logs(
    current_user: User = Depends(require_role(["superadmin"])),
    db: Session = Depends(get_db)
):
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(150).all()
