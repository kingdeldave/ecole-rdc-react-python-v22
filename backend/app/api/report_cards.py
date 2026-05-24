from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, ClassTitular, Notification, Parent, ParentStudent, ReportCard, ReportCardSignature, ReportStatus, RoleCode, Student, UserProfile
from app.schemas import ReportCardOut, ReportClassGenerateIn, ReportCorrectionIn, ReportGenerateIn, ReportPaymentBlockIn, ReportSignatureIn
from app.services.audit import log_action
from app.services.pdf_service import generate_report_card_pdf
from app.services.report_cards import compute_class_ranks, official_correction, publish_report_card, upsert_report_card, validate_report_card

router = APIRouter(prefix="/report-cards", tags=["report-cards"])


def card_to_out(card: ReportCard, *, mask_results: bool = False) -> ReportCardOut:
    """Transforme un bulletin en sortie API.

    Quand un parent ou un élève n'est pas en ordre de paiement, les résultats sont masqués :
    le bulletin reste visible comme document bloqué, mais les points, pourcentages et lignes ne sortent pas.
    """
    if mask_results:
        snapshot = {
            "blocked": True,
            "message": "Bulletin bloqué pour frais scolaires non régularisés. Veuillez contacter l’administration de l’école.",
            "student": card.snapshot_json.get("student", {}) if isinstance(card.snapshot_json, dict) else {},
            "class": card.snapshot_json.get("class", {}) if isinstance(card.snapshot_json, dict) else {},
            "lines": [],
        }
        return ReportCardOut(
            id=card.id,
            student_id=card.student_id,
            student_name=card.student.full_name,
            class_id=card.class_id,
            class_name=card.classroom.name,
            status=ReportStatus.BLOCKED,
            version=card.version,
            total=0,
            max_total=0,
            percentage=0,
            rank=None,
            decision="BLOQUÉ - FRAIS SCOLAIRES",
            payment_blocked=True,
            locked=card.locked,
            published_at=card.published_at,
            snapshot_json=snapshot,
        )
    return ReportCardOut(
        id=card.id,
        student_id=card.student_id,
        student_name=card.student.full_name,
        class_id=card.class_id,
        class_name=card.classroom.name,
        status=card.status,
        version=card.version,
        total=card.total,
        max_total=card.max_total,
        percentage=card.percentage,
        rank=card.rank,
        decision=card.decision,
        payment_blocked=card.payment_blocked,
        locked=card.locked,
        published_at=card.published_at,
        snapshot_json=card.snapshot_json,
    )


def ensure_can_view_card(db: Session, user: UserProfile, card: ReportCard) -> None:
    """Contrôle la consultation d'un bulletin.

    Le professeur titulaire peut consulter les bulletins de ses classes seulement
    si le bulletin n'est pas bloqué pour frais scolaires.
    """
    ensure_same_school(user, card.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        titular = db.query(ClassTitular).filter(ClassTitular.class_id == card.class_id, ClassTitular.teacher_id == user.id).first()
        if not titular:
            raise HTTPException(status_code=403, detail="Seul le professeur titulaire de la classe peut consulter ce bulletin.")
        if card.payment_blocked:
            raise HTTPException(status_code=403, detail="Bulletin bloqué pour frais scolaires non régularisés.")
    if user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            raise HTTPException(status_code=403, detail="Compte parent introuvable.")
        link = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id, ParentStudent.student_id == card.student_id).first()
        if not link:
            raise HTTPException(status_code=403, detail="Vous ne pouvez consulter que le bulletin de votre enfant.")
    if user.role == RoleCode.ELEVE and card.student.profile_id != user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez consulter que votre propre bulletin.")


@router.get("", response_model=list[ReportCardOut])
def list_report_cards(class_id: str | None = None, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Liste les bulletins visibles."""
    q = db.query(ReportCard)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(ReportCard.school_id == user.school_id)
    if user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if not parent:
            return []
        student_ids = [x.student_id for x in db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).all()]
        q = q.filter(ReportCard.student_id.in_(student_ids))
    if user.role == RoleCode.ELEVE:
        student = db.query(Student).filter(Student.profile_id == user.id).first()
        if not student:
            return []
        q = q.filter(ReportCard.student_id == student.id)
    if user.role == RoleCode.ENSEIGNANT:
        titular_class_ids = [row[0] for row in db.query(ClassTitular.class_id).filter(ClassTitular.teacher_id == user.id).distinct().all()]
        q = q.filter(ReportCard.class_id.in_(titular_class_ids)) if titular_class_ids else q.filter(False)
    if class_id:
        q = q.filter(ReportCard.class_id == class_id)
    cards = q.order_by(ReportCard.updated_at.desc()).all()
    return [card_to_out(c, mask_results=(user.role in {RoleCode.PARENT, RoleCode.ELEVE, RoleCode.ENSEIGNANT} and c.payment_blocked)) for c in cards]


@router.post("/generate", response_model=ReportCardOut)
def generate_report(payload: ReportGenerateIn, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Génère un bulletin pour un élève."""
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)
    if user.role == RoleCode.ENSEIGNANT:
        titular = db.query(ClassTitular).filter(ClassTitular.class_id == student.class_id, ClassTitular.teacher_id == user.id).first()
        if not titular:
            raise HTTPException(status_code=403, detail="Seul le professeur titulaire peut calculer les bulletins de cette classe.")
    card = upsert_report_card(db, user=user, student=student)
    compute_class_ranks(db, student.class_id)
    db.commit()
    db.refresh(card)
    return card_to_out(card)


