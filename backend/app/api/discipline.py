from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, DisciplinaryAction, Parent, ParentStudent, RoleCode, Student, UserProfile
from app.schemas import DisciplinaryActionCreate, DisciplinaryActionOut
from app.services.audit import log_action
from app.services.notifications import create_notification

router = APIRouter(prefix="/discipline", tags=["discipline"])


def to_out(action: DisciplinaryAction, student: Student) -> DisciplinaryActionOut:
    return DisciplinaryActionOut(
        id=action.id,
        student_id=action.student_id,
        student_name=student.full_name,
        action_type=action.action_type,
        reason=action.reason,
        action_date=action.action_date,
        created_at=action.created_at,
    )


@router.get("", response_model=list[DisciplinaryActionOut])
def list_actions(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(DisciplinaryAction)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(DisciplinaryAction.school_id == user.school_id)
    if user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            return []
        ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
        q = q.filter(DisciplinaryAction.student_id.in_(ids))
    if user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        if not student:
            return []
        q = q.filter(DisciplinaryAction.student_id == student.id)
    rows = q.order_by(DisciplinaryAction.created_at.desc()).limit(200).all()
    return [to_out(a, db.get(Student, a.student_id)) for a in rows]


def _notify_all_school_users(db: Session, student: Student, action_type: str, reason: str) -> None:
    """Notifie tous les profils actifs de l'école lorsqu'un élève est puni.

    Les parents de l'élève reçoivent une formulation parentale. La direction, l'administration,
    la comptabilité, les enseignants et les autres comptes actifs reçoivent une notification interne.
    """
    parent_profile_ids = set()
    for link in db.query(ParentStudent).filter(ParentStudent.student_id == student.id).all():
        parent = db.get(Parent, link.parent_id)
        if parent and parent.profile_id:
            parent_profile_ids.add(parent.profile_id)

    recipients = db.query(UserProfile).filter(UserProfile.school_id == student.school_id, UserProfile.is_active == True).all()
    for recipient in recipients:
        is_parent = recipient.id in parent_profile_ids
        create_notification(
            db,
            recipient=recipient,
            notif_type="DISCIPLINE",
            title=f"Sanction disciplinaire : {action_type}",
            message=(
                f"Votre enfant {student.full_name} a reçu une sanction. Motif : {reason}"
                if is_parent
                else f"Sanction enregistrée pour {student.full_name}. Type : {action_type}. Motif : {reason}"
            ),
            action_url="/discipline",
            school_id=student.school_id,
            send_email=is_parent,
        )


@router.post("", response_model=DisciplinaryActionOut)
def create_action(payload: DisciplinaryActionCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in {RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Seule l'administration ou la direction peut sanctionner un élève.")
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)

    action = DisciplinaryAction(school_id=student.school_id, student_id=student.id, action_type=payload.action_type, reason=payload.reason, created_by_id=user.id)
    normalized_type = payload.action_type.lower()
    if normalized_type in {"suspension", "suspendu"}:
        student.status = "suspendu"
    if normalized_type in {"renvoi", "renvoyé", "exclusion"}:
        student.status = "renvoyé"
    db.add(action)
    db.flush()

    _notify_all_school_users(db, student, payload.action_type, payload.reason)

    log_action(db, user=user, action=AuditAction.CREATE_DISCIPLINARY_ACTION, entity_type="disciplinary_action", entity_id=str(action.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(action)
    return to_out(action, student)
