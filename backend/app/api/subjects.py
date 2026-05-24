from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassRoom, ClassSubject, Parent, ParentStudent, RoleCode, Student, Subject, UserProfile
from app.schemas import ClassSubjectCreate, ClassSubjectMaximaUpdate, ClassSubjectOut, SubjectOut, TeacherScheduleCourseOut, TeacherScheduleOut
from app.services.audit import log_action

router = APIRouter(prefix="/subjects", tags=["subjects"])

COURSE_MANAGEMENT_ROLES = {RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}


def _require_course_manager(user: UserProfile) -> None:
    if user.role not in COURSE_MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Seule l'administration ou la direction peut gérer les cours.")


def _class_subject_to_out(row: ClassSubject, viewer: UserProfile | None = None) -> ClassSubjectOut:
    hide_teacher_contact = bool(viewer and viewer.role == RoleCode.ELEVE)
    return ClassSubjectOut(
        id=row.id,
        subject_id=row.subject_id,
        subject_name=row.subject.name,
        class_name=row.classroom.name if row.classroom else None,
        teacher_id=row.teacher_id,
        teacher_name=row.teacher.full_name if row.teacher else None,
        teacher_phone=None if hide_teacher_contact else (row.teacher.phone if row.teacher else None),
        schedule_label=row.schedule_label,
        max_p1=row.max_p1,
        max_p2=row.max_p2,
        max_ex1=row.max_ex1,
        max_p3=row.max_p3,
        max_p4=row.max_p4,
        max_ex2=row.max_ex2,
        max_rattrapage=row.max_rattrapage,
        max_tenasop=row.max_tenasop,
        max_bac=row.max_bac,
        display_order=row.display_order,
    )


@router.get("", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(Subject).filter(Subject.is_active == True)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(Subject.school_id == user.school_id)
    return q.order_by(Subject.display_order.asc()).all()


@router.get("/program", response_model=list[ClassSubjectOut])
def list_my_program(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Programme des cours visible selon le rôle.

    - Professeur : uniquement ses cours et horaires, dans toutes les classes.
    - Parent : les cours de tous ses enfants, avec professeur et numéro.
    - Élève : les cours de sa classe.
    - Direction/admin : tout le programme de l'école.
    """
    q = db.query(ClassSubject)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ClassSubject.school_id == user.school_id)

    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ClassSubject.teacher_id == user.id)
    elif user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        if not student:
            return []
        q = q.filter(ClassSubject.class_id == student.class_id)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            return []
        links = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()
        student_ids = [link.student_id for link in links]
        if not student_ids:
            return []
        class_ids = [row.class_id for row in db.query(Student).filter(Student.id.in_(student_ids)).all()]
        if not class_ids:
            return []
        q = q.filter(ClassSubject.class_id.in_(class_ids))

    rows = q.join(ClassRoom, ClassRoom.id == ClassSubject.class_id).join(Subject, Subject.id == ClassSubject.subject_id).order_by(ClassRoom.name.asc(), Subject.display_order.asc()).all()
    return [_class_subject_to_out(row, user) for row in rows]




@router.get("/teachers-schedule", response_model=list[TeacherScheduleOut])
def list_teachers_schedule(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Annuaire pédagogique filtré selon le rôle.

    - Administration / direction : tous les professeurs de l'école.
    - Professeur : uniquement son propre programme.
    - Parent : uniquement les professeurs des classes de ses enfants.
    - Élève : uniquement les professeurs de sa classe.

    Cette route alimente l'espace parent/élève/prof avec : nom du professeur,
    numéro, photo, cours, classes et horaires.
    """
    q = db.query(ClassSubject).join(ClassRoom, ClassRoom.id == ClassSubject.class_id).join(Subject, Subject.id == ClassSubject.subject_id)

    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ClassSubject.school_id == user.school_id)

    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ClassSubject.teacher_id == user.id)
    elif user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        if not student:
            return []
        q = q.filter(ClassSubject.class_id == student.class_id)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            return []
        links = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()
        student_ids = [link.student_id for link in links]
        if not student_ids:
            return []
        class_ids = [row.class_id for row in db.query(Student).filter(Student.id.in_(student_ids)).all()]
        if not class_ids:
            return []
        q = q.filter(ClassSubject.class_id.in_(class_ids))

    rows = q.order_by(ClassRoom.name.asc(), Subject.display_order.asc()).all()
    hide_teacher_contact = user.role == RoleCode.ELEVE
    grouped: dict[str, dict] = {}

    for row in rows:
        teacher = row.teacher
        key = str(teacher.id) if teacher else "unassigned"
        if key not in grouped:
            grouped[key] = {
                "teacher_id": teacher.id if teacher else user.id,
                "teacher_name": teacher.full_name if teacher else "Professeur non assigné",
                "teacher_email": None if hide_teacher_contact else (teacher.email if teacher else None),
                "teacher_phone": None if hide_teacher_contact else (teacher.phone if teacher else None),
                "teacher_photo_path": teacher.photo_path if teacher else None,
                "classes": set(),
                "courses": [],
            }
        grouped[key]["classes"].add(row.classroom.name if row.classroom else "Classe")
        grouped[key]["courses"].append(TeacherScheduleCourseOut(
            class_subject_id=row.id,
            class_name=row.classroom.name if row.classroom else "Classe",
            subject_name=row.subject.name,
            category=row.subject.category,
            schedule_label=row.schedule_label,
            max_p1=row.max_p1,
            max_p2=row.max_p2,
            max_ex1=row.max_ex1,
            max_p3=row.max_p3,
            max_p4=row.max_p4,
            max_ex2=row.max_ex2,
            max_rattrapage=row.max_rattrapage,
            max_tenasop=row.max_tenasop,
            max_bac=row.max_bac,
        ))

    return [
        TeacherScheduleOut(
            teacher_id=value["teacher_id"],
            teacher_name=value["teacher_name"],
            teacher_email=value["teacher_email"],
            teacher_phone=value["teacher_phone"],
            teacher_photo_path=value["teacher_photo_path"],
            course_count=len(value["courses"]),
            classes_count=len(value["classes"]),
            courses=value["courses"],
        )
        for value in grouped.values()
    ]


