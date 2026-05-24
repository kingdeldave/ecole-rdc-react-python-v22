from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user, request_meta, ensure_same_school
from app.models import (
    AuditAction,
    ClassRoom,
    ClassSubject,
    ClassTitular,
    Grade,
    GradeHistory,
    Parent,
    ParentStudent,
    Payment,
    ReportCard,
    ReportCardSignature,
    ReportCardVersion,
    RoleCode,
    Student,
    StudentFeeStatus,
    UserProfile,
)
from app.schemas import StudentBulkImportIn, StudentBulkImportOut, StudentCreate, StudentOut, StudentUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/students", tags=["students"])

MANAGEMENT_ROLES = {RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}


def _active_year_id(student: Student):
    return student.classroom.school_year_id if student.classroom else None


def create_student_fee_status(db: Session, student: Student, classroom: ClassRoom) -> None:
    """Crée le statut financier initial d'un élève.

    Par défaut, un nouvel élève est considéré comme non payé : ses résultats restent
    bloqués côté parent/élève tant que la comptabilité ou la direction ne régularise pas.
    """
    existing = (
        db.query(StudentFeeStatus)
        .filter(StudentFeeStatus.student_id == student.id, StudentFeeStatus.school_year_id == classroom.school_year_id)
        .first()
    )
    if existing:
        return
    db.add(StudentFeeStatus(
        school_id=student.school_id,
        student_id=student.id,
        school_year_id=classroom.school_year_id,
        total_due=0,
        total_paid=0,
    ))


def normalize_sex(value: str | None) -> str:
    """Normalise le sexe venant d'un formulaire ou d'un collage Excel."""
    raw = (value or "M").strip().upper()
    if raw in {"F", "FEMININ", "FÉMININ", "FILLE", "FEMALE"}:
        return "F"
    return "M"


def student_to_out(db: Session, student: Student) -> StudentOut:
    fee = None
    if _active_year_id(student):
        fee = (
            db.query(StudentFeeStatus)
            .filter(StudentFeeStatus.student_id == student.id, StudentFeeStatus.school_year_id == _active_year_id(student))
            .first()
        )
    parent_count = db.query(ParentStudent).filter(ParentStudent.student_id == student.id).count()
    payment_blocked = True
    if fee:
        payment_blocked = not fee.bulletin_access_override and fee.status.value != "EN_ORDRE"
    return StudentOut(
        id=student.id,
        matricule=student.matricule,
        full_name=student.full_name,
        sex=student.sex,
        class_id=student.class_id,
        class_name=student.classroom.name,
        class_option=student.classroom.option,
        class_room=student.classroom.room,
        status=student.status,
        birth_date=student.birth_date,
        birth_place=student.birth_place,
        address=student.address,
        payment_status=fee.status if fee else None,
        payment_blocked=payment_blocked,
        total_due=fee.total_due if fee else 0,
        total_paid=fee.total_paid if fee else 0,
        parent_count=parent_count,
        photo_path=student.photo_path,
    )


