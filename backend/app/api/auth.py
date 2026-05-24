from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.deps import get_current_user, request_meta
from app.models import AuditAction, UserProfile
from app.schemas import LoginIn, ProfilePhotoUpdate, ProfileUpdate, TokenOut, UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Connexion par email et mot de passe."""
    user = db.query(UserProfile).filter(UserProfile.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe incorrect.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé.")

    meta = request_meta(request)
    log_action(db, user=user, action=AuditAction.LOGIN, entity_type="profiles", entity_id=str(user.id), **meta)
    db.commit()

    token = create_access_token(str(user.id), {"role": user.role.value, "school_id": str(user.school_id) if user.school_id else None})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: UserProfile = Depends(get_current_user)):
    """Retourne le profil connecté."""
    return user


@router.patch("/me/photo", response_model=UserOut)
def update_my_photo(payload: ProfilePhotoUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Met à jour la photo du profil connecté.

    En développement, le frontend envoie une data URL base64.
    En production, remplacer ce stockage direct par Supabase Storage privé.
    """
    user.photo_path = payload.photo_path
    log_action(
        db,
        user=user,
        action=AuditAction.UPDATE_USER,
        entity_type="profiles",
        entity_id=str(user.id),
        new_value={"photo_updated": bool(payload.photo_path)},
        **request_meta(request),
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me/profile", response_model=UserOut)
def update_my_profile(payload: ProfileUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Met à jour le profil connecté : nom, téléphone et photo.

    Tous les rôles utilisent cette route : professeur, parent, direction, admin, élève.
    """
    old_value = {"full_name": user.full_name, "phone": user.phone, "photo_updated": bool(user.photo_path)}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    if payload.photo_path is not None:
        user.photo_path = payload.photo_path
    log_action(
        db,
        user=user,
        action=AuditAction.UPDATE_USER,
        entity_type="profiles",
        entity_id=str(user.id),
        old_value=old_value,
        new_value={"full_name": user.full_name, "phone": user.phone, "photo_updated": bool(user.photo_path)},
        **request_meta(request),
    )
    db.commit()
    db.refresh(user)
    return user
