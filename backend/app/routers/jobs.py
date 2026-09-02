from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Job, User, Tenant, Candidate, Match, AuditLog
from app.core.deps import get_current_user
from app.services.job_extractor import JobExtractorService
from app.services.matching_engine import MatchingEngine
from app.schemas.domain import JobCreate, JobUpdate, JobResponse, JDExtractRequest

router = APIRouter(prefix="/jobs", tags=["Jobs"])

def map_job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        tenant_id=job.tenant_id,
        owner_id=job.owner_id,
        title=job.title,
        description=job.description,
        niche=job.niche or "tech",
        must_have_skills=job.must_have_skills or [],
        nice_to_have_skills=job.nice_to_have_skills or [],
        experience_min_years=job.experience_min_years or 0.0,
        experience_max_years=job.experience_max_years,
        budget_min=job.budget_min,
        budget_max=job.budget_max,
        location_preference=job.location_preference,
        remote_ok=job.remote_ok,
        creation_source=job.creation_source or "manual",
        status=job.status or "published",
        niche_criteria=job.niche_criteria,
        created_at=job.created_at,
    )

@router.get("", response_model=List[JobResponse])
def list_jobs(
    niche: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Job)
    if current_user.role != "superadmin":
        query = query.filter(Job.tenant_id == current_user.tenant_id)
    if niche:
        query = query.filter(Job.niche == niche.lower())
    if status_filter:
        query = query.filter(Job.status == status_filter)
        
    jobs = query.order_by(Job.created_at.desc()).all()
    return [map_job_to_response(j) for j in jobs]

@router.post("", response_model=JobResponse)
def create_job(
    payload: JobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    if not tenant_id and current_user.role == "superadmin":
        first_t = db.query(Tenant).first()
        tenant_id = first_t.id if first_t else None

    job = Job(
        tenant_id=tenant_id,
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
        niche=payload.niche.lower() if payload.niche else "tech",
        must_have_skills=payload.must_have_skills,
        nice_to_have_skills=payload.nice_to_have_skills,
        experience_min_years=payload.experience_min_years or 0.0,
        experience_max_years=payload.experience_max_years,
        budget_min=payload.budget_min,
        budget_max=payload.budget_max,
        location_preference=payload.location_preference,
        remote_ok=payload.remote_ok if payload.remote_ok is not None else True,
        creation_source=payload.creation_source or "manual",
        raw_jd_text=payload.raw_jd_text,
        niche_criteria=payload.niche_criteria or {},
        status=payload.status or "published",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Automatically compute AI matching with explainability for all existing tenant candidates
    candidates = db.query(Candidate).filter(Candidate.tenant_id == tenant_id).all()
    for cand in candidates:
        eval_res = MatchingEngine.evaluate_match(cand, job)
        match = Match(
            tenant_id=tenant_id,
            candidate_id=cand.id,
            job_id=job.id,
            hard_filter_passed=eval_res["hard_filter_passed"],
            ai_score=eval_res["ai_score"],
            matched_skills=eval_res["matched_skills"],
            missing_skills=eval_res["missing_skills"],
            experience_fit=eval_res["experience_fit"],
            semantic_notes=eval_res["semantic_notes"],
            niche_notes=eval_res["niche_notes"],
            explanation=eval_res["explanation"],
            status="pending"
        )
        db.add(match)
    db.commit()

    # Audit log
    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=current_user.id,
        actor_name=current_user.name,
        actor_email=current_user.email,
        action="CREATE_JOB",
        entity_type="Job",
        entity_id=job.id,
        changes={"title": job.title, "niche": job.niche}
    )
    db.add(audit)
    db.commit()

    return map_job_to_response(job)

@router.post("/extract-from-jd")
def extract_from_jd(
    payload: JDExtractRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Path B: AI extraction from Job Description.
    Extracts structured fields and returns draft for admin review before saving.
    """
    extracted = JobExtractorService.extract_job_from_jd(payload.jd_text)
    return {
        "status": "success",
        "extracted_job": extracted,
        "raw_text": payload.jd_text
    }

@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Job).filter(Job.id == job_id)
    if current_user.role != "superadmin":
        query = query.filter(Job.tenant_id == current_user.tenant_id)
    job = query.first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return map_job_to_response(job)

@router.put("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: str,
    payload: JobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Job).filter(Job.id == job_id)
    if current_user.role != "superadmin":
        query = query.filter(Job.tenant_id == current_user.tenant_id)
    job = query.first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        if hasattr(job, k) and v is not None:
            setattr(job, k, v)

    db.commit()
    db.refresh(job)

    # Re-sync matches
    candidates = db.query(Candidate).filter(Candidate.tenant_id == job.tenant_id).all()
    for cand in candidates:
        MatchingEngine.sync_candidate_matches(cand, db)

    return map_job_to_response(job)
