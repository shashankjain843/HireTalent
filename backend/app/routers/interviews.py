from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Interview, Candidate, Job, User, AuditLog
from app.core.deps import get_current_user
from app.services.notification_service import NotificationService
from app.schemas.domain import InterviewCreate, InterviewResponse

router = APIRouter(prefix="/interviews", tags=["Interviews & Scheduling"])

def map_interview_to_response(item: Interview) -> InterviewResponse:
    return InterviewResponse(
        id=item.id,
        tenant_id=item.tenant_id,
        match_id=item.match_id,
        candidate_id=item.candidate_id,
        job_id=item.job_id,
        scheduled_for=item.scheduled_for,
        timezone=item.timezone or "UTC",
        duration_minutes=item.duration_minutes or 45,
        meeting_link=item.meeting_link,
        note=item.note,
        status=item.status or "scheduled",
        created_at=item.created_at,
    )

@router.get("", response_model=List[InterviewResponse])
def list_interviews(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Interview)
    if current_user.role != "superadmin":
        query = query.filter(Interview.tenant_id == current_user.tenant_id)
    if candidate_id:
        query = query.filter(Interview.candidate_id == candidate_id)
    if job_id:
        query = query.filter(Interview.job_id == job_id)

    interviews = query.order_by(Interview.scheduled_for.asc()).all()
    return [map_interview_to_response(i) for i in interviews]

@router.post("", response_model=InterviewResponse)
def schedule_interview(
    payload: InterviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    cand = db.query(Candidate).filter(Candidate.id == payload.candidate_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    meeting_link = payload.meeting_link or f"https://meet.hiretalentiq.com/room-{cand.id[:8]}"

    interview = Interview(
        tenant_id=tenant_id or cand.tenant_id,
        match_id=payload.match_id,
        candidate_id=payload.candidate_id,
        job_id=payload.job_id,
        scheduled_for=payload.scheduled_for,
        timezone=payload.timezone or "UTC",
        duration_minutes=payload.duration_minutes or 45,
        meeting_link=meeting_link,
        note=payload.note,
        status="scheduled"
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    # Trigger notifications
    NotificationService.notify_interview_scheduled(db, interview.id)

    # Audit log
    audit = AuditLog(
        tenant_id=interview.tenant_id,
        user_id=current_user.id,
        actor_name=current_user.name,
        actor_email=current_user.email,
        action="SCHEDULE_INTERVIEW",
        entity_type="Interview",
        entity_id=interview.id,
        changes={"scheduled_for": str(interview.scheduled_for), "candidate_id": cand.id}
    )
    db.add(audit)
    db.commit()

    return map_interview_to_response(interview)

@router.put("/{interview_id}/cancel", response_model=InterviewResponse)
def cancel_interview(
    interview_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Interview).filter(Interview.id == interview_id)
    if current_user.role != "superadmin":
        query = query.filter(Interview.tenant_id == current_user.tenant_id)
    interview = query.first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = "cancelled"
    db.commit()
    db.refresh(interview)

    return map_interview_to_response(interview)
