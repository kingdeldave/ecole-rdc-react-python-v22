from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import ReportCard, ReportStatus

router = APIRouter(prefix="/public", tags=["public-verification"])


@router.get("/report-cards/{card_id}/verify")
def verify_report_card(card_id: str, version: int | None = None, db: Session = Depends(get_db)):
    """Vérification publique minimale pour QR code.

    En production, cette route doit être exposée derrière le domaine officiel de l'école
    ou intégrée à un portail ministériel. Elle ne révèle que les données nécessaires
    pour confirmer qu'un bulletin existe.
    """
    card = db.get(ReportCard, card_id)
    if not card or card.status not in {ReportStatus.PUBLISHED, ReportStatus.CORRECTED}:
        raise HTTPException(status_code=404, detail="Bulletin officiel introuvable ou non publié.")
    if version and version != card.version:
        raise HTTPException(status_code=404, detail="Version de bulletin introuvable.")
    return {
        "exists": True,
        "official_document": True,
        "report_card_id": str(card.id),
        "version": card.version,
        "student_matricule": card.snapshot_json.get("student", {}).get("matricule"),
        "student_name": card.snapshot_json.get("student", {}).get("full_name"),
        "school": card.snapshot_json.get("school", {}).get("name"),
        "class_name": card.snapshot_json.get("class", {}).get("name"),
        "percentage": card.percentage,
        "rank": card.rank,
        "published_at": card.published_at,
        "message": "Bulletin officiel existant dans la plateforme scolaire. Vérification à relier au portail ministériel en production.",
    }
