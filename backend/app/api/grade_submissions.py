from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassSubject, ClassTitular, Grade, GradeSubmission, PeriodCode, RoleCode, Student, UserProfile
from app.schemas import GradeSubmissionCourseOut, GradeSubmissionCreate, GradeSubmissionOut
from app.services.audit import log_action
from app.services.notifications import create_notification

router = APIRouter(prefix="/grade-submissions", tags=["grade-submissions"])
DIRECTION_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}
DEFAULT_PERIODS = [PeriodCode.P1, PeriodCode.P2, PeriodCode.EX1, PeriodCode.P3, PeriodCode.P4, PeriodCode.EX2]


def _periods(payload: list[PeriodCode] | None) -> list[PeriodCode]:
    return payload or DEFAULT_PERIODS


def _stats(db: Session, cs: ClassSubject, periods: list[PeriodCode]) -> tuple[int, int, int]:
    students_total = db.query(Student).filter(Student.class_id == cs.class_id).count()
    grades_total = (
        db.query(Grade)
        .join(Student, Student.id == Grade.student_id)
        .filter(Student.class_id == cs.class_id, Grade.class_subject_id == cs.id, Grade.period_code.in_(periods))
        .count()
    )
    missing_total = max(students_total * len(periods) - grades_total, 0)
    return students_total, grades_total, missing_total


def _submission_out(row: GradeSubmission) -> GradeSubmissionOut:
    cs = row.class_subject
    return GradeSubmissionOut(
        id=row.id,
        class_subject_id=row.class_subject_id,
        class_id=row.class_id,
        class_name=row.classroom.name,
        class_option=row.classroom.option,
        subject_name=cs.subject.name,
        teacher_id=row.teacher_id,
        teacher_name=row.teacher.full_name,
        periods=[str(x) for x in (row.periods_json or [])],
        status=row.status,
        students_total=row.students_total,
        grades_total=row.grades_total,
        missing_total=row.missing_total,
        note=row.note,
        created_at=row.created_at,
        validated_at=row.validated_at,
    )


@router.get("/courses", response_model=list[GradeSubmissionCourseOut])
def list_submission_courses(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(ClassSubject)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ClassSubject.school_id == user.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ClassSubject.teacher_id == user.id)
    rows = q.order_by(ClassSubject.class_id, ClassSubject.display_order.asc()).all()
    out: list[GradeSubmissionCourseOut] = []
    for cs in rows:
        students_total, grades_total, missing_total = _stats(db, cs, DEFAULT_PERIODS)
        latest = (
            db.query(GradeSubmission)
            .filter(GradeSubmission.class_subject_id == cs.id)
            .order_by(GradeSubmission.created_at.desc())
            .first()
        )
        out.append(GradeSubmissionCourseOut(
            class_subject_id=cs.id,
            class_id=cs.class_id,
            class_name=cs.classroom.name,
            class_option=cs.classroom.option,
            subject_name=cs.subject.name,
            teacher_name=cs.teacher.full_name if cs.teacher else None,
            students_total=students_total,
            grades_total=grades_total,
            missing_total=missing_total,
            latest_status=latest.status if latest else None,
        ))
    return out


@router.get("", response_model=list[GradeSubmissionOut])
def list_submissions(class_id: str | None = None, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(GradeSubmission)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(GradeSubmission.school_id == user.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        titular_class_ids = [row[0] for row in db.query(ClassTitular.class_id).filter(ClassTitular.teacher_id == user.id).all()]
        q = q.filter((GradeSubmission.teacher_id == user.id) | (GradeSubmission.class_id.in_(titular_class_ids)))
    if class_id:
        q = q.filter(GradeSubmission.class_id == class_id)
    return [_submission_out(row) for row in q.order_by(GradeSubmission.created_at.desc()).limit(200).all()]


@router.post("", response_model=GradeSubmissionOut)
def send_grades_to_jury(payload: GradeSubmissionCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    cs = db.get(ClassSubject, payload.class_subject_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    ensure_same_school(user, cs.school_id)
    if user.role == RoleCode.ENSEIGNANT and cs.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez envoyer que les points de vos propres cours.")
    if user.role not in DIRECTION_ROLES and user.role != RoleCode.ENSEIGNANT:
        raise HTTPException(status_code=403, detail="Envoi des points non autorisé.")
    periods = _periods(payload.periods)
    students_total, grades_total, missing_total = _stats(db, cs, periods)
    if students_total == 0:
        raise HTTPException(status_code=400, detail="Aucun élève dans cette classe.")

    # Verrouillage des notes existantes envoyées au jury.
    grades = (
        db.query(Grade)
        .join(Student, Student.id == Grade.student_id)
        .filter(Student.class_id == cs.class_id, Grade.class_subject_id == cs.id, Grade.period_code.in_(periods))
        .all()
    )
    for grade in grades:
        grade.locked = True

    row = GradeSubmission(
        school_id=cs.school_id,
        class_subject_id=cs.id,
        class_id=cs.class_id,
        teacher_id=user.id,
        periods_json=[p.value for p in periods],
        status="ENVOYE_AU_JURY",
        students_total=students_total,
        grades_total=grades_total,
        missing_total=missing_total,
        note=payload.note,
    )
    db.add(row)
    db.flush()

    # Notification direction + titulaires de la classe.
    recipients = [u for u in db.query(UserProfile).filter(UserProfile.school_id == cs.school_id, UserProfile.role.in_(list(DIRECTION_ROLES)), UserProfile.is_active == True).all()]
    for titular in db.query(ClassTitular).filter(ClassTitular.class_id == cs.class_id).all():
        if titular.teacher and titular.teacher not in recipients:
            recipients.append(titular.teacher)
    title = "Points envoyés au jury"
    message = f"Les points de {cs.subject.name} - {cs.classroom.name}{' '+cs.classroom.option if cs.classroom.option else ''} ont été envoyés au jury. Lignes manquantes : {missing_total}."
    for recipient in recipients:
        create_notification(db, recipient=recipient, notif_type="POINTS_JURY", title=title, message=message, action_url="/jury-points", school_id=cs.school_id)

    log_action(db, user=user, action=AuditAction.SEND_GRADES_TO_JURY, entity_type="class_subject", entity_id=str(cs.id), new_value={"periods": [p.value for p in periods], "grades_total": grades_total, "missing_total": missing_total}, **request_meta(request))
    db.commit()
    db.refresh(row)
    return _submission_out(row)


@router.post("/{submission_id}/validate", response_model=GradeSubmissionOut)
def validate_submission(submission_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    row = db.get(GradeSubmission, submission_id)
    if not row:
        raise HTTPException(status_code=404, detail="Envoi introuvable.")
    ensure_same_school(user, row.school_id)
    titular = db.query(ClassTitular).filter(ClassTitular.class_id == row.class_id, ClassTitular.teacher_id == user.id).first()
    if user.role not in DIRECTION_ROLES and not titular:
        raise HTTPException(status_code=403, detail="Validation réservée au jury.")
    row.status = "VALIDE_PAR_JURY"
    row.validated_by_id = user.id
    row.validated_at = datetime.now(timezone.utc)
    log_action(db, user=user, action=AuditAction.VALIDATE_GRADES_JURY, entity_type="grade_submission", entity_id=str(row.id), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _submission_out(row)
