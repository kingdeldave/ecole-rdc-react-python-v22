from typing import Any
from sqlalchemy.orm import Session
from app.models import AuditAction, AuditLog, RoleCode, UserProfile
from app.services.notifications import create_notification

SENSITIVE_ADMIN_ACTIONS = {
    AuditAction.CREATE_STUDENT,
    AuditAction.UPDATE_STUDENT,
    AuditAction.DELETE_STUDENT,
    AuditAction.UPDATE_FEE_STATUS,
    AuditAction.ENTER_GRADE,
    AuditAction.UPDATE_GRADE,
    AuditAction.PAYMENT_ADDED,
    AuditAction.CREATE_USER,
    AuditAction.UPDATE_USER,
    AuditAction.CREATE_SUBJECT,
    AuditAction.UPDATE_CLASS_SUBJECT_MAXIMA,
    AuditAction.CREATE_DISCIPLINARY_ACTION,
    AuditAction.IMPORT_EXCEL,
    AuditAction.EXPORT_EXCEL,
}


def _notify_direction_for_admin_change(db: Session, *, actor: UserProfile | None, action: AuditAction, entity_type: str | None, entity_id: str | None) -> None:
    """Alerte discrètement la direction lorsqu'un administrateur modifie des données sensibles.

    Le préfet/direction ne déclenche pas cette alerte : ils sont l'autorité scolaire.
    """
    if not actor or actor.role != RoleCode.ADMIN_ECOLE or action not in SENSITIVE_ADMIN_ACTIONS:
        return
    recipients = db.query(UserProfile).filter(
        UserProfile.school_id == actor.school_id,
        UserProfile.role.in_([RoleCode.PREFET, RoleCode.DIRECTEUR]),
        UserProfile.is_active == True,
    ).all()
    for recipient in recipients:
        create_notification(
            db,
            recipient=recipient,
            notif_type="ALERTE_ADMIN",
            title="Action administrative sensible",
            message=(
                f"{actor.full_name} a effectué l’action {action.value} sur {entity_type or 'une donnée'} "
                f"#{(entity_id or '')[:8]}. Vérifiez l’audit et restaurez si nécessaire."
            ),
            action_url="/audit-logs",
            school_id=actor.school_id,
            send_email=False,
        )


def log_action(
    db: Session,
    *,
    user: UserProfile | None,
    action: AuditAction,
    entity_type: str | None = None,
    entity_id: str | None = None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    reason: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """Enregistre une action sensible dans audit_logs et alerte la direction si l'action vient d'un admin simple."""
    log = AuditLog(
        school_id=user.school_id if user else None,
        user_id=user.id if user else None,
        user_role=user.role.value if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    _notify_direction_for_admin_change(db, actor=user, action=action, entity_type=entity_type, entity_id=entity_id)
    return log
