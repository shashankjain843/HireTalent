from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Candidate, User, Tenant, AuditLog, Match
from app.core.deps import get_current_user, get_current_tenant
from app.core.storage import StorageService
from app.services.resume_parser import ResumeParserService
from app.services.matching_engine import MatchingEngine
from app.schemas.domain import CandidateCreate, CandidateUpdate, CandidateResponse

router = APIRouter(prefix="/candidates", tags=["Candidates"])

def map_candidate_to_response(cand: Candidate) -> CandidateResponse:
    skills_list = cand.skills or []
    expertise_list = []
    for s in skills_list:
        if isinstance(s, dict) and "name" in s:
            expertise_list.append(s["name"])
        elif isinstance(s, str):
            expertise_list.append(s)

    return CandidateResponse(
        id=cand.id,
        tenant_id=cand.tenant_id,
        name=cand.name,
        email=cand.email,
        phone=cand.phone,
        title=cand.title,
        department=cand.department,
        bio=cand.bio,
        avatar_url=cand.avatar_url,
        current_location=cand.current_location,
        availability_status=cand.availability,
        availability=cand.availability,
        years_of_experience=cand.years_of_experience,
        hourly_rate=cand.hourly_rate,
        skills=skills_list,
        expertise=expertise_list,
        source=cand.source,
        resume_file_ref=cand.resume_file_ref,
        parsing_confidence=cand.parsing_confidence,
        niche_data=cand.niche_data,
        consent_granted=cand.consent_granted if cand.consent_granted is not None else True,
        consent_granted_at=cand.consent_granted_at,
        consent_type=cand.consent_type or "data_processing_and_storage",
        lifecycle_status=cand.lifecycle_status or "Active Employee",
        talent_pool=cand.talent_pool,
        is_internal_candidate=cand.is_internal_candidate,
        is_active=cand.is_active,
        created_at=cand.created_at,
    )

@router.get("", response_model=List[CandidateResponse])
def list_candidates(
    q: Optional[str] = None,
    skill: Optional[str] = None,
    min_experience: Optional[float] = None,
    max_experience: Optional[float] = None,
    location: Optional[str] = None,
    niche: Optional[str] = None,
    department: Optional[str] = None,
    lifecycle_status: Optional[str] = None,
    talent_pool: Optional[str] = None,
    min_score: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate)
    if current_user.role != "superadmin":
        query = query.filter(Candidate.tenant_id == current_user.tenant_id)
    if department:
        query = query.filter(Candidate.department == department)
    if lifecycle_status:
        query = query.filter(Candidate.lifecycle_status == lifecycle_status)
    if talent_pool:
        query = query.filter(Candidate.talent_pool == talent_pool)
    if location:
        query = query.filter(Candidate.current_location.ilike(f"%{location}%"))
    if min_experience is not None:
        query = query.filter(Candidate.years_of_experience >= min_experience)
    if max_experience is not None:
        query = query.filter(Candidate.years_of_experience <= max_experience)
    if q:
        search_pattern = f"%{q.strip().lower()}%"
        query = query.filter(
            (Candidate.name.ilike(search_pattern)) |
            (Candidate.email.ilike(search_pattern)) |
            (Candidate.title.ilike(search_pattern)) |
            (Candidate.bio.ilike(search_pattern))
        )
    
    candidates = query.order_by(Candidate.created_at.desc()).all()

    # In-memory post-filters for JSON skill & niche & match score if requested
    if skill:
        target_sk = skill.strip().lower()
        candidates = [
            c for c in candidates 
            if any(
                (isinstance(s, dict) and target_sk in s.get("name", "").lower()) or
                (isinstance(s, str) and target_sk in s.lower())
                for s in (c.skills or [])
            )
        ]

    if niche:
        target_niche = niche.strip().lower()
        if target_niche == "sales":
            candidates = [c for c in candidates if (c.niche_data and "quota_attainment" in c.niche_data) or (c.department and "sales" in c.department.lower()) or (c.title and "sales" in c.title.lower()) or (c.title and "account executive" in c.title.lower())]
        else:
            candidates = [c for c in candidates if not ((c.niche_data and "quota_attainment" in c.niche_data) or (c.department and "sales" in c.department.lower()))]

    if min_score is not None:
        cand_ids_with_score = {
            m.candidate_id for m in db.query(Match).filter(Match.ai_score >= min_score).all()
        }
        candidates = [c for c in candidates if c.id in cand_ids_with_score]

    return [map_candidate_to_response(c) for c in candidates]

