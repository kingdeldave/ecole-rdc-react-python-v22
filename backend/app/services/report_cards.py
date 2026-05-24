from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import (
    AuditAction,
    ClassRoom,
    ClassSubject,
    FeeStatus,
    Grade,
    Notification,
    Parent,
    ParentStudent,
    PeriodCode,
    ReportCard,
    ReportCardVersion,
    ReportStatus,
    RoleCode,
    Student,
    StudentFeeStatus,
    UserProfile,
)
from app.services.audit import log_action

PERIODS = [PeriodCode.P1, PeriodCode.P2, PeriodCode.EX1, PeriodCode.P3, PeriodCode.P4, PeriodCode.EX2, PeriodCode.RATTRAPAGE, PeriodCode.TENASOP, PeriodCode.BAC]


def _grade_map(db: Session, student_id: UUID, class_subject_ids: list[UUID]) -> dict[tuple[UUID, PeriodCode], Grade]:
    grades = (
        db.query(Grade)
        .filter(Grade.student_id == student_id, Grade.class_subject_id.in_(class_subject_ids))
        .all()
    )
    return {(g.class_subject_id, g.period_code): g for g in grades}


def _decision(percentage: float) -> str:
    """Décision simple. Les seuils peuvent être rendus configurables par école."""
    if percentage >= 50:
        return "PASSE"
    if percentage >= 40:
        return "AJOURNÉ / REPÊCHAGE"
    return "DOUBLE"


def build_snapshot(db: Session, student: Student) -> dict[str, Any]:
    """Construit une copie calculée du bulletin à partir des notes en base.

    La logique tient compte des périodes ordinaires, du rattrapage, du TENASOP
    et du BAC. Les maxima restent configurables par cours via l'interface
    d'administration/direction.
    """
    classroom = student.classroom
    class_subjects = (
        db.query(ClassSubject)
        .filter(ClassSubject.class_id == student.class_id)
        .join(ClassSubject.subject)
        .order_by(ClassSubject.display_order.asc())
        .all()
    )
    grade_map = _grade_map(db, student.id, [cs.id for cs in class_subjects])

    lines: list[dict[str, Any]] = []
    total = 0.0
    max_total = 0.0
    ordinary_total = 0.0
    ordinary_max_total = 0.0
    rattrapage_total = 0.0
    rattrapage_max_total = 0.0
    tenasop_total = 0.0
    tenasop_max_total = 0.0
    bac_total = 0.0
    bac_max_total = 0.0

    for cs in class_subjects:
        values: dict[str, float | None] = {}
        for code, key in [
            (PeriodCode.P1, "p1"),
            (PeriodCode.P2, "p2"),
            (PeriodCode.EX1, "ex1"),
            (PeriodCode.P3, "p3"),
            (PeriodCode.P4, "p4"),
            (PeriodCode.EX2, "ex2"),
            (PeriodCode.RATTRAPAGE, "rattrapage"),
            (PeriodCode.TENASOP, "tenasop"),
            (PeriodCode.BAC, "bac"),
        ]:
            grade = grade_map.get((cs.id, code))
            values[key] = grade.value if grade else None

        s1_total = sum(v or 0 for v in [values["p1"], values["p2"], values["ex1"]])
        s2_total = sum(v or 0 for v in [values["p3"], values["p4"], values["ex2"]])
        base_total = s1_total + s2_total
        base_max = cs.max_p1 + cs.max_p2 + cs.max_ex1 + cs.max_p3 + cs.max_p4 + cs.max_ex2
        rat = values["rattrapage"] or 0
        ten = values["tenasop"] or 0
        bac = values["bac"] or 0
        rattrapage_max = cs.max_rattrapage if values["rattrapage"] is not None else 0
        tenasop_max = cs.max_tenasop if values["tenasop"] is not None else 0
        bac_max = cs.max_bac if values["bac"] is not None else 0
        line_total = base_total + rat + ten + bac
        line_max = base_max + rattrapage_max + tenasop_max + bac_max

        ordinary_total += base_total
        ordinary_max_total += base_max
        rattrapage_total += rat
        rattrapage_max_total += rattrapage_max
        tenasop_total += ten
        tenasop_max_total += tenasop_max
        bac_total += bac
        bac_max_total += bac_max
        total += line_total
        max_total += line_max
        lines.append(
            {
                "subject_id": str(cs.subject_id),
                "subject_name": cs.subject.name,
                "p1": values["p1"],
                "p2": values["p2"],
                "ex1": values["ex1"],
                "s1_total": s1_total,
                "p3": values["p3"],
                "p4": values["p4"],
                "ex2": values["ex2"],
                "s2_total": s2_total,
                "rattrapage": values["rattrapage"],
                "tenasop": values["tenasop"],
                "bac": values["bac"],
                "total": line_total,
                "max_total": line_max,
            }
        )

    percentage = round((total / max_total * 100), 2) if max_total else 0.0
    s1_total = sum(line["s1_total"] for line in lines)
    s2_total = sum(line["s2_total"] for line in lines)
    return {
        "school": {
            "name": classroom.school.name,
            "code": classroom.school.code,
            "city": classroom.school.city,
            "commune": classroom.school.commune,
            "province": classroom.school.province,
        },
        "school_year": {
            "id": str(classroom.school_year_id),
            "label": classroom.school_year.label if classroom.school_year else "",
        },
        "student": {
            "id": str(student.id),
            "matricule": student.matricule,
            "full_name": student.full_name,
            "last_name": student.last_name,
            "middle_name": student.middle_name,
            "first_name": student.first_name,
            "sex": student.sex,
        },
        "class": {"id": str(classroom.id), "name": classroom.name, "option": classroom.option},
        "lines": lines,
        "total": round(total, 2),
        "max_total": round(max_total, 2),
        "ordinary_total": round(ordinary_total, 2),
        "ordinary_max_total": round(ordinary_max_total, 2),
        "s1_total": round(s1_total, 2),
        "s2_total": round(s2_total, 2),
        "rattrapage_total": round(rattrapage_total, 2),
        "rattrapage_max_total": round(rattrapage_max_total, 2),
        "tenasop_total": round(tenasop_total, 2),
        "tenasop_max_total": round(tenasop_max_total, 2),
        "bac_total": round(bac_total, 2),
        "bac_max_total": round(bac_max_total, 2),
        "percentage": percentage,
        "decision": _decision(percentage),
    }

