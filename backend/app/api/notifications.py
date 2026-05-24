from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models import Notification, UserProfile
from app.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    return db.query(Notification).filter(Notification.recipient_id == user.id).order_by(Notification.created_at.desc()).limit(100).all()


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    notif = db.get(Notification, notification_id)
    if not notif or notif.recipient_id != user.id:
        return {"message": "Notification introuvable."}
    notif.is_read = True
    db.commit()
    return {"message": "Notification lue."}