@router.get("/class/{class_id}", response_model=list[ClassSubjectOut])
def list_class_subjects(class_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(ClassSubject).filter(ClassSubject.class_id == class_id)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ClassSubject.school_id == user.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        q = q.filter(ClassSubject.teacher_id == user.id)
    rows = q.order_by(ClassSubject.display_order.asc()).all()
    return [_class_subject_to_out(row, user) for row in rows]


@router.post("/class-subjects", response_model=ClassSubjectOut)
def create_class_subject(payload: ClassSubjectCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Ajoute une nouvelle branche/cours à une classe depuis l'interface."""
    _require_course_manager(user)
    classroom = db.get(ClassRoom, payload.class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, classroom.school_id)

    subject_name = payload.subject_name.strip()
    subject = (
        db.query(Subject)
        .filter(Subject.school_id == classroom.school_id, Subject.name.ilike(subject_name))
        .first()
    )
    if not subject:
        max_order = db.query(Subject).filter(Subject.school_id == classroom.school_id).count() + 1
        subject = Subject(
            school_id=classroom.school_id,
            name=subject_name,
            category=payload.category or "Général",
            display_order=max_order,
            is_active=True,
        )
        db.add(subject)
        db.flush()

    duplicate = (
        db.query(ClassSubject)
        .filter(ClassSubject.class_id == classroom.id, ClassSubject.subject_id == subject.id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Ce cours existe déjà dans cette classe.")

    teacher = None
    if payload.teacher_id:
        teacher = db.get(UserProfile, payload.teacher_id)
        if not teacher or teacher.school_id != classroom.school_id or teacher.role != RoleCode.ENSEIGNANT:
            raise HTTPException(status_code=404, detail="Enseignant introuvable dans cette école.")

    row = ClassSubject(
        school_id=classroom.school_id,
        class_id=classroom.id,
        subject_id=subject.id,
        teacher_id=teacher.id if teacher else None,
        max_p1=payload.max_p1,
        max_p2=payload.max_p2,
        max_ex1=payload.max_ex1,
        max_p3=payload.max_p3,
        max_p4=payload.max_p4,
        max_ex2=payload.max_ex2,
        max_rattrapage=payload.max_rattrapage,
        max_tenasop=payload.max_tenasop,
        max_bac=payload.max_bac,
        display_order=payload.display_order,
        schedule_label=payload.schedule_label,
    )
    db.add(row)
    db.flush()
    log_action(
        db,
        user=user,
        action=AuditAction.CREATE_SUBJECT,
        entity_type="class_subject",
        entity_id=str(row.id),
        new_value=payload.model_dump(mode="json"),
        **request_meta(request),
    )
    db.commit()
    db.refresh(row)
    return _class_subject_to_out(row, user)


@router.patch("/class-subjects/{class_subject_id}/maxima", response_model=ClassSubjectOut)
def update_class_subject_maxima(class_subject_id: str, payload: ClassSubjectMaximaUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Modifie les maxima réels et l'horaire d'un cours de classe."""
    _require_course_manager(user)
    row = db.get(ClassSubject, class_subject_id)
    if not row:
        raise HTTPException(status_code=404, detail="Cours de classe introuvable.")
    ensure_same_school(user, row.school_id)
    old_value = {
        "max_p1": row.max_p1,
        "max_p2": row.max_p2,
        "max_ex1": row.max_ex1,
        "max_p3": row.max_p3,
        "max_p4": row.max_p4,
        "max_ex2": row.max_ex2,
        "max_rattrapage": row.max_rattrapage,
        "max_tenasop": row.max_tenasop,
        "max_bac": row.max_bac,
        "schedule_label": row.schedule_label,
    }
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    log_action(
        db,
        user=user,
        action=AuditAction.UPDATE_CLASS_SUBJECT_MAXIMA,
        entity_type="class_subject",
        entity_id=str(row.id),
        old_value=old_value,
        new_value=payload.model_dump(mode="json"),
        **request_meta(request),
    )
    db.commit()
    db.refresh(row)
    return _class_subject_to_out(row, user)
