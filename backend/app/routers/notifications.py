from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Notification, User
from app.core.deps import get_current_user
from app.schemas.domain import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification)
    if current_user.role != "superadmin":
        query = query.filter(Notification.tenant_id == current_user.tenant_id)
    
    notifs = query.order_by(Notification.created_at.desc()).limit(50).all()
    return notifs

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.id == notification_id)
    if current_user.role != "superadmin":
        query = query.filter(Notification.tenant_id == current_user.tenant_id)
    notif = query.first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.status = "read"
    db.commit()
    db.refresh(notif)
    return notif
