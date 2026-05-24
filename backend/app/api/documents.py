from datetime import datetime
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AdministrativeDocument, AuditAction, RoleCode, Student, UserProfile
from app.schemas import AdministrativeDocumentCreate, AdministrativeDocumentOut
from app.services.audit import log_action

router = APIRouter(prefix="/documents", tags=["documents"])
DOC_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}

TITLES = {
    "attestation_frequentation": "Attestation de fréquentation",
    "certificat_scolarite": "Certificat de scolarité",
    "fiche_inscription": "Fiche d'inscription",
    "attestation_bonne_conduite": "Attestation de bonne conduite",
}


def _qr(data: str, size_cm: float = 2.0) -> Drawing:
    qr = QrCodeWidget(data)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    size = size_cm * cm
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    return drawing


def _out(row: AdministrativeDocument) -> AdministrativeDocumentOut:
    return AdministrativeDocumentOut(id=row.id, student_id=row.student_id, student_name=row.student.full_name, matricule=row.student.matricule, document_type=row.document_type, document_number=row.document_number, title=row.title, status=row.status, created_at=row.created_at)


def _generate_pdf(row: AdministrativeDocument, student: Student) -> Path:
    out_dir = Path(settings.GENERATED_DIR) / "documents"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"document-{row.document_number}.pdf"
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, alignment=1, leading=14)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=15)
    verify_url = f"{settings.MINISTRY_VERIFICATION_BASE_URL.rstrip('/')}/documents/{row.id}"
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=1.4 * cm, rightMargin=1.4 * cm, topMargin=1.0 * cm, bottomMargin=1.0 * cm)
    story = [
        Paragraph("REPUBLIQUE DEMOCRATIQUE DU CONGO", title),
        Paragraph("MINISTERE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET TECHNIQUE", title),
        Spacer(1, 0.6 * cm),
        Table([[Paragraph(f"<b>{student.classroom.school.name}</b><br/>{student.classroom.school.address or ''}<br/>{student.classroom.school.commune or ''} / {student.classroom.school.city or ''}", body), _qr(verify_url, 2.0)]], colWidths=[14 * cm, 3 * cm]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>{row.title.upper()}</b>", title),
        Spacer(1, 0.5 * cm),
    ]
    intro = {
        "attestation_frequentation": "atteste que l'élève ci-dessous fréquente régulièrement notre établissement pour l'année scolaire en cours.",
        "certificat_scolarite": "certifie que l'élève ci-dessous est régulièrement inscrit dans notre établissement.",
        "fiche_inscription": "présente les informations administratives de l'élève inscrit dans notre établissement.",
        "attestation_bonne_conduite": "atteste, sauf mention disciplinaire contraire, de la bonne conduite de l'élève ci-dessous.",
    }.get(row.document_type, "atteste les informations scolaires ci-dessous.")
    story.append(Paragraph(f"Le Chef d'établissement {intro}", body))
    story.append(Spacer(1, 0.4 * cm))
    data = [
        ["Numéro", row.document_number],
        ["Matricule", student.matricule],
        ["Nom complet", student.full_name],
        ["Sexe", student.sex],
        ["Classe", student.classroom.name],
        ["Date et lieu de naissance", f"{student.birth_date or ''} à {student.birth_place or ''}"],
        ["Adresse", student.address or ""],
        ["Date de génération", datetime.now().strftime("%d/%m/%Y %H:%M")],
    ]
    table = Table(data, colWidths=[5 * cm, 11 * cm])
    table.setStyle(TableStyle([("GRID", (0,0), (-1,-1), 0.5, colors.black), ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"), ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#eeeeee")), ("PADDING", (0,0), (-1,-1), 6)]))
    story.append(table)
    story.append(Spacer(1, 1.0 * cm))
    story.append(Paragraph("Fait à Kinshasa, le ____ / ____ / 20____", body))
    story.append(Spacer(1, 0.7 * cm))
    story.append(Paragraph("Le Chef d'établissement<br/><br/>Signature et sceau", body))
    doc.build(story)
    return path


@router.get("", response_model=list[AdministrativeDocumentOut])
def list_documents(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(AdministrativeDocument).join(Student, Student.id == AdministrativeDocument.student_id)
    if user.role == RoleCode.ELEVE:
        q = q.filter(Student.profile_id == user.id)
    elif user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(AdministrativeDocument.school_id == user.school_id)
    return [_out(row) for row in q.order_by(AdministrativeDocument.created_at.desc()).limit(200).all()]


@router.post("", response_model=AdministrativeDocumentOut)
def create_document(payload: AdministrativeDocumentCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in DOC_ROLES:
        raise HTTPException(status_code=403, detail="Génération de document non autorisée.")
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    ensure_same_school(user, student.school_id)
    row = AdministrativeDocument(school_id=student.school_id, student_id=student.id, document_type=payload.document_type, document_number=f"DOC-{uuid4().hex[:10].upper()}", title=TITLES[payload.document_type], generated_by_id=user.id)
    db.add(row)
    db.flush()
    path = _generate_pdf(row, student)
    row.file_path = str(path)
    log_action(db, user=user, action=AuditAction.GENERATE_DOCUMENT, entity_type="administrative_documents", entity_id=str(row.id), new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("/{document_id}/download")
def download_document(document_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    row = db.get(AdministrativeDocument, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    ensure_same_school(user, row.school_id)
    if not row.file_path or not Path(row.file_path).exists():
        path = _generate_pdf(row, row.student)
        row.file_path = str(path)
        db.commit()
    return FileResponse(row.file_path, media_type="application/pdf", filename=f"{row.document_number}.pdf")
