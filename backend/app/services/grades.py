from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models import ClassSubject, Grade, GradeHistory, PeriodCode, RoleCode, UserProfile


def max_for_period(class_subject: ClassSubject, period_code: PeriodCode) -> float:
    """Retourne le maximum autorisé pour une période donnée."""
    mapping = {
        PeriodCode.P1: class_subject.max_p1,
        PeriodCode.P2: class_subject.max_p2,
        PeriodCode.EX1: class_subject.max_ex1,
        PeriodCode.P3: class_subject.max_p3,
        PeriodCode.P4: class_subject.max_p4,
        PeriodCode.EX2: class_subject.max_ex2,
        PeriodCode.RATTRAPAGE: class_subject.max_rattrapage,
        PeriodCode.TENASOP: class_subject.max_tenasop,
        PeriodCode.BAC: class_subject.max_bac,
    }
    return float(mapping[period_code])


def assert_can_enter_grade(user: UserProfile, class_subject: ClassSubject):
    """Contrôle qu'un enseignant ne saisit que ses propres cours."""
    if user.role in {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}:
        return
    if user.role == RoleCode.ENSEIGNANT and class_subject.teacher_id == user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez pas saisir ces points.")


def upsert_grade(
    db: Session,
    *,
    user: UserProfile,
    student_id,
    class_subject: ClassSubject,
    period_code: PeriodCode,
    value: float,
    reason: str | None = None,
) -> Grade:
    """Crée ou modifie une note avec validation du maximum et historique."""
    max_value = max_for_period(class_subject, period_code)
    if value < 0:
        raise HTTPException(status_code=422, detail="La note ne peut pas être négative.")
    if value > max_value:
        raise HTTPException(status_code=422, detail=f"La note {value} dépasse le maximum autorisé {max_value}.")

    grade = (
        db.query(Grade)
        .filter(
            Grade.student_id == student_id,
            Grade.class_subject_id == class_subject.id,
            Grade.period_code == period_code,
        )
        .first()
    )

    if grade and grade.locked and user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Cette note est verrouillée après envoi. La correction doit passer par la direction.")
    if grade and grade.locked and user.role in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN} and not reason:
        raise HTTPException(status_code=422, detail="Motif obligatoire pour modifier une note déjà verrouillée.")

    should_lock = user.role == RoleCode.ENSEIGNANT

    if grade:
        old = grade.value
        grade.value = value
        grade.max_value = max_value
        grade.entered_by_id = user.id
        if should_lock:
            grade.locked = True
        db.add(GradeHistory(grade_id=grade.id, old_value=old, new_value=value, changed_by_id=user.id, reason=reason))
    else:
        grade = Grade(
            school_id=class_subject.school_id,
            student_id=student_id,
            class_subject_id=class_subject.id,
            period_code=period_code,
            value=value,
            max_value=max_value,
            entered_by_id=user.id,
            locked=should_lock,
        )
        db.add(grade)
        db.flush()
        db.add(GradeHistory(grade_id=grade.id, old_value=None, new_value=value, changed_by_id=user.id, reason=reason))
    return grade
