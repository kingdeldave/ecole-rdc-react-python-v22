from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassSubject, ClassTitular, ExamSchedule, Parent, ParentStudent, RoleCode, Student, UserProfile
from app.schemas import ExamScheduleCreate, ExamScheduleOut
from app.services.audit import log_action
from app.services.notifications import create_notification

router = APIRouter(prefix="/exams", tags=["exams"])
MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _out(row: ExamSchedule) -> ExamScheduleOut:
    return ExamScheduleOut(
        id=row.id,
        class_id=row.class_id,
        class_name=row.classroom.name,
        class_option=row.classroom.option,
        class_subject_id=row.class_subject_id,
        subject_name=row.class_subject.subject.name,
        exam_date=row.exam_date,
        start_time=row.start_time,
        end_time=row.end_time,
        room=row.room,
        status=row.status,
        created_by_name=row.created_by.full_name if row.created_by else None,
        created_at=row.created_at,
    )


@router.get("", response_model=list[ExamScheduleOut])
def list_exams(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(ExamSchedule)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ExamSchedule.school_id == user.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        titular_class_ids = [row[0] for row in db.query(ClassTitular.class_id).filter(ClassTitular.teacher_id == user.id).all()]
        q = q.filter((ExamSchedule.created_by_id == user.id) | (ExamSchedule.class_id.in_(titular_class_ids)))
    elif user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        q = q.filter(ExamSchedule.class_id == student.class_id) if student else q.filter(False)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        ids = []
        if parent:
            student_ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
            ids = [x.class_id for x in db.query(Student).filter(Student.id.in_(student_ids)).all()] if student_ids else []
        q = q.filter(ExamSchedule.class_id.in_(ids)) if ids else q.filter(False)
    return [_out(row) for row in q.order_by(ExamSchedule.exam_date.desc(), ExamSchedule.start_time.asc()).all()]


@router.post("", response_model=ExamScheduleOut)
def create_exam(payload: ExamScheduleCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    cs = db.get(ClassSubject, payload.class_subject_id)
    if not cs:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    ensure_same_school(user, cs.school_id)
    is_titular = db.query(ClassTitular).filter(ClassTitular.class_id == cs.class_id, ClassTitular.teacher_id == user.id).first() is not None
    if user.role not in MANAGEMENT_ROLES and not is_titular:
        raise HTTPException(status_code=403, detail="Programmation d'examen réservée à l'administration, à la direction et au professeur titulaire.")
    row = ExamSchedule(
        school_id=cs.school_id,
        class_id=cs.class_id,
        class_subject_id=cs.id,
        exam_date=payload.exam_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room=payload.room or cs.classroom.room,
        status="PROGRAMME",
        created_by_id=user.id,
    )
    db.add(row)
    db.flush()

    # Notifications parent sans nom du professeur, conformément à la demande.
    students = db.query(Student).filter(Student.class_id == cs.class_id).all()
    student_ids = [s.id for s in students]
    parent_links = db.query(ParentStudent).filter(ParentStudent.student_id.in_(student_ids)).all() if student_ids else []
    parent_ids = {link.parent_id for link in parent_links if link.parent_id}
    parents = db.query(Parent).filter(Parent.id.in_(parent_ids)).all() if parent_ids else []
    class_label = f"{cs.classroom.name}{' - ' + cs.classroom.option if cs.classroom.option else ''}"
    title = "Examen programmé"
    message = (
        f"Un examen est programmé.\n"
        f"Cours : {cs.subject.name}\n"
        f"Classe : {class_label}\n"
        f"Date : {payload.exam_date.isoformat()}\n"
        f"Heure : {payload.start_time}\n"
        f"Salle : {row.room or 'Non précisée'}"
    )
    for parent in parents:
        if parent.profile:
            create_notification(db, recipient=parent.profile, notif_type="EXAMEN_PROGRAMME", title=title, message=message, action_url="/exams", school_id=cs.school_id, send_email=True)

    log_action(db, user=user, action=AuditAction.CREATE_EXAM, entity_type="exam_schedules", entity_id=str(row.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _out(row)
