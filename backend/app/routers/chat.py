import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Candidate, Match, Job, Tenant
from app.core.storage import StorageService
from app.services.candidate_bot import CandidateIntakeBot

router = APIRouter(tags=["Conversational Chat & Widget"])

class ChatQuery(BaseModel):
    question: str
    session_id: Optional[str] = "default"
    tenant_slug: Optional[str] = None
    action_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    options: List[str] = []
    session_id: str
    stage: Optional[str] = None
    profile_data: Optional[Dict[str, Any]] = None

@router.post("/chat", response_model=ChatResponse)
def handle_chat_message(
    query: ChatQuery,
    db: Session = Depends(get_db)
):
    """
    Main conversational intake & hiring assistant API.
    Interactively guides candidates or recruiters through intake, screening,
    skill verification, and role matching.
    """
    session_id = query.session_id or "default"
    
    tenant_id = None
    if query.tenant_slug:
        t = db.query(Tenant).filter(Tenant.slug == query.tenant_slug).first()
        if t:
            tenant_id = t.id

    result = CandidateIntakeBot.process_message(
        session_id=session_id,
        user_message=query.question,
        db=db,
        tenant_id=tenant_id
    )

    return ChatResponse(
        message=result["message"],
        options=result.get("options", []),
        session_id=session_id,
        stage=result.get("stage"),
        profile_data=result.get("profile_data")
    )

# ── Direct Outreach / Candidate Chat Thread ──────────────────────────────────

@router.get("/chat/direct/{candidate_id}")
def get_direct_chat_thread(
    candidate_id: str,
    db: Session = Depends(get_db)
):
    cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    messages = [
        {
            "message": f"Hi {cand.name}! We were impressed by your profile and experience.",
            "created_at": cand.created_at.isoformat() if cand.created_at else "2026-08-30T10:00:00Z",
            "sender": "client",
            "options": ["Schedule a discovery call", "View role requirements"]
        }
    ]

    return {
        "conversation_id": f"conv-{cand.id}",
        "candidate_id": cand.id,
        "candidate_name": cand.name,
        "candidate_title": cand.title or "Software Engineer",
        "messages": messages,
        "calls": []
    }

@router.post("/chat/attachment")
async def upload_chat_attachment(
    file: UploadFile = File(...),
    session_id: str = Form("default"),
):
    file_bytes = await file.read()
    filename = file.filename or "attachment"
    stored_ref = StorageService.save_attachment(file_bytes, filename)
    return {
        "status": "success",
        "filename": filename,
        "file_url": stored_ref,
        "message": f"Attachment {filename} uploaded successfully."
    }

# ── Widget Specific Endpoints ────────────────────────────────────────────────

@router.post("/widget/session")
def create_widget_session(
    bot_id: Optional[str] = "talent_iq_bot",
    embed_token: Optional[str] = None
):
    return {
        "session_token": str(uuid.uuid4()),
        "welcome_text": "Hi there! I am your HireTalentIQ AI Assistant. Tell me about your dream role or skills!"
    }
