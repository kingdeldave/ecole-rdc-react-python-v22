from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassRoom, ClassSubject, ClassTitular, RoleCode, SchoolOption, SchoolYear, Student, UserProfile
from app.schemas import ClassCreate, ClassOut, ClassTitularIn, ClassTitularOut, ClassUpdate, SchoolOptionCreate, SchoolOptionOut
from app.services.audit import log_action

router = APIRouter(prefix="/classes", tags=["classes"])
MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _titulars_out(db: Session, class_id) -> list[ClassTitularOut]:
    rows = db.query(ClassTitular).filter(ClassTitular.class_id == class_id).all()
    return [
        ClassTitularOut(
            teacher_id=row.teacher_id,
            teacher_name=row.teacher.full_name,
            teacher_email=row.teacher.email,
            teacher_phone=row.teacher.phone,
        )
        for row in rows
        if row.teacher
    ]


def _class_out(db: Session, c: ClassRoom) -> ClassOut:
    return ClassOut(
        id=c.id,
        name=c.name,
        level=c.level,
        section=c.section,
        option=c.option,
        cycle=c.cycle,
        room=c.room,
        option_required=c.option_required,
        student_count=db.query(Student).filter(Student.class_id == c.id).count(),
        titulars=_titulars_out(db, c.id),
    )


def _active_year(db: Session, school_id):
    return (
        db.query(SchoolYear)
        .filter(SchoolYear.school_id == school_id, SchoolYear.is_active == True)
        .order_by(SchoolYear.created_at.desc())
        .first()
    )


@router.get("", response_model=list[ClassOut])
def list_classes(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Liste les classes visibles.

    Un professeur voit ses classes de cours et ses classes titulaires. Les humanités
    peuvent avoir plusieurs lignes pour le même niveau avec des options différentes
    comme Scientifique, Littéraire ou Nutrition.
    """
    q = db.query(ClassRoom).filter(ClassRoom.is_archived == False)

    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ClassRoom.school_id == user.school_id)

    if user.role == RoleCode.ENSEIGNANT:
        teaching_class_ids = db.query(ClassSubject.class_id).filter(ClassSubject.teacher_id == user.id).distinct()
        titular_class_ids = db.query(ClassTitular.class_id).filter(ClassTitular.teacher_id == user.id).distinct()
        ids = {row[0] for row in teaching_class_ids.all()} | {row[0] for row in titular_class_ids.all()}
        q = q.filter(ClassRoom.id.in_(ids)) if ids else q.filter(False)

    rows = q.order_by(ClassRoom.name.asc(), ClassRoom.option.asc().nullsfirst()).all()
    return [_class_out(db, c) for c in rows]


@router.post("", response_model=ClassOut)
def create_class(payload: ClassCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Création de classe non autorisée.")
    if user.role == RoleCode.SUPER_ADMIN and not user.school_id:
        raise HTTPException(status_code=400, detail="Le super admin doit être rattaché à une école pour créer une classe.")
    school_id = user.school_id
    year = db.get(SchoolYear, payload.school_year_id) if payload.school_year_id else _active_year(db, school_id)
    if not year:
        raise HTTPException(status_code=404, detail="Année scolaire active introuvable.")
    ensure_same_school(user, year.school_id)
    row = ClassRoom(
        school_id=year.school_id,
        school_year_id=year.id,
        name=payload.name.strip(),
        level=payload.level,
        section=payload.section,
        option=(payload.option or "").strip() or None,
        cycle=payload.cycle,
        room=payload.room,
        option_required=payload.option_required,
    )
    db.add(row)
    db.flush()
    log_action(db, user=user, action=AuditAction.CREATE_CLASS, entity_type="classes", entity_id=str(row.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _class_out(db, row)


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(class_id: str, payload: ClassUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Modification de classe non autorisée.")
    row = db.get(ClassRoom, class_id)
    if not row:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, row.school_id)
    old = {"name": row.name, "level": row.level, "section": row.section, "option": row.option, "cycle": row.cycle, "room": row.room, "option_required": row.option_required, "is_archived": row.is_archived}
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "option" and isinstance(value, str):
            value = value.strip() or None
        setattr(row, key, value)
    log_action(db, user=user, action=AuditAction.UPDATE_CLASS, entity_type="classes", entity_id=str(row.id), old_value=old, new_value=payload.model_dump(mode="json", exclude_unset=True), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _class_out(db, row)


@router.get("/options", response_model=list[SchoolOptionOut])
def list_options(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(SchoolOption).filter(SchoolOption.is_active == True)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(SchoolOption.school_id == user.school_id)
    return q.order_by(SchoolOption.name.asc()).all()


@router.post("/options", response_model=SchoolOptionOut)
def create_option(payload: SchoolOptionCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Création d'option non autorisée.")
    school_id = user.school_id
    existing = db.query(SchoolOption).filter(SchoolOption.school_id == school_id, SchoolOption.name.ilike(payload.name.strip())).first()
    if existing:
        return existing
    row = SchoolOption(school_id=school_id, name=payload.name.strip(), description=payload.description, is_active=True)
    db.add(row)
    db.flush()
    log_action(db, user=user, action=AuditAction.CREATE_OPTION, entity_type="school_options", entity_id=str(row.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return row


@router.post("/{class_id}/titulars", response_model=ClassOut)
def add_titular(class_id: str, payload: ClassTitularIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Affectation titulaire non autorisée.")
    classroom = db.get(ClassRoom, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, classroom.school_id)
    teacher = db.get(UserProfile, payload.teacher_id)
    if not teacher or teacher.school_id != classroom.school_id or teacher.role != RoleCode.ENSEIGNANT:
        raise HTTPException(status_code=404, detail="Professeur introuvable dans cette école.")
    existing = db.query(ClassTitular).filter(ClassTitular.class_id == classroom.id, ClassTitular.teacher_id == teacher.id, ClassTitular.school_year_id == classroom.school_year_id).first()
    if not existing:
        db.add(ClassTitular(school_id=classroom.school_id, class_id=classroom.id, teacher_id=teacher.id, school_year_id=classroom.school_year_id))
        classroom.titulaire_id = teacher.id
        log_action(db, user=user, action=AuditAction.ASSIGN_TITULAR, entity_type="classes", entity_id=str(classroom.id), new_value={"teacher_id": str(teacher.id)}, **request_meta(request))
    db.commit()
    db.refresh(classroom)
    return _class_out(db, classroom)


@router.delete("/{class_id}/titulars/{teacher_id}", response_model=ClassOut)
def remove_titular(class_id: str, teacher_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Retrait titulaire non autorisé.")
    classroom = db.get(ClassRoom, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, classroom.school_id)
    row = db.query(ClassTitular).filter(ClassTitular.class_id == classroom.id, ClassTitular.teacher_id == teacher_id).first()
    if row:
        db.delete(row)
        log_action(db, user=user, action=AuditAction.REMOVE_TITULAR, entity_type="classes", entity_id=str(classroom.id), old_value={"teacher_id": teacher_id}, **request_meta(request))
    db.commit()
    db.refresh(classroom)
    return _class_out(db, classroom)


@router.get("/my-titulars", response_model=list[ClassOut])
def my_titular_classes(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role != RoleCode.ENSEIGNANT:
        return []
    rows = (
        db.query(ClassRoom)
        .join(ClassTitular, ClassTitular.class_id == ClassRoom.id)
        .filter(ClassTitular.teacher_id == user.id, ClassRoom.is_archived == False)
        .order_by(ClassRoom.name.asc(), ClassRoom.option.asc().nullsfirst())
        .all()
    )
    return [_class_out(db, c) for c in rows]