def _payment_blocked(db: Session, student: Student) -> bool:
    year_id = student.classroom.school_year_id
    fee = (
        db.query(StudentFeeStatus)
        .filter(StudentFeeStatus.student_id == student.id, StudentFeeStatus.school_year_id == year_id)
        .first()
    )
    if not fee:
        return True
    if fee.bulletin_access_override:
        return False
    return fee.status != FeeStatus.EN_ORDRE


def upsert_report_card(db: Session, *, user: UserProfile, student: Student) -> ReportCard:
    """Génère ou régénère un bulletin non publié."""
    existing = (
        db.query(ReportCard)
        .filter(ReportCard.student_id == student.id, ReportCard.school_year_id == student.classroom.school_year_id)
        .first()
    )
    if existing and existing.locked and user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Bulletin déjà publié et verrouillé.")

    snapshot = build_snapshot(db, student)
    blocked = _payment_blocked(db, student)
    if existing:
        card = existing
        card.snapshot_json = snapshot
        card.total = snapshot["total"]
        card.max_total = snapshot["max_total"]
        card.percentage = snapshot["percentage"]
        card.decision = snapshot["decision"]
        card.payment_blocked = blocked
        if card.status == ReportStatus.PUBLISHED:
            card.status = ReportStatus.CORRECTED
        elif card.status not in {ReportStatus.BLOCKED, ReportStatus.VALIDATED}:
            card.status = ReportStatus.CALCULATED
    else:
        card = ReportCard(
            school_id=student.school_id,
            school_year_id=student.classroom.school_year_id,
            class_id=student.class_id,
            student_id=student.id,
            snapshot_json=snapshot,
            total=snapshot["total"],
            max_total=snapshot["max_total"],
            percentage=snapshot["percentage"],
            decision=snapshot["decision"],
            payment_blocked=blocked,
            status=ReportStatus.CALCULATED,
        )
        db.add(card)
        db.flush()

    log_action(db, user=user, action=AuditAction.GENERATE_REPORT, entity_type="report_card", entity_id=str(card.id), new_value={"student_id": str(student.id)})
    return card


