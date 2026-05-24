from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, Parent, ParentStudent, RoleCode, School, Student, UserProfile
from app.schemas import ParentChildrenOut, ParentStudentLinkIn, UserAdminCreate, UserAdminOut, UserAdminUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"])

USER_MANAGEMENT_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}
SCHOOL_ROLES = {RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.ENSEIGNANT, RoleCode.COMPTABLE, RoleCode.PARENT, RoleCode.ELEVE}
DEMO_PASSWORD = "Password123!"


def _require_manager(user: UserProfile) -> None:
    if user.role not in USER_MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Gestion des utilisateurs réservée à l'administration et à la direction.")


def _validate_role_scope(current: UserProfile, target_role: RoleCode) -> None:
    if current.role != RoleCode.SUPER_ADMIN and target_role == RoleCode.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Seul le super admin peut gérer un compte super admin.")
    if current.role != RoleCode.SUPER_ADMIN and target_role not in SCHOOL_ROLES:
        raise HTTPException(status_code=403, detail="Rôle non autorisé pour une école.")


def _to_out(user: UserProfile, include_demo_password: bool = True) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        school_id=user.school_id,
        is_active=user.is_active,
        photo_path=user.photo_path,
        demo_password=DEMO_PASSWORD if include_demo_password else None,
    )


def _student_to_light_out(student: Student):
    # Import local pour éviter une dépendance circulaire forte.
    from app.api.students import student_to_out

    return student_to_out(db=_CURRENT_DB.get(), student=student)


# Petit conteneur local utilisé uniquement par _student_to_light_out.
class _DbHolder:
    value: Session | None = None

    def set(self, db: Session):
        self.value = db

    def get(self) -> Session:
        if self.value is None:
            raise RuntimeError("Session DB indisponible")
        return self.value


_CURRENT_DB = _DbHolder()


def _ensure_parent_row(db: Session, profile: UserProfile) -> Parent:
    parent = db.query(Parent).filter(Parent.profile_id == profile.id).first()
    if parent:
        return parent
    parent = Parent(
        school_id=profile.school_id,
        profile_id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        account_status="active",
    )
    db.add(parent)
    db.flush()
    return parent


