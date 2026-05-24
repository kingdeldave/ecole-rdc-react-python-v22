from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user
from app.models import AuditAction, ClassSubject, CourseResource, Parent, ParentStudent, RoleCode, Student, UserProfile
from app.schemas import CourseResourceCreate, CourseResourceOut
from app.services.audit import log_action

router = APIRouter(prefix="/course-resources", tags=["course-resources"])


def to_out(resource: CourseResource, viewer: UserProfile | None = None) -> CourseResourceOut:
    hide_teacher_contact = bool(viewer and viewer.role == RoleCode.ELEVE)
    return CourseResourceOut(
        id=resource.id,
        class_subject_id=resource.class_subject_id,
        subject_name=resource.class_subject.subject.name,
        class_name=resource.class_subject.classroom.name,
        title=resource.title,
        description=resource.description,
        resource_type=resource.resource_type,
        url=resource.url,
        content=resource.content,
        is_published=resource.is_published,
        created_by_name=resource.created_by.full_name if resource.created_by else None,
        teacher_name=resource.class_subject.teacher.full_name if resource.class_subject.teacher else None,
        teacher_phone=None if hide_teacher_contact else (resource.class_subject.teacher.phone if resource.class_subject.teacher else None),
        schedule_label=resource.class_subject.schedule_label,
        created_at=resource.created_at,
    )


@router.get("", response_model=list[CourseResourceOut])
def list_resources(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(CourseResource).join(ClassSubject, ClassSubject.id == CourseResource.class_subject_id)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(CourseResource.school_id == user.school_id)

    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ClassSubject.teacher_id == user.id)
    elif user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        if not student:
            return []
        q = q.filter(ClassSubject.class_id == student.class_id, CourseResource.is_published == True)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if parent:
            student_ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
            class_ids = [s.class_id for s in db.query(Student).filter(Student.id.in_(student_ids)).all()] if student_ids else []
            q = q.filter(ClassSubject.class_id.in_(class_ids), CourseResource.is_published == True)
        else:
            return []
    return [to_out(r, user) for r in q.order_by(CourseResource.created_at.desc()).limit(200).all()]


@router.post("", response_model=CourseResourceOut)
def create_resource(payload: CourseResourceCreate, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    class_subject = db.get(ClassSubject, payload.class_subject_id)
    if not class_subject:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    ensure_same_school(user, class_subject.school_id)
    if user.role == RoleCode.ENSEIGNANT and class_subject.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez publier que les cours qui vous sont attribués.")
    if user.role not in {RoleCode.ENSEIGNANT, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Publication de cours non autorisée.")

    resource = CourseResource(
        school_id=class_subject.school_id,
        class_subject_id=payload.class_subject_id,
        title=payload.title,
        description=payload.description,
        resource_type=payload.resource_type,
        url=payload.url,
        content=payload.content,
        is_published=payload.is_published,
        created_by_id=user.id,
    )
    db.add(resource)
    db.flush()
    log_action(db, user=user, action=AuditAction.CREATE_COURSE_RESOURCE, entity_type="course_resource", entity_id=str(resource.id), new_value=payload.model_dump(mode="json"))
    db.commit()
    db.refresh(resource)
    return to_out(resource, user)
