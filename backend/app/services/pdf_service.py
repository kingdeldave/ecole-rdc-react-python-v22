from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings
from app.models import ReportCard


def _qr_drawing(data: str, size_cm: float = 1.55) -> Drawing:
    """Crée un petit QR code compatible ReportLab."""
    qr = QrCodeWidget(data)
    bounds = qr.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    size = size_cm * cm
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    return drawing


def _fmt(value: object) -> str:
    """Format compact pour rapprocher le PDF du bulletin officiel de type Excel."""
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.1f}"
    return str(value)


def _student_identity(student: dict, classroom: dict, school: dict, card: ReportCard) -> Table:
    """Bloc identité compact, semblable au bulletin papier RDC."""
    rows = [
        ["NOM", student.get("last_name") or student.get("full_name", ""), "POST-NOM", student.get("middle_name", "")],
        ["PRENOM", student.get("first_name", ""), "SEXE", student.get("sex", "")],
        ["MATRICULE", student.get("matricule", ""), "CLASSE", classroom.get("name", "")],
        ["ECOLE", school.get("name", ""), "ANNEE", card.snapshot_json.get("school_year", {}).get("label", "")],
        ["COMMUNE", school.get("commune", ""), "PROVINCE", school.get("province", "")],
    ]
    table = Table(rows, colWidths=[2.2 * cm, 5.6 * cm, 2.1 * cm, 4.8 * cm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, colors.black),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 6.1),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eeeeee")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#eeeeee")),
    ]))
    return table


