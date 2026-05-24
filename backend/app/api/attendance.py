from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AttendanceRecord, AuditAction, ClassRoom, Parent, ParentStudent, RoleCode, Student, UserProfile
from app.schemas import AttendanceBulkIn, AttendanceOut
from app.services.audit import log_action
from app.services.notifications import create_notification

router = APIRouter(prefix="/attendance", tags=["attendance"])
MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.ENSEIGNANT}


def _out(row: AttendanceRecord) -> AttendanceOut:
    return AttendanceOut(
        id=row.id,
        student_id=row.student_id,
        student_name=row.student.full_name,
        matricule=row.student.matricule,
        class_id=row.class_id,
        class_name=row.classroom.name,
        attendance_date=row.attendance_date,
        period_label=row.period_label,
        status=row.status,
        reason=row.reason,
        created_at=row.created_at,
    )


@router.get("", response_model=list[AttendanceOut])
def list_attendance(class_id: str | None = None, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(AttendanceRecord).join(Student, Student.id == AttendanceRecord.student_id)
    if user.role == RoleCode.ELEVE:
        q = q.filter(Student.profile_id == user.id)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()] if parent else []
        q = q.filter(AttendanceRecord.student_id.in_(ids)) if ids else q.filter(False)
    elif user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(AttendanceRecord.school_id == user.school_id)
    if class_id:
        q = q.filter(AttendanceRecord.class_id == class_id)
    return [_out(row) for row in q.order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc()).limit(500).all()]


@router.post("/bulk", response_model=list[AttendanceOut])
def save_attendance(payload: AttendanceBulkIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Appel non autorisé.")
    classroom = db.get(ClassRoom, payload.class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, classroom.school_id)
    saved: list[AttendanceRecord] = []
    for item in payload.records:
        student = db.get(Student, item.student_id)
        if not student or student.class_id != classroom.id:
            continue
        row = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.attendance_date == payload.attendance_date,
            AttendanceRecord.period_label == payload.period_label,
        ).first()
        if not row:
            row = AttendanceRecord(school_id=classroom.school_id, student_id=student.id, class_id=classroom.id, attendance_date=payload.attendance_date, period_label=payload.period_label, recorded_by_id=user.id)
            db.add(row)
        row.status = item.status
        row.reason = item.reason
        saved.append(row)
        if item.status in {"absent", "retard"}:
            for link in db.query(ParentStudent).filter(ParentStudent.student_id == student.id).all():
                parent = db.get(Parent, link.parent_id)
                if parent and parent.profile_id:
                    recipient = db.get(UserProfile, parent.profile_id)
                    if recipient:
                        create_notification(db, recipient=recipient, notif_type="PRESENCE", title="Présence scolaire", message=f"{student.full_name} est marqué {item.status} le {payload.attendance_date}.", action_url="/attendance", school_id=student.school_id, send_email=True)
    log_action(db, user=user, action=AuditAction.CREATE_ATTENDANCE, entity_type="attendance_records", new_value={"count": len(saved), "date": str(payload.attendance_date)}, **request_meta(request))
    db.commit()
    return [_out(row) for row in saved]
