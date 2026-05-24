from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.db.session import get_db
from app.deps import request_meta
from app.models import AuditAction, PasswordResetToken, UserProfile
from app.schemas import ForgotPasswordIn, ForgotPasswordOut, ResetPasswordIn
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/forgot-password", response_model=ForgotPasswordOut)
def forgot_password(payload: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserProfile).filter(UserProfile.email == payload.email.lower()).first()
    if not user:
        return ForgotPasswordOut(message="Si ce compte existe, une procédure de réinitialisation est créée.")
    raw_token = token_urlsafe(32)
    reset = PasswordResetToken(user_id=user.id, token_hash=hash_password(raw_token), expires_at=datetime.now(timezone.utc) + timedelta(minutes=30))
    db.add(reset)
    log_action(db, user=user, action=AuditAction.REQUEST_PASSWORD_RESET, entity_type="profiles", entity_id=str(user.id), **request_meta(request))
    db.commit()
    return ForgotPasswordOut(message="Lien de réinitialisation généré. En production, il sera envoyé par email.", dev_reset_token=raw_token)


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, request: Request, db: Session = Depends(get_db)):
    from app.core.security import verify_password
    now = datetime.now(timezone.utc)
    candidates = db.query(PasswordResetToken).filter(PasswordResetToken.used_at == None, PasswordResetToken.expires_at > now).all()
    token_row = next((row for row in candidates if verify_password(payload.token, row.token_hash)), None)
    if not token_row:
        raise HTTPException(status_code=400, detail="Jeton invalide ou expiré.")
    user = db.get(UserProfile, token_row.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    user.hashed_password = hash_password(payload.new_password)
    token_row.used_at = now
    log_action(db, user=user, action=AuditAction.RESET_PASSWORD, entity_type="profiles", entity_id=str(user.id), **request_meta(request))
    db.commit()
    return {"message": "Mot de passe réinitialisé."}
