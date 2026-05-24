from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import date
from uuid import UUID
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, AuditLog, Parent, RoleCode, Student, StudentFeeStatus, UserProfile
from app.schemas import AuditLogOut
from app.services.audit import log_action

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

DIRECTION_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.DIRECTEUR, RoleCode.PREFET}
AUDIT_VIEW_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.DIRECTEUR, RoleCode.PREFET, RoleCode.ADMIN_ECOLE}
RESTORABLE_ENTITIES = {"students", "profiles", "student_fee_statuses", "parent_students"}


def _can_restore_log(log: AuditLog, user: UserProfile) -> bool:
    if user.role not in DIRECTION_ROLES:
        return False
    if log.user_role != RoleCode.ADMIN_ECOLE.value:
        return False
    if log.entity_type not in RESTORABLE_ENTITIES:
        return False
    if not log.old_value and log.action not in {AuditAction.CREATE_USER}:
        return False
    return True


def _to_out(log: AuditLog, user: UserProfile) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        action=log.action.value if hasattr(log.action, "value") else str(log.action),
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        user_role=log.user_role,
        reason=log.reason,
        old_value=log.old_value,
        new_value=log.new_value,
        created_at=log.created_at,
        can_restore=_can_restore_log(log, user),
    )


@router.get("", response_model=list[AuditLogOut])
def list_logs(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in AUDIT_VIEW_ROLES:
        return []
    q = db.query(AuditLog)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(AuditLog.school_id == user.school_id)
    logs = q.order_by(AuditLog.created_at.desc()).limit(200).all()
    return [_to_out(log, user) for log in logs]


@router.post("/{log_id}/restore")
def restore_audit_action(log_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Annule une modification faite par un administrateur simple.

    La restauration est volontairement réservée au Préfet, Directeur ou Super Admin.
    Les actions du Préfet/Directeur ne sont pas exposées comme restaurables par les autres rôles.
    """
    log = db.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Action d'audit introuvable.")
    if user.role != RoleCode.SUPER_ADMIN:
        ensure_same_school(user, log.school_id)
    if not _can_restore_log(log, user):
        raise HTTPException(status_code=403, detail="Cette action n'est pas restaurable par votre rôle.")

    if log.entity_type == "students":
        target = db.get(Student, log.entity_id)
        if not target:
            raise HTTPException(status_code=404, detail="Élève introuvable pour restauration.")
        old = log.old_value or {}
        for field in ["matricule", "last_name", "middle_name", "first_name", "sex", "birth_place", "address", "status", "photo_path"]:
            if field in old:
                setattr(target, field, old[field])
        if "birth_date" in old:
            target.birth_date = date.fromisoformat(old["birth_date"]) if old["birth_date"] else None
        if "class_id" in old and old["class_id"]:
            target.class_id = UUID(str(old["class_id"]))

    elif log.entity_type == "profiles":
        target = db.get(UserProfile, log.entity_id)
        if not target:
            raise HTTPException(status_code=404, detail="Compte utilisateur introuvable pour restauration.")
        if log.action == AuditAction.CREATE_USER:
            target.is_active = False
        else:
            old = log.old_value or {}
            if "full_name" in old:
                target.full_name = old["full_name"]
            if "role" in old and old["role"]:
                target.role = RoleCode(old["role"])
            if "is_active" in old:
                target.is_active = old["is_active"]
            if "photo_path" in old:
                target.photo_path = old["photo_path"]

    elif log.entity_type == "student_fee_statuses":
        # entity_id contient l'id de l'élève dans les routes de paiement.
        target = db.query(StudentFeeStatus).filter(StudentFeeStatus.student_id == log.entity_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Statut financier introuvable pour restauration.")
        old = log.old_value or {}
        if "total_due" in old:
            target.total_due = old["total_due"]
        if "total_paid" in old:
            target.total_paid = old["total_paid"]
        if "status" in old and old["status"]:
            target.status = old["status"]
        if "override" in old:
            target.bulletin_access_override = old["override"]

    else:
        raise HTTPException(status_code=422, detail="Type d'action non restaurable.")

    log_action(
        db,
        user=user,
        action=AuditAction.RESTORE_AUDIT,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        old_value=log.new_value,
        new_value=log.old_value,
        reason=f"Restauration de l'action audit {log.id}",
        **request_meta(request),
    )
    db.commit()
    return {"message": "Modification restaurée par la direction."}