@router.post("/generate-class", response_model=list[ReportCardOut])
def generate_class_reports(payload: ReportClassGenerateIn, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Génère les bulletins de toute une classe."""
    students = db.query(Student).filter(Student.class_id == payload.class_id).order_by(Student.last_name.asc()).all()
    if not students:
        return []
    ensure_same_school(user, students[0].school_id)
    if user.role == RoleCode.ENSEIGNANT:
        titular = db.query(ClassTitular).filter(ClassTitular.class_id == payload.class_id, ClassTitular.teacher_id == user.id).first()
        if not titular:
            raise HTTPException(status_code=403, detail="Seul le professeur titulaire peut calculer les bulletins de cette classe.")
    cards = [upsert_report_card(db, user=user, student=s) for s in students]
    compute_class_ranks(db, payload.class_id)
    db.commit()
    return [card_to_out(c) for c in cards]


@router.post("/{card_id}/validate", response_model=ReportCardOut)
def validate(card_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")
    ensure_same_school(user, card.school_id)
    validate_report_card(db, user=user, card=card)
    db.commit()
    db.refresh(card)
    return card_to_out(card)


@router.post("/{card_id}/publish", response_model=ReportCardOut)
def publish(card_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")
    ensure_same_school(user, card.school_id)
    publish_report_card(db, user=user, card=card)
    db.commit()
    db.refresh(card)
    return card_to_out(card)




@router.post("/{card_id}/payment-block", response_model=ReportCardOut)
def set_payment_block(card_id: str, payload: ReportPaymentBlockIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Bloque ou débloque l'accès parent/élève au bulletin pour raison financière.

    Cette action est réservée à la direction, au comptable et à l'admin école.
    """
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")
    ensure_same_school(user, card.school_id)
    if user.role not in {RoleCode.COMPTABLE, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas bloquer ou débloquer ce bulletin.")

    card.payment_blocked = payload.blocked
    if payload.blocked:
        card.status = ReportStatus.BLOCKED
        action = AuditAction.BLOCK_REPORT
        notif_type = "BULLETIN_BLOQUE"
        title = "Bulletin bloqué"
        message = "Bulletin bloqué pour frais scolaires non régularisés. Veuillez contacter l’administration de l’école."
    else:
        if card.status == ReportStatus.BLOCKED:
            card.status = ReportStatus.VALIDATED if card.validated_by_id else ReportStatus.DRAFT
        action = AuditAction.UNBLOCK_REPORT
        notif_type = "BULLETIN_DEBLOQUE"
        title = "Bulletin débloqué"
        message = "L’accès au bulletin de votre enfant a été rétabli par l’administration."

    for link in db.query(ParentStudent).filter(ParentStudent.student_id == card.student_id).all():
        parent = db.get(Parent, link.parent_id)
        if parent and parent.profile_id:
            db.add(Notification(school_id=card.school_id, recipient_id=parent.profile_id, type=notif_type, title=title, message=message, action_url=f"/report-cards"))

    log_action(db, user=user, action=action, entity_type="report_card", entity_id=str(card.id), reason=payload.reason, **request_meta(request))
    db.commit()
    db.refresh(card)
    return card_to_out(card)


@router.post("/{card_id}/correction", response_model=ReportCardOut)
def correction(card_id: str, payload: ReportCorrectionIn, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")
    ensure_same_school(user, card.school_id)
    official_correction(db, user=user, card=card, reason=payload.reason)
    db.commit()
    db.refresh(card)
    return card_to_out(card)


@router.post("/{card_id}/sign")
def sign(card_id: str, payload: ReportSignatureIn, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Accusé de réception numérique par parent."""
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")

    parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
    if user.role == RoleCode.PARENT:
        if not parent:
            raise HTTPException(status_code=403, detail="Compte parent introuvable.")
        link = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id, ParentStudent.student_id == card.student_id).first()
        if not link:
            raise HTTPException(status_code=403, detail="Vous ne pouvez signer que le bulletin de votre enfant.")
    elif user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Signature non autorisée.")

    meta = request_meta(request)
    signature = ReportCardSignature(
        report_card_id=card.id,
        parent_id=parent.id if parent else None,
        signature_name=payload.signature_name,
        comment=payload.comment,
        ip_address=meta["ip_address"],
        user_agent=meta["user_agent"],
    )
    db.add(signature)
    log_action(db, user=user, action=AuditAction.SIGN_REPORT, entity_type="report_card", entity_id=str(card.id), **meta)
    db.commit()
    return {"message": "Accusé de réception enregistré."}


@router.get("/{card_id}/download")
def download(card_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Télécharge un PDF généré avec filigrane."""
    card = db.get(ReportCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin introuvable.")
    ensure_can_view_card(db, user, card)
    if card.payment_blocked and user.role in {RoleCode.PARENT, RoleCode.ELEVE, RoleCode.ENSEIGNANT}:
        raise HTTPException(status_code=403, detail="Bulletin bloqué pour frais scolaires non régularisés. Veuillez contacter l’administration de l’école.")

    path: Path = generate_report_card_pdf(card, downloaded_by=user.full_name)
    log_action(db, user=user, action=AuditAction.DOWNLOAD_REPORT, entity_type="report_card", entity_id=str(card.id), **request_meta(request))
    db.commit()
    return FileResponse(str(path), filename=path.name, media_type="application/pdf")
