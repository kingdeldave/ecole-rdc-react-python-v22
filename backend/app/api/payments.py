from datetime import date, datetime
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import (
    AuditAction,
    FeeStatus,
    Parent,
    ParentStudent,
    Payment,
    ReportCard,
    ReportStatus,
    RoleCode,
    Student,
    StudentFeeStatus,
    UserProfile,
)
from app.schemas import FeeStatusUpdate, PaymentCreate, PaymentOut
from app.services.audit import log_action
from app.services.notifications import create_notification
from app.core.config import settings
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A6
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

router = APIRouter(prefix="/payments", tags=["payments"])

FINANCE_ROLES = {RoleCode.COMPTABLE, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}




def _qr(data: str, size_cm: float = 2.0) -> Drawing:
    qr = QrCodeWidget(data)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    size = size_cm * cm
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    return drawing


def _receipt_pdf(db: Session, payment: Payment) -> Path:
    student = db.get(Student, payment.student_id)
    out_dir = Path(settings.GENERATED_DIR) / "receipts"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"recu-{payment.receipt_number}.pdf"
    verify_url = f"{settings.MINISTRY_VERIFICATION_BASE_URL.rstrip('/')}/verify/payment/{payment.receipt_number}"
    doc = SimpleDocTemplate(str(path), pagesize=A6, leftMargin=0.6*cm, rightMargin=0.6*cm, topMargin=0.5*cm, bottomMargin=0.5*cm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ReceiptTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, alignment=1, leading=10)
    body = ParagraphStyle("ReceiptBody", parent=styles["Normal"], fontSize=7, leading=9)
    story = [
        Paragraph("REÇU DE PAIEMENT SCOLAIRE", title),
        Paragraph(student.classroom.school.name if student else "École", title),
        Spacer(1, 0.2*cm),
        Table([[Paragraph(f"<b>N°</b> {payment.receipt_number}<br/><b>Date</b> {payment.payment_date}<br/><b>Élève</b> {student.full_name if student else ''}<br/><b>Matricule</b> {student.matricule if student else ''}<br/><b>Classe</b> {student.classroom.name if student else ''}<br/><b>Montant</b> {payment.amount} $<br/><b>Mode</b> {payment.method}", body), _qr(verify_url, 2.0)]], colWidths=[6.8*cm, 2.4*cm]),
        Spacer(1, 0.25*cm),
        Paragraph("Signature caisse : __________________", body),
        Paragraph(f"Vérification QR : {verify_url}", body),
    ]
    story[2:2] = []
    doc.build(story)
    return path

def _require_finance_role(user: UserProfile) -> None:
    if user.role not in FINANCE_ROLES:
        raise HTTPException(status_code=403, detail="Action financière non autorisée.")


def _payment_status(total_due: float, total_paid: float) -> FeeStatus:
    if total_due <= 0:
        return FeeStatus.NON_PAYE
    if total_paid >= total_due:
        return FeeStatus.EN_ORDRE
    if total_paid > 0:
        return FeeStatus.PARTIEL
    return FeeStatus.NON_PAYE


def _sync_student_report_blocks(db: Session, student: Student, fee: StudentFeeStatus) -> bool:
    """Applique le blocage financier sur tous les bulletins de l'élève pour l'année scolaire."""
    blocked = (not fee.bulletin_access_override) and fee.status != FeeStatus.EN_ORDRE
    cards = db.query(ReportCard).filter(
        ReportCard.student_id == student.id,
        ReportCard.school_year_id == fee.school_year_id,
    ).all()
    for card in cards:
        card.payment_blocked = blocked
        if blocked:
            card.status = ReportStatus.BLOCKED
        elif card.status == ReportStatus.BLOCKED:
            card.status = ReportStatus.VALIDATED if card.validated_by_id else ReportStatus.DRAFT
    return blocked


def _notify_parents(db: Session, student: Student, title: str, message: str, notif_type: str) -> None:
    for link in db.query(ParentStudent).filter(ParentStudent.student_id == student.id).all():
        parent = db.get(Parent, link.parent_id)
        if parent and parent.profile_id:
            recipient = db.get(UserProfile, parent.profile_id)
            if recipient:
                create_notification(
                    db,
                    recipient=recipient,
                    notif_type=notif_type,
                    title=title,
                    message=message,
                    action_url="/report-cards",
                    school_id=student.school_id,
                    send_email=True,
                )


