from typing import Optional
from sqlalchemy.orm import Session
from app.db.models import Notification, AuditLog

class NotificationService:
    @staticmethod
    def send_notification(
        db: Session,
        tenant_id: Optional[str],
        type: str,
        title: str,
        message: str,
        recipient_id: Optional[str] = None,
        recipient_email: Optional[str] = None,
        recipient_phone: Optional[str] = None,
        channel: str = "in_app",
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[str] = None,
    ) -> Notification:
        """Dispatches an in-app notification and records email/sms event."""
        notif = Notification(
            tenant_id=tenant_id,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            recipient_phone=recipient_phone,
            type=type,
            channel=channel,
            title=title,
            message=message,
            status="unread",
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def notify_shortlist(db: Session, match_id: str):
        from app.db.models import Match
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return
        
        # Notify candidate
        cand = match.candidate
        job = match.job
        if cand and cand.email:
            NotificationService.send_notification(
                db=db,
                tenant_id=match.tenant_id,
                type="candidate_shortlisted",
                channel="email",
                title=f"Great news! You have been shortlisted for {job.title}",
                message=f"Hi {cand.name}, the recruiting team at {match.tenant.name if match.tenant else 'HireTalentIQ'} has shortlisted your profile for the {job.title} role. Check your candidate portal for updates.",
                recipient_email=cand.email,
                related_entity_type="match",
                related_entity_id=match.id
            )

        # Notify recruiter
        NotificationService.send_notification(
            db=db,
            tenant_id=match.tenant_id,
            type="recruiter_shortlist_action",
            channel="in_app",
            title=f"Candidate Shortlisted: {cand.name}",
            message=f"{cand.name} was moved to the shortlist for {job.title} ({match.ai_score}% match).",
            related_entity_type="candidate",
            related_entity_id=cand.id
        )

    @staticmethod
    def notify_interview_scheduled(db: Session, interview_id: str):
        from app.db.models import Interview
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            return
        
        cand = interview.candidate
        job = interview.job
        slot_str = interview.scheduled_for.strftime("%A, %B %d at %I:%M %p %Z") if interview.scheduled_for else "Upcoming"

        if cand and cand.email:
            NotificationService.send_notification(
                db=db,
                tenant_id=interview.tenant_id,
                type="interview_scheduled",
                channel="email",
                title=f"Interview Confirmed: {job.title if job else 'Screening'}",
                message=f"Hi {cand.name}, your interview has been scheduled for {slot_str}. Meeting Link: {interview.meeting_link or 'Available in portal'}.",
                recipient_email=cand.email,
                related_entity_type="interview",
                related_entity_id=interview.id
            )
