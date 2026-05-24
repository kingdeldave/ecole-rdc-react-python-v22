from __future__ import annotations

import json
from datetime import date, datetime, timezone
from enum import Enum
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import Base, get_db
from app.deps import get_current_user, request_meta
from app.models import AuditAction, BackupSnapshot, RoleCode, UserProfile
from app.schemas import BackupCreate, BackupOut
from app.services.audit import log_action

router = APIRouter(prefix="/backups", tags=["backups"])
BACKUP_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _serial(value):
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value


def _snapshot(db: Session) -> dict:
    payload = {"version": 1, "created_at": datetime.now(timezone.utc).isoformat(), "tables": {}}
    for table in Base.metadata.sorted_tables:
        rows = db.execute(select(table)).mappings().all()
        payload["tables"][table.name] = [{k: _serial(v) for k, v in row.items()} for row in rows]
    return payload


def _out(row: BackupSnapshot) -> BackupOut:
    table_count = len((row.snapshot_json or {}).get("tables", {}))
    return BackupOut(id=row.id, label=row.label, status=row.status, created_at=row.created_at, restored_at=row.restored_at, table_count=table_count)


@router.get("", response_model=list[BackupOut])
def list_backups(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in BACKUP_ROLES:
        raise HTTPException(status_code=403, detail="Sauvegardes réservées à la direction.")
    q = db.query(BackupSnapshot)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(BackupSnapshot.school_id == user.school_id)
    return [_out(row) for row in q.order_by(BackupSnapshot.created_at.desc()).limit(50).all()]


@router.post("", response_model=BackupOut)
def create_backup(payload: BackupCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in BACKUP_ROLES:
        raise HTTPException(status_code=403, detail="Création de sauvegarde non autorisée.")
    snap = _snapshot(db)
    row = BackupSnapshot(school_id=user.school_id, label=payload.label, snapshot_json=snap, created_by_id=user.id)
    db.add(row)
    log_action(db, user=user, action=AuditAction.CREATE_BACKUP, entity_type="backup_snapshots", new_value={"label": payload.label, "tables": len(snap.get("tables", {}))}, **request_meta(request))
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("/{backup_id}/download")
def download_backup(backup_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in BACKUP_ROLES:
        raise HTTPException(status_code=403, detail="Téléchargement non autorisé.")
    row = db.get(BackupSnapshot, backup_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable.")
    if user.role != RoleCode.SUPER_ADMIN and row.school_id != user.school_id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    return row.snapshot_json


@router.post("/{backup_id}/restore", response_model=BackupOut)
def restore_backup(backup_id: str, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in BACKUP_ROLES:
        raise HTTPException(status_code=403, detail="Restauration réservée à la direction.")
    row = db.get(BackupSnapshot, backup_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable.")
    if user.role != RoleCode.SUPER_ADMIN and row.school_id != user.school_id:
        raise HTTPException(status_code=403, detail="Accès interdit.")
    snap = json.loads(json.dumps(row.snapshot_json))
    tables = snap.get("tables", {})
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        for table in Base.metadata.sorted_tables:
            rows = tables.get(table.name, [])
            if rows:
                db.execute(table.insert(), rows)
        # Après insertion, on remet l'objet courant dans l'état restauré.
        restored = db.get(BackupSnapshot, backup_id)
        if restored:
            restored.status = "restored"
            restored.restored_at = datetime.now(timezone.utc)
            restored.restored_by_id = user.id
        log_action(db, user=user, action=AuditAction.RESTORE_BACKUP, entity_type="backup_snapshots", entity_id=backup_id, **request_meta(request))
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restauration impossible: {exc}") from exc
    restored = db.get(BackupSnapshot, backup_id)
    if not restored:
        raise HTTPException(status_code=500, detail="Sauvegarde restaurée mais introuvable après opération.")
    return _out(restored)
