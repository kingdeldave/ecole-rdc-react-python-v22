from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassRoom, Enrollment, RoleCode, SchoolYear, Student, StudentFeeStatus, UserProfile
from app.schemas import EnrollmentCreate, EnrollmentOut, ReEnrollmentCreate
from app.services.audit import log_action

router = APIRouter(prefix="/enrollments", tags=["enrollments"])
MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _require_management(user: UserProfile) -> None:
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Gestion des inscriptions non autorisée.")


def _out(row: Enrollment) -> EnrollmentOut:
    return EnrollmentOut(
        id=row.id,
        student_id=row.student_id,
        student_name=row.student.full_name,
        matricule=row.student.matricule,
        school_year_id=row.school_year_id,
        school_year_label=row.school_year.label,
        class_id=row.class_id,
        class_name=row.classroom.name,
        enrollment_type=row.enrollment_type,
        status=row.status,
        decision=row.decision,
        notes=row.notes,
        created_at=row.created_at,
    )


@router.get("", response_model=list[EnrollmentOut])
def list_enrollments(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(Enrollment).join(Student, Student.id == Enrollment.student_id)
    if user.role == RoleCode.ELEVE:
        q = q.filter(Student.profile_id == user.id)
    elif user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(Enrollment.school_id == user.school_id)
    return [_out(row) for row in q.order_by(Enrollment.created_at.desc()).limit(300).all()]


@router.post("", response_model=EnrollmentOut)
def create_enrollment(payload: EnrollmentCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _require_management(user)
    student = db.get(Student, payload.student_id)
    year = db.get(SchoolYear, payload.school_year_id)
    classroom = db.get(ClassRoom, payload.class_id)
    if not student or not year or not classroom:
        raise HTTPException(status_code=404, detail="Élève, année ou classe introuvable.")
    ensure_same_school(user, student.school_id)
    if student.school_id != classroom.school_id or student.school_id != year.school_id:
        raise HTTPException(status_code=400, detail="Élève, classe et année doivent appartenir à la même école.")
    existing = db.query(Enrollment).filter(Enrollment.student_id == student.id, Enrollment.school_year_id == year.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Cet élève possède déjà une inscription pour cette année.")
    row = Enrollment(
        school_id=student.school_id,
        student_id=student.id,
        school_year_id=year.id,
        class_id=classroom.id,
        enrollment_type=payload.enrollment_type,
        status=payload.status,
        decision=payload.decision,
        notes=payload.notes,
        created_by_id=user.id,
    )
    student.class_id = classroom.id
    db.add(row)
    fee = StudentFeeStatus(school_id=student.school_id, student_id=student.id, school_year_id=year.id, total_due=0, total_paid=0)
    db.add(fee)
    log_action(db, user=user, action=AuditAction.CREATE_ENROLLMENT, entity_type="enrollments", new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post("/reenroll", response_model=EnrollmentOut)
def reenroll(payload: ReEnrollmentCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _require_management(user)
    create_payload = EnrollmentCreate(
        student_id=payload.student_id,
        school_year_id=payload.target_school_year_id,
        class_id=payload.target_class_id,
        enrollment_type="reinscription",
        status="actif",
        decision=payload.decision,
        notes=payload.notes,
    )
    result = create_enrollment(create_payload, request, db, user)
    log_action(db, user=user, action=AuditAction.REENROLL_STUDENT, entity_type="students", entity_id=str(payload.student_id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    return result
