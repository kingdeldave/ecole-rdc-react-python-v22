from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, Period, PeriodCode, RoleCode, SchoolYear, UserProfile
from app.schemas import PeriodOut, PeriodUpdate, SchoolYearCreate, SchoolYearOut, SchoolYearUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/school-years", tags=["school-years"])

MANAGE_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.PREFET, RoleCode.DIRECTEUR, RoleCode.ADMIN_ECOLE}
DEFAULT_PERIODS = [
    (PeriodCode.P1, "1ère période"),
    (PeriodCode.P2, "2ème période"),
    (PeriodCode.EX1, "Examen 1er semestre"),
    (PeriodCode.P3, "3ème période"),
    (PeriodCode.P4, "4ème période"),
    (PeriodCode.EX2, "Examen 2ème semestre"),
    (PeriodCode.RATTRAPAGE, "Session de rattrapage"),
    (PeriodCode.TENASOP, "TENASOP"),
    (PeriodCode.BAC, "BAC / EXETAT"),
]


def _check_manage(user: UserProfile) -> None:
    if user.role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Gestion des années scolaires réservée à la direction ou au secrétariat.")


def _year_to_out(db: Session, year: SchoolYear) -> SchoolYearOut:
    periods = (
        db.query(Period)
        .filter(Period.school_year_id == year.id)
        .order_by(Period.created_at.asc())
        .all()
    )
    return SchoolYearOut(
        id=year.id,
        label=year.label,
        is_active=year.is_active,
        is_closed=year.is_closed,
        is_archived=getattr(year, "is_archived", False),
        periods=[PeriodOut.model_validate(p) for p in periods],
    )


def _create_default_periods(db: Session, year: SchoolYear) -> None:
    for code, label in DEFAULT_PERIODS:
        exists = (
            db.query(Period)
            .filter(Period.school_id == year.school_id, Period.school_year_id == year.id, Period.code == code)
            .first()
        )
        if not exists:
            db.add(Period(school_id=year.school_id, school_year_id=year.id, code=code, label=label, is_open=True, is_closed=False))


@router.get("", response_model=list[SchoolYearOut])
def list_school_years(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(SchoolYear)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(SchoolYear.school_id == user.school_id)
    years = q.order_by(SchoolYear.label.desc()).all()
    return [_year_to_out(db, y) for y in years]


@router.post("", response_model=SchoolYearOut)
def create_school_year(payload: SchoolYearCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _check_manage(user)
    school_id = user.school_id
    if user.role == RoleCode.SUPER_ADMIN:
        # Pour la démo mono-école, on rattache au premier établissement si le super admin n'a pas de school_id.
        existing = db.query(SchoolYear).first()
        school_id = existing.school_id if existing else user.school_id
    if school_id is None:
        raise HTTPException(status_code=422, detail="Aucune école rattachée à ce compte.")

    duplicate = db.query(SchoolYear).filter(SchoolYear.school_id == school_id, SchoolYear.label == payload.label).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Cette année scolaire existe déjà.")

    if payload.is_active:
        db.query(SchoolYear).filter(SchoolYear.school_id == school_id).update({SchoolYear.is_active: False})

    year = SchoolYear(school_id=school_id, label=payload.label, is_active=payload.is_active, is_closed=False, is_archived=False)
    db.add(year)
    db.flush()
    _create_default_periods(db, year)
    log_action(db, user=user, action=AuditAction.UPDATE_USER, entity_type="school_year", entity_id=str(year.id), new_value={"label": year.label, "active": year.is_active}, **request_meta(request))
    db.commit()
    db.refresh(year)
    return _year_to_out(db, year)


@router.patch("/{year_id}", response_model=SchoolYearOut)
def update_school_year(year_id: str, payload: SchoolYearUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _check_manage(user)
    year = db.get(SchoolYear, year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Année scolaire introuvable.")
    ensure_same_school(user, year.school_id)
    old_value = {"label": year.label, "is_active": year.is_active, "is_closed": year.is_closed, "is_archived": getattr(year, "is_archived", False)}

    if payload.label is not None:
        year.label = payload.label
    if payload.is_active is not None:
        if payload.is_active:
            db.query(SchoolYear).filter(SchoolYear.school_id == year.school_id, SchoolYear.id != year.id).update({SchoolYear.is_active: False})
            year.is_closed = False
            year.is_archived = False
        year.is_active = payload.is_active
    if payload.is_closed is not None:
        year.is_closed = payload.is_closed
        if payload.is_closed:
            year.is_active = False
            db.query(Period).filter(Period.school_year_id == year.id).update({Period.is_open: False, Period.is_closed: True})
    if payload.is_archived is not None:
        year.is_archived = payload.is_archived
        if payload.is_archived:
            year.is_active = False
            year.is_closed = True
            db.query(Period).filter(Period.school_year_id == year.id).update({Period.is_open: False, Period.is_closed: True})

    log_action(db, user=user, action=AuditAction.UPDATE_USER, entity_type="school_year", entity_id=str(year.id), old_value=old_value, new_value={"label": year.label, "is_active": year.is_active, "is_closed": year.is_closed, "is_archived": year.is_archived}, **request_meta(request))
    db.commit()
    db.refresh(year)
    return _year_to_out(db, year)


@router.patch("/{year_id}/periods/{period_id}", response_model=PeriodOut)
def update_period(year_id: str, period_id: str, payload: PeriodUpdate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    _check_manage(user)
    year = db.get(SchoolYear, year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Année scolaire introuvable.")
    ensure_same_school(user, year.school_id)
    period = db.get(Period, period_id)
    if not period or str(period.school_year_id) != str(year.id):
        raise HTTPException(status_code=404, detail="Période introuvable.")

    old_value = {"is_open": period.is_open, "is_closed": period.is_closed}
    if payload.is_open is not None:
        period.is_open = payload.is_open
        if payload.is_open:
            period.is_closed = False
    if payload.is_closed is not None:
        period.is_closed = payload.is_closed
        if payload.is_closed:
            period.is_open = False
    log_action(db, user=user, action=AuditAction.LOCK_GRADE_MANUAL if period.is_closed else AuditAction.UNLOCK_GRADE, entity_type="period", entity_id=str(period.id), old_value=old_value, new_value={"is_open": period.is_open, "is_closed": period.is_closed}, **request_meta(request))
    db.commit()
    db.refresh(period)
    return PeriodOut.model_validate(period)
