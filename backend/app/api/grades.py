from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassSubject, Grade, Period, RoleCode, Student, UserProfile
from app.schemas import GradeBulkIn, GradeOut, GradeUnlockIn, GradeLockToggleIn
from app.services.audit import log_action
from app.services.grades import assert_can_enter_grade, upsert_grade

router = APIRouter(prefix="/grades", tags=["grades"])

DIRECTION_ROLES = {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}


@router.get("/class/{class_id}", response_model=list[GradeOut])
def list_grades(class_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Retourne les notes d'une classe.

    Les parents et élèves ne peuvent pas contourner le blocage financier par accès direct API.
    """
    if user.role in {RoleCode.PARENT, RoleCode.ELEVE}:
        raise HTTPException(status_code=403, detail="Les points détaillés sont accessibles uniquement via le bulletin publié et selon le statut de paiement.")
    q = db.query(Grade).join(Student, Student.id == Grade.student_id).filter(Student.class_id == class_id)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(Grade.school_id == user.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        q = q.join(ClassSubject, ClassSubject.id == Grade.class_subject_id).filter(ClassSubject.teacher_id == user.id)
    return q.all()


@router.post("/bulk", response_model=list[GradeOut])
def save_grade_bulk(payload: GradeBulkIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Saisie de points en masse comme dans un tableau Excel."""
    class_subject = db.get(ClassSubject, payload.class_subject_id)
    if not class_subject:
        raise HTTPException(status_code=404, detail="Cours de classe introuvable.")
    ensure_same_school(user, class_subject.school_id)
    assert_can_enter_grade(user, class_subject)

    period_state = (
        db.query(Period)
        .filter(Period.school_year_id == class_subject.classroom.school_year_id, Period.code == payload.period_code)
        .first()
    )
    if period_state and period_state.is_closed and user.role not in DIRECTION_ROLES:
        raise HTTPException(status_code=403, detail="Cette période est clôturée. La correction doit passer par la direction.")

    saved = []
    skipped_locked = 0
    for cell in payload.grades:
        student = db.get(Student, cell.student_id)
        if not student or student.class_id != class_subject.class_id:
            continue

        # Important : quand la direction déverrouille un élève précis pour rattrapage
        # ou correction, le professeur ne doit pas être bloqué par les autres élèves
        # qui restent verrouillés. Les lignes encore verrouillées sont ignorées,
        # et seules les lignes ouvertes sont renvoyées à la direction.
        existing = (
            db.query(Grade)
            .filter(Grade.student_id == cell.student_id, Grade.class_subject_id == class_subject.id, Grade.period_code == payload.period_code)
            .first()
        )
        if user.role == RoleCode.ENSEIGNANT and existing and existing.locked:
            skipped_locked += 1
            continue

        grade = upsert_grade(
            db,
            user=user,
            student_id=cell.student_id,
            class_subject=class_subject,
            period_code=payload.period_code,
            value=float(cell.value),
            reason=payload.reason,
        )
        saved.append(grade)

    log_action(
        db,
        user=user,
        action=AuditAction.ENTER_GRADE,
        entity_type="class_subject",
        entity_id=str(class_subject.id),
        new_value={"period_code": payload.period_code.value, "count": len(saved), "skipped_locked": skipped_locked},
        **request_meta(request),
    )
    db.commit()
    return saved


@router.post("/unlock")
def unlock_grades(payload: GradeUnlockIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Déverrouille les points d'un cours/période. Réservé à la direction.

    Usage : un professeur a envoyé les points, ils sont verrouillés ; la direction peut
    les déverrouiller avec un motif obligatoire afin de permettre une correction contrôlée.
    """
    if user.role not in DIRECTION_ROLES:
        raise HTTPException(status_code=403, detail="Déverrouillage réservé à la direction.")
    class_subject = db.get(ClassSubject, payload.class_subject_id)
    if not class_subject:
        raise HTTPException(status_code=404, detail="Cours de classe introuvable.")
    ensure_same_school(user, class_subject.school_id)
    query = (
        db.query(Grade)
        .filter(Grade.class_subject_id == class_subject.id, Grade.period_code == payload.period_code, Grade.locked == True)
    )
    if payload.student_id:
        query = query.filter(Grade.student_id == payload.student_id)
    rows = query.all()
    for grade in rows:
        grade.locked = False
    log_action(
        db,
        user=user,
        action=AuditAction.UNLOCK_GRADE,
        entity_type="class_subject",
        entity_id=str(class_subject.id),
        new_value={"period_code": payload.period_code.value, "unlocked": len(rows)},
        reason=payload.reason,
        **request_meta(request),
    )
    db.commit()
    return {"message": "Points déverrouillés par la direction.", "unlocked": len(rows)}


@router.post("/lock-toggle")
def lock_toggle_grade(payload: GradeLockToggleIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Verrouille ou déverrouille une note précise. Réservé à la direction.

    Contrairement au déverrouillage global, cette action cible un seul élève afin
    d'éviter d'ouvrir les points de toute la classe par erreur.
    """
    if user.role not in DIRECTION_ROLES:
        raise HTTPException(status_code=403, detail="Action réservée à la direction.")
    class_subject = db.get(ClassSubject, payload.class_subject_id)
    if not class_subject:
        raise HTTPException(status_code=404, detail="Cours de classe introuvable.")
    ensure_same_school(user, class_subject.school_id)
    grade = (
        db.query(Grade)
        .filter(
            Grade.class_subject_id == class_subject.id,
            Grade.student_id == payload.student_id,
            Grade.period_code == payload.period_code,
        )
        .first()
    )
    if not grade:
        raise HTTPException(status_code=404, detail="Note introuvable pour cet élève.")
    old_value = {"locked": grade.locked}
    grade.locked = payload.locked
    log_action(
        db,
        user=user,
        action=AuditAction.LOCK_GRADE_MANUAL if payload.locked else AuditAction.UNLOCK_GRADE,
        entity_type="grade",
        entity_id=str(grade.id),
        old_value=old_value,
        new_value={"locked": grade.locked, "period_code": payload.period_code.value},
        reason=payload.reason,
        **request_meta(request),
    )
    db.commit()
    return {"message": "Note verrouillée." if payload.locked else "Note déverrouillée.", "locked": grade.locked}