@router.post("", response_model=CandidateResponse)
def create_candidate(
    payload: CandidateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    if not tenant_id and current_user.role == "superadmin":
        first_t = db.query(Tenant).first()
        tenant_id = first_t.id if first_t else None

    cand = Candidate(
        tenant_id=tenant_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        title=payload.title,
        department=payload.department,
        bio=payload.bio,
        avatar_url=payload.avatar_url,
        current_location=payload.current_location,
        availability=payload.availability,
        years_of_experience=payload.years_of_experience,
        hourly_rate=payload.hourly_rate,
        salary_expectation=payload.salary_expectation,
        skills=payload.skills,
        source=payload.source or "manual",
        niche_data=payload.niche_data or {},
        consent_granted=payload.consent_granted if payload.consent_granted is not None else True,
        consent_type=payload.consent_type or "data_processing_and_storage",
        lifecycle_status=payload.lifecycle_status or "Active Employee",
        talent_pool=payload.talent_pool,
        is_internal_candidate=payload.is_internal_candidate or False,
        is_active=True,
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    # Sync AI matches
    MatchingEngine.sync_candidate_matches(cand, db)

    return map_candidate_to_response(cand)


# ─────────────────────────────────────────────────────────────
# 🎯 PHASE 7: AI MOCK INTERVIEW PRACTICE & SKILL READINESS
# ─────────────────────────────────────────────────────────────

from app.db.models import InterviewPracticeSession, Job, get_utc_now
from app.services.mock_interview_bot import MockInterviewBot
from typing import Dict, Any

@router.post("/practice/start")
def start_practice_session(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    niche = payload.get("niche", "tech")

    # Find or fallback candidate
    candidate = None
    if candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        candidate = db.query(Candidate).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = None
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job and job.niche:
            niche = job.niche

    questions = MockInterviewBot.generate_questions(job=job, niche=niche)
    initial_q = questions[0]["question"] if questions else "Welcome! Tell me about your background."

    transcript = [
        {
            "role": "ai",
            "content": f"Hello {candidate.name}! I will be your AI interviewer for this {job.title if job else niche.title()} practice session. Let's begin.",
            "question_id": "intro"
        },
        {
            "role": "ai",
            "content": initial_q,
            "question_id": questions[0]["id"] if questions else "q1",
            "question_index": 0,
            "category": questions[0].get("category") if questions else "General"
        }
    ]

    session = InterviewPracticeSession(
        candidate_id=candidate.id,
        job_id=job.id if job else None,
        niche=niche,
        transcript=transcript,
        overall_score=None,
        strong_areas=[],
        weak_areas=[],
        suggestions=[],
        shared_with_company=False
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "job_id": job.id if job else None,
        "job_title": job.title if job else f"{niche.title()} Role",
        "niche": niche,
        "questions": questions,
        "current_question_index": 0,
        "transcript": session.transcript
    }


@router.post("/practice/{session_id}/message")
def post_practice_message(
    session_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    user_message = payload.get("message", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    questions = MockInterviewBot.generate_questions(job=job, niche=session.niche)

    current_transcript = list(session.transcript or [])
    current_transcript.append({
        "role": "candidate",
        "content": user_message
    })

    # Determine current question progress
    ai_questions = [t for t in current_transcript if t.get("role") == "ai" and t.get("question_index") is not None]
    current_q_idx = ai_questions[-1]["question_index"] if ai_questions else 0
    current_q_item = questions[current_q_idx] if current_q_idx < len(questions) else questions[-1]

    # Calculate how many turns the candidate has answered for this specific question
    cand_turns_for_current_q = 0
    for t in reversed(current_transcript):
        if t.get("role") == "ai" and t.get("question_index") is not None:
            break
        if t.get("role") == "candidate":
            cand_turns_for_current_q += 1

    # Check for adaptive follow-up probing
    eval_res = MockInterviewBot.evaluate_response(
        question_item=current_q_item,
        user_answer=user_message,
        turn_count_for_question=cand_turns_for_current_q
    )

    is_complete = False
    if eval_res["needs_follow_up"] and eval_res["follow_up_question"]:
        current_transcript.append({
            "role": "ai",
            "content": eval_res["follow_up_question"],
            "is_follow_up": True,
            "question_index": current_q_idx
        })
    else:
        # Move to next question or complete
        next_q_idx = current_q_idx + 1
        if next_q_idx < len(questions):
            next_q = questions[next_q_idx]
            current_transcript.append({
                "role": "ai",
                "content": f"Thank you. Let's move on to the next question: {next_q['question']}",
                "question_id": next_q["id"],
                "question_index": next_q_idx,
                "category": next_q.get("category")
            })
        else:
            is_complete = True
            current_transcript.append({
                "role": "ai",
                "content": "That concludes our mock interview practice session! Generating your structured performance evaluation now...",
                "is_conclusion": True
            })

    session.transcript = current_transcript
    db.commit()

    report = None
    if is_complete:
        scorecard = MockInterviewBot.grade_session(current_transcript, job=job, niche=session.niche)
        session.overall_score = scorecard["overall_score"]
        session.strong_areas = scorecard["strong_areas"]
        session.weak_areas = scorecard["weak_areas"]
        session.suggestions = scorecard["suggestions"]
        db.commit()
        db.refresh(session)
        report = scorecard

    return {
        "session_id": session.id,
        "transcript": session.transcript,
        "is_complete": is_complete,
        "report": report
    }


@router.post("/practice/{session_id}/finish")
def finish_practice_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    scorecard = MockInterviewBot.grade_session(session.transcript or [], job=job, niche=session.niche)

    session.overall_score = scorecard["overall_score"]
    session.strong_areas = scorecard["strong_areas"]
    session.weak_areas = scorecard["weak_areas"]
    session.suggestions = scorecard["suggestions"]
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "overall_score": session.overall_score,
        "strong_areas": session.strong_areas,
        "weak_areas": session.weak_areas,
        "suggestions": session.suggestions,
        "shared_with_company": session.shared_with_company,
        "transcript": session.transcript
    }


@router.get("/practice/{session_id}")
def get_practice_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    return {
        "id": session.id,
        "candidate_id": session.candidate_id,
        "job_id": session.job_id,
        "job_title": job.title if job else f"{session.niche.title()} Role",
        "niche": session.niche,
        "transcript": session.transcript,
        "overall_score": session.overall_score,
        "strong_areas": session.strong_areas,
        "weak_areas": session.weak_areas,
        "suggestions": session.suggestions,
        "shared_with_company": session.shared_with_company,
        "shared_at": session.shared_at,
        "created_at": session.created_at
    }


@router.post("/practice/{session_id}/share")
def toggle_practice_session_sharing(
    session_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    should_share = payload.get("share", True)
    session.shared_with_company = should_share
    session.shared_at = get_utc_now() if should_share else None
    db.commit()
    db.refresh(session)

    # Log to audit trail
    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    audit = AuditLog(
        tenant_id=candidate.tenant_id if candidate else "default",
        user_id=session.candidate_id,
        actor_name=candidate.name if candidate else "Candidate",
        actor_email=candidate.email if candidate else "candidate@hiretalentiq.com",
        action="SHARE_PRACTICE_INTERVIEW" if should_share else "UNSHARE_PRACTICE_INTERVIEW",
        entity_type="InterviewPracticeSession",
        entity_id=session.id,
        changes={"shared": should_share, "score": session.overall_score}
    )
    db.add(audit)
    db.commit()

    return {
        "session_id": session.id,
        "shared_with_company": session.shared_with_company,
        "shared_at": session.shared_at
    }


@router.get("/readiness")
def get_candidate_readiness(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    niche: Optional[str] = "tech",
    db: Session = Depends(get_db)
):
    candidate = None
    if candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        candidate = db.query(Candidate).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = None
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()

    readiness = MatchingEngine.compute_skill_readiness(
        candidate=candidate,
        job=job,
        niche=niche or "tech",
        db=db
    )
    return readiness


@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate).filter(Candidate.id == candidate_id)
    if current_user.role != "superadmin":
        query = query.filter(Candidate.tenant_id == current_user.tenant_id)
    cand = query.first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return map_candidate_to_response(cand)

@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: str,
    payload: CandidateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate).filter(Candidate.id == candidate_id)
    if current_user.role != "superadmin":
        query = query.filter(Candidate.tenant_id == current_user.tenant_id)
    cand = query.first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    update_dict = payload.model_dump(exclude_unset=True)
    if "expertise" in update_dict and update_dict["expertise"]:
        skills_from_exp = [{"name": s, "level": "Mid", "category": "General"} for s in update_dict.pop("expertise")]
        cand.skills = skills_from_exp

    if "availability_status" in update_dict:
        cand.availability = update_dict.pop("availability_status")

    for k, v in update_dict.items():
        if hasattr(cand, k) and v is not None:
            setattr(cand, k, v)

    db.commit()
    db.refresh(cand)

    # Re-evaluate matching scores
    MatchingEngine.sync_candidate_matches(cand, db)
    return map_candidate_to_response(cand)

@router.delete("/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Candidate).filter(Candidate.id == candidate_id)
    if current_user.role != "superadmin":
        query = query.filter(Candidate.tenant_id == current_user.tenant_id)
    cand = query.first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(cand)
    db.commit()
    return None

# ── Bulk Resume Upload (Path B) ──────────────────────────────────────────────

@router.post("/bulk-upload", response_model=List[CandidateResponse])
async def bulk_upload_resumes(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.tenant_id
    if not tenant_id and current_user.role == "superadmin":
        first_t = db.query(Tenant).first()
        tenant_id = first_t.id if first_t else None

    created_candidates = []

    for file in files:
        file_bytes = await file.read()
        filename = file.filename or "resume.pdf"
        
        # 1. Save resume to persistent storage
        file_ref = StorageService.save_resume(file_bytes, filename)
        
        # 2. Extract text & structured profile
        raw_text = ResumeParserService.extract_text_from_bytes(file_bytes, filename)
        profile_data = ResumeParserService.parse_resume_to_profile(raw_text, filename)

        # 3. Create Candidate record with source: "bulk_upload"
        cand = Candidate(
            tenant_id=tenant_id,
            name=profile_data.get("name") or filename,
            email=profile_data.get("email"),
            phone=profile_data.get("phone"),
            title=profile_data.get("title") or "Candidate",
            bio=profile_data.get("bio"),
            current_location=profile_data.get("current_location") or "Remote",
            years_of_experience=profile_data.get("experience_years") or 2.0,
            skills=profile_data.get("skills") or [],
            source="bulk_upload",
            resume_file_ref=file_ref,
            parsing_confidence=profile_data.get("parsing_confidence") or 0.85,
            niche_data=profile_data.get("niche_data") or {},
            lifecycle_status="Internal Candidate",
            is_internal_candidate=True,
            is_active=True
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)

        # 4. Generate AI matches with explainability
        MatchingEngine.sync_candidate_matches(cand, db)
        created_candidates.append(cand)

    # Audit log
    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=current_user.id,
        actor_name=current_user.name,
        actor_email=current_user.email,
        action="BULK_UPLOAD_RESUMES",
        entity_type="Candidate",
        changes={"count": len(created_candidates)}
    )
    db.add(audit)
    db.commit()

    return [map_candidate_to_response(c) for c in created_candidates]


# ─────────────────────────────────────────────────────────────
# 🎯 PHASE 7: AI MOCK INTERVIEW PRACTICE & SKILL READINESS
# ─────────────────────────────────────────────────────────────

from app.db.models import InterviewPracticeSession, Job, get_utc_now
from app.services.mock_interview_bot import MockInterviewBot
from typing import Dict, Any

@router.post("/practice/start")
def start_practice_session(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    candidate_id = payload.get("candidate_id")
    job_id = payload.get("job_id")
    niche = payload.get("niche", "tech")

    # Find or fallback candidate
    candidate = None
    if candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        candidate = db.query(Candidate).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = None
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job and job.niche:
            niche = job.niche

    questions = MockInterviewBot.generate_questions(job=job, niche=niche)
    initial_q = questions[0]["question"] if questions else "Welcome! Tell me about your background."

    transcript = [
        {
            "role": "ai",
            "content": f"Hello {candidate.name}! I will be your AI interviewer for this {job.title if job else niche.title()} practice session. Let's begin.",
            "question_id": "intro"
        },
        {
            "role": "ai",
            "content": initial_q,
            "question_id": questions[0]["id"] if questions else "q1",
            "question_index": 0,
            "category": questions[0].get("category") if questions else "General"
        }
    ]

    session = InterviewPracticeSession(
        candidate_id=candidate.id,
        job_id=job.id if job else None,
        niche=niche,
        transcript=transcript,
        overall_score=None,
        strong_areas=[],
        weak_areas=[],
        suggestions=[],
        shared_with_company=False
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "job_id": job.id if job else None,
        "job_title": job.title if job else f"{niche.title()} Role",
        "niche": niche,
        "questions": questions,
        "current_question_index": 0,
        "transcript": session.transcript
    }


@router.post("/practice/{session_id}/message")
def post_practice_message(
    session_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    user_message = payload.get("message", "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    questions = MockInterviewBot.generate_questions(job=job, niche=session.niche)

    current_transcript = list(session.transcript or [])
    current_transcript.append({
        "role": "candidate",
        "content": user_message
    })

    # Determine current question progress
    ai_questions = [t for t in current_transcript if t.get("role") == "ai" and t.get("question_index") is not None]
    current_q_idx = ai_questions[-1]["question_index"] if ai_questions else 0
    current_q_item = questions[current_q_idx] if current_q_idx < len(questions) else questions[-1]

    # Calculate how many turns the candidate has answered for this specific question
    cand_turns_for_current_q = 0
    for t in reversed(current_transcript):
        if t.get("role") == "ai" and t.get("question_index") is not None:
            break
        if t.get("role") == "candidate":
            cand_turns_for_current_q += 1

    # Check for adaptive follow-up probing
    eval_res = MockInterviewBot.evaluate_response(
        question_item=current_q_item,
        user_answer=user_message,
        turn_count_for_question=cand_turns_for_current_q
    )

    is_complete = False
    if eval_res["needs_follow_up"] and eval_res["follow_up_question"]:
        current_transcript.append({
            "role": "ai",
            "content": eval_res["follow_up_question"],
            "is_follow_up": True,
            "question_index": current_q_idx
        })
    else:
        # Move to next question or complete
        next_q_idx = current_q_idx + 1
        if next_q_idx < len(questions):
            next_q = questions[next_q_idx]
            current_transcript.append({
                "role": "ai",
                "content": f"Thank you. Let's move on to the next question: {next_q['question']}",
                "question_id": next_q["id"],
                "question_index": next_q_idx,
                "category": next_q.get("category")
            })
        else:
            is_complete = True
            current_transcript.append({
                "role": "ai",
                "content": "That concludes our mock interview practice session! Generating your structured performance evaluation now...",
                "is_conclusion": True
            })

    session.transcript = current_transcript
    db.commit()

    report = None
    if is_complete:
        scorecard = MockInterviewBot.grade_session(current_transcript, job=job, niche=session.niche)
        session.overall_score = scorecard["overall_score"]
        session.strong_areas = scorecard["strong_areas"]
        session.weak_areas = scorecard["weak_areas"]
        session.suggestions = scorecard["suggestions"]
        db.commit()
        db.refresh(session)
        report = scorecard

    return {
        "session_id": session.id,
        "transcript": session.transcript,
        "is_complete": is_complete,
        "report": report
    }


@router.post("/practice/{session_id}/finish")
def finish_practice_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    scorecard = MockInterviewBot.grade_session(session.transcript or [], job=job, niche=session.niche)

    session.overall_score = scorecard["overall_score"]
    session.strong_areas = scorecard["strong_areas"]
    session.weak_areas = scorecard["weak_areas"]
    session.suggestions = scorecard["suggestions"]
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "overall_score": session.overall_score,
        "strong_areas": session.strong_areas,
        "weak_areas": session.weak_areas,
        "suggestions": session.suggestions,
        "shared_with_company": session.shared_with_company,
        "transcript": session.transcript
    }


@router.get("/practice/{session_id}")
def get_practice_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    job = db.query(Job).filter(Job.id == session.job_id).first() if session.job_id else None
    return {
        "id": session.id,
        "candidate_id": session.candidate_id,
        "job_id": session.job_id,
        "job_title": job.title if job else f"{session.niche.title()} Role",
        "niche": session.niche,
        "transcript": session.transcript,
        "overall_score": session.overall_score,
        "strong_areas": session.strong_areas,
        "weak_areas": session.weak_areas,
        "suggestions": session.suggestions,
        "shared_with_company": session.shared_with_company,
        "shared_at": session.shared_at,
        "created_at": session.created_at
    }


@router.post("/practice/{session_id}/share")
def toggle_practice_session_sharing(
    session_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    session = db.query(InterviewPracticeSession).filter(InterviewPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")

    should_share = payload.get("share", True)
    session.shared_with_company = should_share
    session.shared_at = get_utc_now() if should_share else None
    db.commit()
    db.refresh(session)

    # Log to audit trail
    candidate = db.query(Candidate).filter(Candidate.id == session.candidate_id).first()
    audit = AuditLog(
        tenant_id=candidate.tenant_id if candidate else "default",
        user_id=session.candidate_id,
        actor_name=candidate.name if candidate else "Candidate",
        actor_email=candidate.email if candidate else "candidate@hiretalentiq.com",
        action="SHARE_PRACTICE_INTERVIEW" if should_share else "UNSHARE_PRACTICE_INTERVIEW",
        entity_type="InterviewPracticeSession",
        entity_id=session.id,
        changes={"shared": should_share, "score": session.overall_score}
    )
    db.add(audit)
    db.commit()

    return {
        "session_id": session.id,
        "shared_with_company": session.shared_with_company,
        "shared_at": session.shared_at
    }


@router.get("/readiness")
@router.get("/{candidate_id}/readiness")
def get_candidate_readiness(
    candidate_id: Optional[str] = None,
    job_id: Optional[str] = None,
    niche: Optional[str] = "tech",
    db: Session = Depends(get_db)
):
    candidate = None
    if candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        candidate = db.query(Candidate).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = None
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()

    readiness = MatchingEngine.compute_skill_readiness(
        candidate=candidate,
        job=job,
        niche=niche or "tech",
        db=db
    )
    return readiness