def _notify_direction(db: Session, student: Student, title: str, message: str, notif_type: str) -> None:
    direction_roles = {RoleCode.DIRECTEUR, RoleCode.PREFET, RoleCode.ADMIN_ECOLE}
    users = db.query(UserProfile).filter(UserProfile.school_id == student.school_id, UserProfile.role.in_(direction_roles), UserProfile.is_active == True).all()
    for recipient in users:
        create_notification(
            db,
            recipient=recipient,
            notif_type=notif_type,
            title=title,
            message=message,
            action_url="/students",
            school_id=student.school_id,
            send_email=False,
        )


@router.get("", response_model=list[PaymentOut])
def list_payments(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(Payment)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(Payment.school_id == user.school_id)
    return q.order_by(Payment.created_at.desc()).limit(200).all()


@router.post("", response_model=PaymentOut)
def create_payment(payload: PaymentCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _require_finance_role(user)
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)
    payment = Payment(
        school_id=student.school_id,
        student_id=payload.student_id,
        school_year_id=payload.school_year_id,
        amount=payload.amount,
        method=payload.method,
        payment_date=date.today(),
        receipt_number=f"REC-{uuid4().hex[:10].upper()}",
        recorded_by_id=user.id,
    )
    db.add(payment)
    year_id = payload.school_year_id or student.classroom.school_year_id
    fee = db.query(StudentFeeStatus).filter(StudentFeeStatus.student_id == payload.student_id, StudentFeeStatus.school_year_id == year_id).first()
    if not fee:
        fee = StudentFeeStatus(school_id=student.school_id, student_id=payload.student_id, school_year_id=year_id, total_due=0, total_paid=0)
        db.add(fee)
    fee.total_paid += payload.amount
    fee.status = _payment_status(fee.total_due, fee.total_paid)
    blocked = _sync_student_report_blocks(db, student, fee)
    if blocked:
        _notify_parents(db, student, "Résultats bloqués", "L'accès aux points et bulletins reste bloqué tant que les frais scolaires ne sont pas régularisés.", "RESULTATS_BLOQUES")
    else:
        _notify_parents(db, student, "Résultats débloqués", "L'accès aux points et bulletins est rétabli après régularisation du paiement.", "RESULTATS_DEBLOQUES")
    _notify_direction(
        db,
        student,
        "Paiement enregistré",
        f"Un paiement de {payload.amount} a été enregistré pour {student.full_name}.",
        "PAIEMENT_MODIFIE",
    )
    log_action(db, user=user, action=AuditAction.PAYMENT_ADDED, entity_type="payments", new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/status")
def update_fee_status(payload: FeeStatusUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Met à jour le statut de paiement d'un élève et bloque/débloque automatiquement ses résultats."""
    _require_finance_role(user)
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)
    status = _payment_status(payload.total_due, payload.total_paid)
    year_id = payload.school_year_id or student.classroom.school_year_id
    fee = db.query(StudentFeeStatus).filter(StudentFeeStatus.student_id == payload.student_id, StudentFeeStatus.school_year_id == year_id).first()
    if not fee:
        fee = StudentFeeStatus(school_id=student.school_id, student_id=payload.student_id, school_year_id=year_id)
        db.add(fee)
    old_value = {"total_due": fee.total_due, "total_paid": fee.total_paid, "status": fee.status.value if fee.status else None, "override": fee.bulletin_access_override}
    fee.total_due = payload.total_due
    fee.total_paid = payload.total_paid
    fee.status = status
    fee.bulletin_access_override = payload.bulletin_access_override
    blocked = _sync_student_report_blocks(db, student, fee)
    if blocked:
        _notify_parents(db, student, "Résultats bloqués", "L'accès aux points et bulletins est bloqué pour frais scolaires non régularisés.", "RESULTATS_BLOQUES")
    else:
        _notify_parents(db, student, "Résultats débloqués", "L'accès aux points et bulletins est rétabli par l'administration.", "RESULTATS_DEBLOQUES")
    _notify_direction(
        db,
        student,
        "Montant scolaire modifié",
        f"Le montant/paiement de {student.full_name} a été modifié : payé {payload.total_paid} sur {payload.total_due}. Statut : {status.value}.",
        "PAIEMENT_MODIFIE",
    )
    log_action(db, user=user, action=AuditAction.UPDATE_FEE_STATUS, entity_type="student_fee_statuses", entity_id=str(student.id), old_value=old_value, new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    return {"message": "Statut financier mis à jour.", "status": status.value, "payment_blocked": blocked}


@router.get("/{payment_id}/receipt")
def download_payment_receipt(payment_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    if user.role != RoleCode.SUPER_ADMIN and payment.school_id != user.school_id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    path = _receipt_pdf(db, payment)
    return FileResponse(str(path), media_type="application/pdf", filename=f"recu-{payment.receipt_number}.pdf")