def compute_class_ranks(db: Session, class_id: UUID) -> None:
    """Classe les bulletins d'une classe selon le pourcentage décroissant."""
    cards = (
        db.query(ReportCard)
        .filter(ReportCard.class_id == class_id)
        .order_by(ReportCard.percentage.desc(), ReportCard.total.desc())
        .all()
    )
    last_percentage: float | None = None
    last_rank = 0
    for index, card in enumerate(cards, start=1):
        if last_percentage is not None and card.percentage == last_percentage:
            card.rank = last_rank
        else:
            card.rank = index
            last_rank = index
            last_percentage = card.percentage


def validate_report_card(db: Session, *, user: UserProfile, card: ReportCard) -> ReportCard:
    if user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Seule la direction peut valider un bulletin.")
    card.status = ReportStatus.VALIDATED
    card.validated_by_id = user.id
    log_action(db, user=user, action=AuditAction.VALIDATE_REPORT, entity_type="report_card", entity_id=str(card.id))
    return card


def publish_report_card(db: Session, *, user: UserProfile, card: ReportCard) -> ReportCard:
    if user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Seule la direction peut publier un bulletin.")
    if card.status not in {ReportStatus.VALIDATED, ReportStatus.CORRECTED}:
        raise HTTPException(status_code=422, detail="Le bulletin doit être validé avant publication.")
    if card.payment_blocked:
        card.status = ReportStatus.BLOCKED
        raise HTTPException(status_code=422, detail="Bulletin bloqué pour frais scolaires non régularisés. Veuillez contacter l’administration de l’école.")

    card.status = ReportStatus.PUBLISHED
    card.locked = True
    card.published_by_id = user.id
    card.published_at = datetime.now(timezone.utc)
    db.add(ReportCardVersion(report_card_id=card.id, version=card.version, status=card.status, snapshot_json=card.snapshot_json, created_by_id=user.id))

    # Notification parent si un compte parent existe.
    parent_links = db.query(ParentStudent).filter(ParentStudent.student_id == card.student_id).all()
    for link in parent_links:
        parent = db.get(Parent, link.parent_id)
        if parent and parent.profile_id:
            db.add(Notification(
                school_id=card.school_id,
                recipient_id=parent.profile_id,
                type="BULLETIN_PUBLIE",
                title="Nouveau bulletin publié",
                message="Le bulletin de votre enfant est disponible dans votre espace parent.",
                action_url=f"/bulletins/{card.id}",
            ))

    log_action(db, user=user, action=AuditAction.PUBLISH_REPORT, entity_type="report_card", entity_id=str(card.id))
    return card


def official_correction(db: Session, *, user: UserProfile, card: ReportCard, reason: str) -> ReportCard:
    """Crée une nouvelle version officielle après publication."""
    if user.role not in {RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.SUPER_ADMIN}:
        raise HTTPException(status_code=403, detail="Correction réservée à la direction.")
    if not reason or len(reason.strip()) < 5:
        raise HTTPException(status_code=422, detail="Motif obligatoire pour correction officielle.")
    db.add(ReportCardVersion(report_card_id=card.id, version=card.version, status=card.status, snapshot_json=card.snapshot_json, correction_reason=reason, created_by_id=user.id))
    card.version += 1
    card.status = ReportStatus.CORRECTED
    card.locked = False
    log_action(db, user=user, action=AuditAction.OFFICIAL_CORRECTION, entity_type="report_card", entity_id=str(card.id), reason=reason)
    return card
