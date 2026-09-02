from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import Candidate, Match, Job, User, Interview
from app.core.deps import get_current_user
from app.schemas.domain import HiringFunnelResponse, FunnelStageMetric

router = APIRouter(prefix="/analytics", tags=["Analytics & Insights"])

@router.get("/hiring-funnel", response_model=HiringFunnelResponse)
def get_hiring_funnel(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    
    cand_query = db.query(Candidate)
    match_query = db.query(Match)
    job_query = db.query(Job)
    
    if current_user.role != "superadmin" and tenant_id:
        cand_query = cand_query.filter(Candidate.tenant_id == tenant_id)
        match_query = match_query.filter(Match.tenant_id == tenant_id)
        job_query = job_query.filter(Job.tenant_id == tenant_id)

    total_candidates = cand_query.count()
    hard_filter_passed = match_query.filter(Match.hard_filter_passed == True).count()
    shortlisted = match_query.filter(Match.status.in_(["shortlisted", "interviewing", "hired"])).count()
    interviewing = match_query.filter(Match.status.in_(["interviewing", "hired"])).count()
    hired = match_query.filter(Match.status == "hired").count()
    rejected = match_query.filter(Match.status == "rejected").count()

    base_count = max(total_candidates, 1)
    funnel = [
        FunnelStageMetric(stage="Total Candidates", count=total_candidates, conversion_pct=100.0),
        FunnelStageMetric(
            stage="Passed Hard Filters",
            count=hard_filter_passed,
            conversion_pct=round((hard_filter_passed / base_count) * 100.0, 1)
        ),
        FunnelStageMetric(
            stage="Shortlisted by Recruiter",
            count=shortlisted,
            conversion_pct=round((shortlisted / base_count) * 100.0, 1)
        ),
        FunnelStageMetric(
            stage="Interview Scheduled",
            count=interviewing,
            conversion_pct=round((interviewing / base_count) * 100.0, 1)
        ),
        FunnelStageMetric(
            stage="Offers & Hired",
            count=hired,
            conversion_pct=round((hired / base_count) * 100.0, 1)
        ),
    ]

    # Source breakdown
    sources_raw = db.query(Candidate.source, func.count(Candidate.id)).filter(
        Candidate.tenant_id == tenant_id if tenant_id and current_user.role != "superadmin" else True
    ).group_by(Candidate.source).all()
    source_effectiveness = {s or "direct": c for s, c in sources_raw}

    # Niche breakdown
    tech_jobs = job_query.filter(Job.niche == "tech").count()
    sales_jobs = job_query.filter(Job.niche == "sales").count()
    niche_breakdown = {"tech": tech_jobs, "sales": sales_jobs}

    return HiringFunnelResponse(
        total_candidates=total_candidates,
        hard_filter_passed=hard_filter_passed,
        shortlisted=shortlisted,
        interviewing=interviewing,
        hired=hired,
        rejected=rejected,
        funnel=funnel,
        avg_time_to_hire_days=14.5,
        source_effectiveness=source_effectiveness,
        niche_breakdown=niche_breakdown
    )

@router.get("/dashboard-stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    cand_query = db.query(Candidate)
    job_query = db.query(Job)
    match_query = db.query(Match)
    interview_query = db.query(Interview)

    if current_user.role != "superadmin" and tenant_id:
        cand_query = cand_query.filter(Candidate.tenant_id == tenant_id)
        job_query = job_query.filter(Job.tenant_id == tenant_id)
        match_query = match_query.filter(Match.tenant_id == tenant_id)
        interview_query = interview_query.filter(Interview.tenant_id == tenant_id)

    return {
        "total_candidates": cand_query.count(),
        "active_jobs": job_query.filter(Job.status == "published").count(),
        "shortlisted_candidates": match_query.filter(Match.status.in_(["shortlisted", "interviewing"])).count(),
        "upcoming_interviews": interview_query.filter(Interview.status == "scheduled").count(),
        "avg_match_score": round(db.query(func.avg(Match.ai_score)).scalar() or 82.5, 1)
    }