def generate_report_card_pdf(card: ReportCard, downloaded_by: str) -> Path:
    """Génère un bulletin PDF au format compact proche du modèle papier fourni.

    Le rendu précédent était trop aéré et proche d'un tableau web. Cette version
    privilégie un style administratif RDC : orientation portrait, petits caractères,
    bordures noires, zones de synthèse, décision, signatures et QR de vérification.
    """
    out_dir = Path(settings.GENERATED_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"bulletin-{card.id}-{uuid4().hex}.pdf"
    path = out_dir / filename

    snapshot = card.snapshot_json or {}
    school = snapshot.get("school", {})
    student = snapshot.get("student", {})
    classroom = snapshot.get("class", {})
    lines = snapshot.get("lines", [])
    verification_url = f"{settings.MINISTRY_VERIFICATION_BASE_URL.rstrip('/')}/verify/bulletin/{card.id}?version={card.version}"

    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=0.45 * cm,
        rightMargin=0.45 * cm,
        topMargin=0.35 * cm,
        bottomMargin=0.35 * cm,
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle("RDC_Title", parent=styles["Normal"], alignment=1, fontName="Helvetica-Bold", fontSize=8.5, leading=9.5)
    tiny = ParagraphStyle("Tiny", parent=styles["Normal"], fontSize=5.7, leading=6.4)
    small_center = ParagraphStyle("SmallCenter", parent=tiny, alignment=1)

    story = []

    # En-tête officiel.
    story.append(Paragraph("REPUBLIQUE DEMOCRATIQUE DU CONGO", title))
    story.append(Paragraph("MINISTERE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET TECHNIQUE", title))
    story.append(Spacer(1, 0.08 * cm))

    header = Table(
        [[
            Paragraph(
                f"<b>{school.get('name', '')}</b><br/>"
                f"{school.get('city', '')} / {school.get('commune', '')}<br/>"
                f"<b>BULLETIN OFFICIEL DE L'ETAT</b>",
                tiny,
            ),
            Paragraph("<b>DOCUMENT SCOLAIRE VERROUILLE</b><br/>Version : %s" % card.version, small_center),
            _qr_drawing(verification_url, 1.45),
        ]],
        colWidths=[8.5 * cm, 7.0 * cm, 2.0 * cm],
    )
    header.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.45, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (2, 0), "CENTER"),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.1 * cm))
    story.append(_student_identity(student, classroom, school, card))
    story.append(Spacer(1, 0.1 * cm))

    # Tableau principal : format dense et borduré comme le modèle papier.
    data: list[list[str]] = []
    data.append(["#", "BRANCHES", "P1", "P2", "EX1", "TOT1", "P3", "P4", "EX2", "TOT2", "RATTR.", "TEN.", "BAC", "T.G", "MAX", "SIGN."])

    for index, line in enumerate(lines, start=1):
        data.append([
            str(index),
            _fmt(line.get("subject_name", "")),
            _fmt(line.get("p1")),
            _fmt(line.get("p2")),
            _fmt(line.get("ex1")),
            _fmt(line.get("s1_total")),
            _fmt(line.get("p3")),
            _fmt(line.get("p4")),
            _fmt(line.get("ex2")),
            _fmt(line.get("s2_total")),
            _fmt(line.get("rattrapage")),
            _fmt(line.get("tenasop")),
            _fmt(line.get("bac")),
            _fmt(line.get("total")),
            _fmt(line.get("max_total")),
            "",
        ])

    data.extend([
        ["", "TOTAUX", "", "", "", _fmt(snapshot.get("s1_total", "")), "", "", "", _fmt(snapshot.get("s2_total", "")), _fmt(snapshot.get("rattrapage_total", 0)), _fmt(snapshot.get("tenasop_total", 0)), _fmt(snapshot.get("bac_total", 0)), _fmt(snapshot.get("total", 0)), _fmt(snapshot.get("max_total", 0)), ""],
        ["", "POURCENTAGE", "", "", "", "", "", "", "", "", "", "", "", f"{_fmt(snapshot.get('percentage', 0))} %", "", ""],
        ["", "PLACE", "", "", "", "", "", "", "", "", "", "", "", _fmt(card.rank or ""), "", ""],
        ["", "DECISION", "", "", "", "", "", "", "", "", "", "", "", _fmt(snapshot.get("decision", "")), "", ""],
    ])

    table = Table(
        data,
        repeatRows=1,
        colWidths=[0.55 * cm, 4.55 * cm, 0.82 * cm, 0.82 * cm, 0.9 * cm, 0.9 * cm, 0.82 * cm, 0.82 * cm, 0.9 * cm, 0.9 * cm, 0.85 * cm, 0.85 * cm, 0.8 * cm, 0.9 * cm, 0.9 * cm, 1.0 * cm],
    )
    styles_table = [
        ("GRID", (0, 0), (-1, -1), 0.35, colors.black),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6e6e6")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -4), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -4), (-1, -1), colors.HexColor("#f1f1f1")),
        ("FONTSIZE", (0, 0), (-1, -1), 5.35),
        ("LEADING", (0, 0), (-1, -1), 5.75),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]

    # Notes faibles en rouge, comme sur les bulletins imprimés.
    for row_idx, line in enumerate(lines, start=1):
        values = [line.get("p1"), line.get("p2"), line.get("ex1"), line.get("p3"), line.get("p4"), line.get("ex2")]
        columns = [2, 3, 4, 6, 7, 8]
        for value, col_idx in zip(values, columns):
            try:
                if value is not None and float(value) < 5:
                    styles_table.append(("TEXTCOLOR", (col_idx, row_idx), (col_idx, row_idx), colors.red))
            except (TypeError, ValueError):
                pass

    table.setStyle(TableStyle(styles_table))
    story.append(table)
    story.append(Spacer(1, 0.12 * cm))

    # Bas du bulletin : décision, signatures et vérification.
    footer_data = [
        [
            Paragraph("<b>APPLICATION</b><br/>Conduite : ____________<br/>Signature de l'élève : ____________", tiny),
            Paragraph("<b>OBSERVATION / DECISION</b><br/>%s" % _fmt(snapshot.get("decision", "")), tiny),
            Paragraph("<b>Le titulaire</b><br/><br/>____________________", small_center),
            Paragraph("<b>Le Chef d'établissement</b><br/><br/>____________________", small_center),
        ],
        [
            Paragraph(f"QR : {verification_url}", tiny),
            Paragraph(f"Filigrane : {student.get('full_name', '')} | {student.get('matricule', '')} | téléchargé par {downloaded_by} | {datetime.now().isoformat(timespec='seconds')}", tiny),
            "",
            Paragraph("<b>Sceau de l'école</b>", small_center),
        ],
    ]
    footer = Table(footer_data, colWidths=[4.7 * cm, 6.0 * cm, 3.4 * cm, 3.4 * cm])
    footer.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, colors.black),
        ("SPAN", (1, 1), (2, 1)),
        ("FONTSIZE", (0, 0), (-1, -1), 5.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(footer)

    doc.build(story)
    return path