@router.get("", response_model=list[StudentOut])
def list_students(class_id: str | None = None, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Liste les élèves visibles par l'utilisateur.

    - Parent : tous ses enfants liés, même s'il en a 3 ou 4.
    - Élève : seulement sa propre fiche.
    - Direction/admin/comptable : élèves de l'école.
    """
    q = db.query(Student).join(Student.classroom)

    if user.role == RoleCode.ELEVE:
        q = q.filter(Student.profile_id == user.id)
    elif user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            return []
        ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
        q = q.filter(Student.id.in_(ids)) if ids else q.filter(False)
    elif user.role == RoleCode.ENSEIGNANT:
        # Un professeur voit les élèves des classes où il enseigne et des classes où il est titulaire.
        teaching_class_ids = [row[0] for row in db.query(ClassSubject.class_id).filter(ClassSubject.teacher_id == user.id).distinct().all()]
        titular_class_ids = [row[0] for row in db.query(ClassTitular.class_id).filter(ClassTitular.teacher_id == user.id).distinct().all()]
        allowed_class_ids = set(teaching_class_ids) | set(titular_class_ids)
        q = q.filter(Student.school_id == user.school_id, Student.class_id.in_(allowed_class_ids)) if allowed_class_ids else q.filter(False)
    elif user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(Student.school_id == user.school_id)

    if class_id:
        q = q.filter(Student.class_id == class_id)
    return [student_to_out(db, s) for s in q.order_by(Student.last_name.asc()).all()]


@router.post("", response_model=StudentOut)
def create_student(payload: StudentCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Crée un élève. Réservé aux rôles administratifs."""
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Création d'élève non autorisée.")
    classroom = db.get(ClassRoom, payload.class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    ensure_same_school(user, classroom.school_id)

    existing = db.query(Student).filter(Student.school_id == classroom.school_id, Student.matricule == payload.matricule).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ce matricule existe déjà dans l'école.")

    student = Student(
        school_id=classroom.school_id,
        class_id=payload.class_id,
        matricule=payload.matricule,
        last_name=payload.last_name,
        middle_name=payload.middle_name,
        first_name=payload.first_name,
        sex=payload.sex,
        birth_date=payload.birth_date,
        birth_place=payload.birth_place,
        address=payload.address,
        observations=payload.observations,
        photo_path=f"/avatars/{payload.sex.lower()}-student.svg",
    )
    db.add(student)
    db.flush()

    # Création automatique d'un statut financier initial : bloqué tant que non payé.
    create_student_fee_status(db, student, classroom)
    log_action(db, user=user, action=AuditAction.CREATE_STUDENT, entity_type="students", entity_id=str(student.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(student)
    return student_to_out(db, student)


@router.post("/bulk", response_model=StudentBulkImportOut)
def bulk_create_students(payload: StudentBulkImportIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Importe plusieurs élèves collés depuis Excel ou LibreOffice.

    L'administration choisit une classe, colle les lignes dans l'interface, puis le
    frontend envoie une liste déjà structurée. Les doublons de matricule sont ignorés
    pour éviter d'écraser les élèves existants.
    """
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Import d'élèves non autorisé.")

    classroom = db.get(ClassRoom, payload.class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    ensure_same_school(user, classroom.school_id)

    created = 0
    skipped = 0
    errors: list[str] = []
    seen: set[str] = set()

    for index, row in enumerate(payload.rows, start=1):
        matricule = row.matricule.strip()
        if not matricule:
            skipped += 1
            errors.append(f"Ligne {index}: matricule vide.")
            continue
        if matricule in seen:
            skipped += 1
            errors.append(f"Ligne {index}: matricule dupliqué dans le collage ({matricule}).")
            continue
        seen.add(matricule)

        exists = db.query(Student).filter(Student.school_id == classroom.school_id, Student.matricule == matricule).first()
        if exists:
            skipped += 1
            errors.append(f"Ligne {index}: matricule déjà existant ({matricule}).")
            continue

        student = Student(
            school_id=classroom.school_id,
            class_id=classroom.id,
            matricule=matricule,
            last_name=row.last_name.strip(),
            middle_name=(row.middle_name or "").strip() or None,
            first_name=(row.first_name or "").strip() or None,
            sex=normalize_sex(row.sex),
            birth_date=row.birth_date,
            birth_place=(row.birth_place or "").strip() or None,
            address=(row.address or "").strip() or None,
            observations=(row.observations or "").strip() or None,
            photo_path=f"/avatars/{normalize_sex(row.sex).lower()}-student.svg",
        )
        db.add(student)
        db.flush()
        create_student_fee_status(db, student, classroom)
        created += 1

    log_action(
        db,
        user=user,
        action=AuditAction.IMPORT_EXCEL,
        entity_type="students_bulk_paste",
        entity_id=str(classroom.id),
        new_value={"created": created, "skipped": skipped, "errors": errors[:20]},
        **request_meta(request),
    )
    db.commit()
    return StudentBulkImportOut(message="Import par collage terminé.", created=created, skipped=skipped, errors=errors)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: str, payload: StudentUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Modifie un élève : classe, identité, statut et informations de base."""
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Modification d'élève non autorisée.")
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)

    old_value = {
        "matricule": student.matricule,
        "last_name": student.last_name,
        "middle_name": student.middle_name,
        "first_name": student.first_name,
        "full_name": student.full_name,
        "sex": student.sex,
        "birth_date": student.birth_date.isoformat() if student.birth_date else None,
        "birth_place": student.birth_place,
        "address": student.address,
        "class_id": str(student.class_id),
        "status": student.status,
        "photo_path": student.photo_path,
        "observations": student.observations,
    }

    data = payload.model_dump(exclude_unset=True)
    if "class_id" in data and data["class_id"] is not None:
        classroom = db.get(ClassRoom, data["class_id"])
        if not classroom:
            raise HTTPException(status_code=404, detail="Nouvelle classe introuvable.")
        ensure_same_school(user, classroom.school_id)
        student.class_id = data.pop("class_id")
        student.school_id = classroom.school_id

    for field, value in data.items():
        # photo_path peut être explicitement mis à null pour retirer la photo.
        if value is not None or field == "photo_path":
            setattr(student, field, value)

    log_action(db, user=user, action=AuditAction.UPDATE_STUDENT, entity_type="students", entity_id=str(student.id), old_value=old_value, new_value=payload.model_dump(mode="json", exclude_unset=True), **request_meta(request))
    db.commit()
    db.refresh(student)
    return student_to_out(db, student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Supprime définitivement un élève et ses données liées en développement.

    En production, il est recommandé d'archiver au lieu de supprimer pour conserver la traçabilité.
    """
    if user.role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Suppression d'élève non autorisée.")
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)

    # Dépendances à nettoyer explicitement car le schéma n'utilise pas encore ON DELETE CASCADE.
    grades = db.query(Grade).filter(Grade.student_id == student.id).all()
    for grade in grades:
        db.query(GradeHistory).filter(GradeHistory.grade_id == grade.id).delete(synchronize_session=False)
        db.delete(grade)

    cards = db.query(ReportCard).filter(ReportCard.student_id == student.id).all()
    for card in cards:
        db.query(ReportCardVersion).filter(ReportCardVersion.report_card_id == card.id).delete(synchronize_session=False)
        db.query(ReportCardSignature).filter(ReportCardSignature.report_card_id == card.id).delete(synchronize_session=False)
        db.delete(card)

    db.query(ParentStudent).filter(ParentStudent.student_id == student.id).delete(synchronize_session=False)
    db.query(StudentFeeStatus).filter(StudentFeeStatus.student_id == student.id).delete(synchronize_session=False)
    db.query(Payment).filter(Payment.student_id == student.id).delete(synchronize_session=False)

    log_action(db, user=user, action=AuditAction.DELETE_STUDENT, entity_type="students", entity_id=str(student.id), old_value={"matricule": student.matricule, "full_name": student.full_name}, **request_meta(request))
    db.delete(student)
    db.commit()
    return None
