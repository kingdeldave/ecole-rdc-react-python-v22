from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassSubject, Parent, ParentStudent, RoleCode, ScheduleSlot, Student, UserProfile
from app.schemas import ScheduleSlotCreate, ScheduleSlotOut
from app.services.audit import log_action

router = APIRouter(prefix="/schedules", tags=["schedules"])
MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def _overlap(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    return _minutes(start_a) < _minutes(end_b) and _minutes(start_b) < _minutes(end_a)


def _out(row: ScheduleSlot) -> ScheduleSlotOut:
    return ScheduleSlotOut(
        id=row.id,
        class_subject_id=row.class_subject_id,
        class_id=row.class_id,
        class_name=row.classroom.name,
        subject_name=row.class_subject.subject.name,
        teacher_id=row.teacher_id,
        teacher_name=row.teacher.full_name if row.teacher else None,
        day_of_week=row.day_of_week,
        start_time=row.start_time,
        end_time=row.end_time,
        room=row.room,
        is_active=row.is_active,
    )


@router.get("", response_model=list[ScheduleSlotOut])
def list_schedules(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(ScheduleSlot)
    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ScheduleSlot.teacher_id == user.id)
    elif user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        q = q.filter(ScheduleSlot.class_id == student.class_id) if student else q.filter(False)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            q = q.filter(False)
        else:
            student_ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
            class_ids = [x.class_id for x in db.query(Student).filter(Student.id.in_(student_ids)).all()] if student_ids else []
            q = q.filter(ScheduleSlot.class_id.in_(class_ids)) if class_ids else q.filter(False)
    elif user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ScheduleSlot.school_id == user.school_id)
    return [_out(row) for row in q.order_by(ScheduleSlot.day_of_week, ScheduleSlot.start_time).all()]


@router.post("", response_model=ScheduleSlotOut)
def create_schedule(payload: ScheduleSlotCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Gestion horaire non autorisée.")
    class_subject = db.get(ClassSubject, payload.class_subject_id)
    if not class_subject:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    ensure_same_school(user, class_subject.school_id)
    if _minutes(payload.start_time) >= _minutes(payload.end_time):
        raise HTTPException(status_code=400, detail="L'heure de début doit être avant l'heure de fin.")
    existing = db.query(ScheduleSlot).filter(ScheduleSlot.school_id == class_subject.school_id, ScheduleSlot.day_of_week == payload.day_of_week, ScheduleSlot.is_active == True).all()
    conflicts = []
    for slot in existing:
        if not _overlap(payload.start_time, payload.end_time, slot.start_time, slot.end_time):
            continue
        if slot.class_id == class_subject.class_id:
            conflicts.append(f"Conflit classe {slot.classroom.name} avec {slot.class_subject.subject.name} {slot.start_time}-{slot.end_time}")
        if class_subject.teacher_id and slot.teacher_id == class_subject.teacher_id:
            conflicts.append(f"Conflit professeur {slot.teacher.full_name if slot.teacher else ''} {slot.start_time}-{slot.end_time}")
    if conflicts:
        raise HTTPException(status_code=409, detail=" | ".join(conflicts[:3]))
    row = ScheduleSlot(school_id=class_subject.school_id, class_subject_id=class_subject.id, class_id=class_subject.class_id, teacher_id=class_subject.teacher_id, day_of_week=payload.day_of_week, start_time=payload.start_time, end_time=payload.end_time, room=payload.room, created_by_id=user.id)
    class_subject.schedule_label = f"{payload.day_of_week} {payload.start_time}-{payload.end_time}{' · '+payload.room if payload.room else ''}"
    db.add(row)
    log_action(db, user=user, action=AuditAction.CREATE_SCHEDULE_SLOT, entity_type="schedule_slots", new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _out(row)
