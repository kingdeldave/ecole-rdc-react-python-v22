from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import Base, engine
from app import models  # noqa: F401 - force le chargement des modèles SQLAlchemy
from app.api import auth, audit, attendance, backups, classes, course_resources, dashboard, discipline, documents, enrollments, exams, excel, grade_import, grade_submissions, grades, library, notifications, password_reset, payments, public, report_cards, schedules, school_years, students, subjects, users

# Création automatique des tables pour le développement.
# En production, remplacer par Alembic migrations.
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Démonstration Cloudflare Tunnel : les liens trycloudflare changent à chaque relance.
    # On autorise donc les requêtes cross-origin avec Authorization Bearer sans cookies.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(password_reset.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(enrollments.router, prefix="/api/v1")
app.include_router(exams.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(course_resources.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(library.router, prefix="/api/v1")
app.include_router(discipline.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(grades.router, prefix="/api/v1")
app.include_router(grade_import.router, prefix="/api/v1")
app.include_router(grade_submissions.router, prefix="/api/v1")
app.include_router(excel.router, prefix="/api/v1")
app.include_router(report_cards.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(backups.router, prefix="/api/v1")
app.include_router(school_years.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "status": "ok", "docs": "/docs"}
