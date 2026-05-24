from __future__ import annotations

from datetime import datetime, timezone
import os
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.models import Notification, UserProfile


def _send_email_if_configured(to_email: str, subject: str, body: str) -> str:
    """Envoie un email si SMTP est configuré, sinon simule l'envoi en développement.

    Variables optionnelles : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
    SMTP_FROM. Sans ces variables, le statut reste SIMULE_DEV pour montrer que
    la notification email a été préparée sans bloquer le développement local.
    """
    host = os.getenv("SMTP_HOST")
    if not host:
        return "SIMULE_DEV"

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username or "noreply@ecole-rdc.local")

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(msg)
    return "ENVOYE"


def create_notification(
    db: Session,
    *,
    recipient: UserProfile,
    notif_type: str,
    title: str,
    message: str,
    action_url: str | None = None,
    school_id=None,
    send_email: bool = False,
) -> Notification:
    email_status = None
    email_to = None
    email_sent_at = None

    if send_email and recipient.email:
        email_to = recipient.email
        try:
            email_status = _send_email_if_configured(recipient.email, title, message)
            email_sent_at = datetime.now(timezone.utc)
        except Exception as exc:  # L'envoi mail ne doit jamais casser l'action métier.
            email_status = f"ECHEC: {exc.__class__.__name__}"

    notif = Notification(
        school_id=school_id if school_id is not None else recipient.school_id,
        recipient_id=recipient.id,
        type=notif_type,
        title=title,
        message=message,
        action_url=action_url,
        email_to=email_to,
        email_status=email_status,
        email_sent_at=email_sent_at,
    )
    db.add(notif)
    return notif