@router.get("", response_model=list[UserAdminOut])
def list_users(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Liste les identifiants et accès disponibles pour l'école.

    L'objectif est que la direction et l'administration puissent gérer plusieurs
    admins, directeurs, professeurs, parents et élèves depuis l'interface.
    """
    _require_manager(user)
    q = db.query(UserProfile)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(UserProfile.school_id == user.school_id)
    rows = q.order_by(UserProfile.role.asc(), UserProfile.full_name.asc()).all()
    return [_to_out(row) for row in rows]


@router.post("", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserAdminCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Crée un compte utilisateur avec identifiant et mot de passe initial."""
    _require_manager(user)
    _validate_role_scope(user, payload.role)

    email = payload.email.lower().strip()
    exists = db.query(UserProfile).filter(UserProfile.email == email).first()
    if exists:
        raise HTTPException(status_code=409, detail="Cet email existe déjà.")

    school_id = user.school_id
    if user.role == RoleCode.SUPER_ADMIN and payload.role == RoleCode.SUPER_ADMIN:
        school_id = None
    elif user.role == RoleCode.SUPER_ADMIN:
        # Démonstration mono-école : on affecte le premier établissement actif.
        school = db.query(School).filter(School.status == "active").order_by(School.created_at.asc()).first()
        if not school:
            raise HTTPException(status_code=404, detail="Aucune école active disponible.")
        school_id = school.id

    new_user = UserProfile(
        email=email,
        full_name=payload.full_name.strip(),
        phone=(payload.phone.strip() if payload.phone else None),
        role=payload.role,
        school_id=school_id,
        hashed_password=hash_password(payload.password),
        is_active=payload.is_active,
    )
    db.add(new_user)
    db.flush()

    # Si le compte créé est un parent, on crée directement la fiche parent
    # afin de pouvoir lui rattacher un ou plusieurs enfants depuis l'interface.
    if new_user.role == RoleCode.PARENT:
        _ensure_parent_row(db, new_user)

    log_action(
        db,
        user=user,
        action=AuditAction.CREATE_USER,
        entity_type="profiles",
        entity_id=str(new_user.id),
        new_value={"email": new_user.email, "role": new_user.role.value, "phone": new_user.phone, "is_active": new_user.is_active},
        **request_meta(request),
    )
    db.commit()
    db.refresh(new_user)
    return _to_out(new_user, include_demo_password=False)




@router.get("/parents/children", response_model=list[ParentChildrenOut])
def list_parent_children(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Liste les parents et leurs enfants liés.

    Cette route sert à l'administration/direction : un parent peut avoir 1, 2,
    3 ou 4 enfants, et l'interface doit le montrer clairement.
    """
    _require_manager(user)
    parent_profiles = db.query(UserProfile).filter(UserProfile.role == RoleCode.PARENT)
    if user.role != RoleCode.SUPER_ADMIN:
        parent_profiles = parent_profiles.filter(UserProfile.school_id == user.school_id)

    _CURRENT_DB.set(db)
    results: list[ParentChildrenOut] = []
    for profile in parent_profiles.order_by(UserProfile.full_name.asc()).all():
        parent = _ensure_parent_row(db, profile)
        links = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()
        children = []
        for link in links:
            student = db.get(Student, link.student_id)
            if student:
                children.append(_student_to_light_out(student))
        results.append(ParentChildrenOut(
            parent_profile_id=profile.id,
            parent_name=profile.full_name,
            parent_email=profile.email,
            children=children,
        ))
    return results


@router.post("/parents/link", response_model=ParentChildrenOut)
def link_parent_children(payload: ParentStudentLinkIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Rattache un parent à plusieurs élèves depuis l'interface.

    Le remplacement est volontaire : la liste envoyée devient la liste officielle
    des enfants liés à ce parent.
    """
    _require_manager(user)
    parent_profile = db.get(UserProfile, payload.parent_profile_id)
    if not parent_profile or parent_profile.role != RoleCode.PARENT:
        raise HTTPException(status_code=404, detail="Compte parent introuvable.")
    ensure_same_school(user, parent_profile.school_id)
    parent = _ensure_parent_row(db, parent_profile)

    valid_students: list[Student] = []
    for student_id in payload.student_ids:
        student = db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=404, detail=f"Élève introuvable : {student_id}")
        ensure_same_school(user, student.school_id)
        valid_students.append(student)

    db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).delete(synchronize_session=False)
    for student in valid_students:
        db.add(ParentStudent(parent_id=parent.id, student_id=student.id, relationship_type=payload.relationship_type))

    log_action(
        db,
        user=user,
        action=AuditAction.UPDATE_USER,
        entity_type="parent_students",
        entity_id=str(parent.id),
        new_value={"parent": parent_profile.email, "children": [str(s.id) for s in valid_students]},
        **request_meta(request),
    )
    db.commit()

    _CURRENT_DB.set(db)
    return ParentChildrenOut(
        parent_profile_id=parent_profile.id,
        parent_name=parent_profile.full_name,
        parent_email=parent_profile.email,
        children=[_student_to_light_out(student) for student in valid_students],
    )


@router.patch("/{user_id}", response_model=UserAdminOut)
def update_user(user_id: str, payload: UserAdminUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Modifie un compte : nom, rôle, statut actif ou mot de passe."""
    _require_manager(user)
    target = db.get(UserProfile, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    ensure_same_school(user, target.school_id)

    old_value = {"full_name": target.full_name, "phone": target.phone, "role": target.role.value, "is_active": target.is_active, "photo_path": target.photo_path}
    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        _validate_role_scope(user, data["role"])
        target.role = data["role"]
    if "full_name" in data and data["full_name"] is not None:
        target.full_name = data["full_name"].strip()
    if "phone" in data:
        target.phone = data["phone"].strip() if data["phone"] else None
    if "is_active" in data and data["is_active"] is not None:
        if str(target.id) == str(user.id) and data["is_active"] is False:
            raise HTTPException(status_code=422, detail="Vous ne pouvez pas désactiver votre propre compte.")
        target.is_active = data["is_active"]
    if "password" in data and data["password"]:
        target.hashed_password = hash_password(data["password"])
    if "photo_path" in data:
        target.photo_path = data["photo_path"]

    log_action(
        db,
        user=user,
        action=AuditAction.UPDATE_USER,
        entity_type="profiles",
        entity_id=str(target.id),
        old_value=old_value,
        new_value={"full_name": target.full_name, "phone": target.phone, "role": target.role.value, "is_active": target.is_active, "photo_path": target.photo_path},
        **request_meta(request),
    )
    db.commit()
    db.refresh(target)
    return _to_out(target, include_demo_password=False)
