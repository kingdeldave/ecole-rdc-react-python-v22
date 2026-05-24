from typing import Iterable
from uuid import UUID
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.security import decode_token
from app.db.session import get_db
from app.models import RoleCode, UserProfile


SENSITIVE_ROLES = {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserProfile:
    """Récupère l'utilisateur courant depuis le header Authorization."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant.")

    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide.")

    user = db.get(UserProfile, UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur inactif ou introuvable.")
    return user


def require_roles(*roles: RoleCode):
    """Crée une dépendance qui limite l'accès à certains rôles."""

    def guard(user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission insuffisante.")
        return user

    return guard


def ensure_same_school(user: UserProfile, school_id: UUID | None):
    """Empêche une école de lire ou modifier les données d'une autre école."""
    if user.role == RoleCode.SUPER_ADMIN:
        return
    if user.school_id is None or school_id != user.school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès interdit à cette école.")


def request_meta(request: Request) -> dict[str, str | None]:
    """Extrait IP et user-agent pour les logs."""
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    return {"ip_address": ip, "user_agent": request.headers.get("user-agent")}
