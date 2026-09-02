from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Match, Job, Candidate, User, AuditLog, Message
from app.core.deps import get_current_user
from app.services.notification_service import NotificationService
from app.routers.candidates import map_candidate_to_response
from app.routers.jobs import map_job_to_response
from app.schemas.domain import MatchResponse, SwipeRequest, MessageCreate, MessageResponse

router = APIRouter(prefix="/matches", tags=["Matches & Swipe Deck"])

def map_match_to_response(m: Match) -> MatchResponse:
    cand_resp = map_candidate_to_response(m.candidate) if m.candidate else None
    job_resp = map_job_to_response(m.job) if m.job else None
    return MatchResponse(
        id=m.id,
        tenant_id=m.tenant_id,
        candidate_id=m.candidate_id,
        job_id=m.job_id,
        hard_filter_passed=m.hard_filter_passed,
        ai_score=m.ai_score,
        matched_skills=m.matched_skills or [],
        missing_skills=m.missing_skills or [],
        experience_fit=m.experience_fit,
        semantic_notes=m.semantic_notes,
        niche_notes=m.niche_notes,
        explanation=m.explanation,
        status=m.status,
        candidate=cand_resp,
        job=job_resp,
        created_at=m.created_at,
    )

@router.get("", response_model=List[MatchResponse])
def list_matches(
    job_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    hard_filter_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Match)
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)
    if job_id:
        query = query.filter(Match.job_id == job_id)
    if status_filter:
        query = query.filter(Match.status == status_filter)
    if hard_filter_only:
        query = query.filter(Match.hard_filter_passed == True)

    matches = query.order_by(Match.hard_filter_passed.desc(), Match.ai_score.desc()).all()
    return [map_match_to_response(m) for m in matches]

@router.get("/deck", response_model=List[MatchResponse])
@router.get("/deck/{job_id}", response_model=List[MatchResponse])
def get_swipe_deck(
    job_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns AI-ranked candidate cards for the swipe deck.
    Ranked strictly by hard_filter_passed first, then ai_score descending.
    """
    query = db.query(Match)
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)
    if job_id:
        query = query.filter(Match.job_id == job_id)

    matches = query.order_by(Match.hard_filter_passed.desc(), Match.ai_score.desc()).all()
    return [map_match_to_response(m) for m in matches]

@router.post("/swipe", response_model=MatchResponse)
def handle_swipe(
    payload: SwipeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes swipe deck actions:
    - direction="right": Shortlists candidate & triggers notifications
    - direction="left": Rejects candidate & logs rejection reason
    - direction="undo": Reverts match to pending
    """
    query = db.query(Match)
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)

    if payload.match_id:
        match = query.filter(Match.id == payload.match_id).first()
    elif payload.candidate_id:
        match = query.filter(Match.candidate_id == payload.candidate_id).first()
    else:
        raise HTTPException(status_code=400, detail="Must provide match_id or candidate_id")

    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")

    direction = payload.direction.lower()
    if direction in ["right", "shortlist"]:
        match.status = "shortlisted"
        NotificationService.notify_shortlist(db, match.id)
        action_name = "SHORTLIST_CANDIDATE"
    elif direction in ["left", "reject"]:
        match.status = "rejected"
        match.rejection_reason = payload.reason or "Does not meet role requirements"
        action_name = "REJECT_CANDIDATE"
    elif direction == "undo":
        match.status = "pending"
        match.rejection_reason = None
        action_name = "UNDO_SWIPE"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid swipe direction: {payload.direction}")

    db.commit()
    db.refresh(match)

    # Audit trail
    audit = AuditLog(
        tenant_id=match.tenant_id,
        user_id=current_user.id,
        actor_name=current_user.name,
        actor_email=current_user.email,
        action=action_name,
        entity_type="Match",
        entity_id=match.id,
        changes={
            "status": match.status,
            "ai_score": match.ai_score,
            "explanation": match.explanation,
            "reason": payload.reason
        }
    )
    db.add(audit)
    db.commit()

    return map_match_to_response(match)

@router.get("/shortlist", response_model=List[MatchResponse])
def get_shortlisted_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Match).filter(Match.status.in_(["shortlisted", "interviewing", "hired"]))
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)
    matches = query.order_by(Match.updated_at.desc()).all()
    return [map_match_to_response(m) for m in matches]

# ── Recruiter ↔ Candidate Messaging Thread (Scoped to Match) ────────────────

@router.get("/{match_id}/messages", response_model=List[MessageResponse])
def get_match_messages(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Match).filter(Match.id == match_id)
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)
    match = query.first()
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")

    messages = db.query(Message).filter(Message.match_id == match_id).order_by(Message.created_at.asc()).all()
    return messages

@router.post("/{match_id}/messages", response_model=MessageResponse)
def send_match_message(
    match_id: str,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Match).filter(Match.id == match_id)
    if current_user.role != "superadmin":
        query = query.filter(Match.tenant_id == current_user.tenant_id)
    match = query.first()
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")

    msg = Message(
        tenant_id=match.tenant_id,
        match_id=match_id,
        sender_id=current_user.id,
        sender_role=payload.sender_role or ("recruiter" if current_user.role in ["admin", "editor"] else "candidate"),
        body=payload.body,
        attachment_name=payload.attachment_name,
        attachment_url=payload.attachment_url
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Trigger notification
    cand = match.candidate
    job = match.job
    if payload.sender_role == "recruiter" and cand and cand.email:
        NotificationService.send_notification(
            db=db,
            tenant_id=match.tenant_id,
            type="new_recruiter_message",
            channel="email",
            title=f"New message regarding {job.title if job else 'Role'}",
            message=f"Hi {cand.name}, the recruiter sent you a new message: \"{payload.body[:100]}\"",
            recipient_email=cand.email,
            related_entity_type="match",
            related_entity_id=match.id
        )

    return msg
