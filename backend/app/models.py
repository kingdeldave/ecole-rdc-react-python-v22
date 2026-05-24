from __future__ import annotations

import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class RoleCode(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN_ECOLE = "ADMIN_ECOLE"
    PREFET = "PREFET"
    DIRECTEUR = "DIRECTEUR"
    ENSEIGNANT = "ENSEIGNANT"
    COMPTABLE = "COMPTABLE"
    PARENT = "PARENT"
    ELEVE = "ELEVE"


class PeriodCode(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    EX1 = "EX1"
    P3 = "P3"
    P4 = "P4"
    EX2 = "EX2"
    RATTRAPAGE = "RATTRAPAGE"
    TENASOP = "TENASOP"
    BAC = "BAC"


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CALCULATED = "CALCULATED"
    TITULAR_REVIEW = "TITULAR_REVIEW"
    VALIDATED_BY_TITULAR = "VALIDATED_BY_TITULAR"
    VALIDATED = "VALIDATED"
    PUBLISHED = "PUBLISHED"
    BLOCKED = "BLOCKED"
    UNBLOCKED = "UNBLOCKED"
    CORRECTED = "CORRECTED"
    ARCHIVED = "ARCHIVED"


class FeeStatus(str, enum.Enum):
    EN_ORDRE = "EN_ORDRE"
    PARTIEL = "PARTIEL"
    NON_PAYE = "NON_PAYE"
    EXEMPTION = "EXEMPTION"


class AuditAction(str, enum.Enum):
    LOGIN = "LOGIN"
    CREATE_STUDENT = "CREATE_STUDENT"
    UPDATE_STUDENT = "UPDATE_STUDENT"
    DELETE_STUDENT = "DELETE_STUDENT"
    UPDATE_FEE_STATUS = "UPDATE_FEE_STATUS"
    ENTER_GRADE = "ENTER_GRADE"
    UPDATE_GRADE = "UPDATE_GRADE"
    GENERATE_REPORT = "GENERATE_REPORT"
    VALIDATE_REPORT = "VALIDATE_REPORT"
    PUBLISH_REPORT = "PUBLISH_REPORT"
    SIGN_REPORT = "SIGN_REPORT"
    DOWNLOAD_REPORT = "DOWNLOAD_REPORT"
    EXPORT_EXCEL = "EXPORT_EXCEL"
    IMPORT_EXCEL = "IMPORT_EXCEL"
    PAYMENT_ADDED = "PAYMENT_ADDED"
    OFFICIAL_CORRECTION = "OFFICIAL_CORRECTION"
    LOCK_GRADE = "LOCK_GRADE"
    BLOCK_REPORT = "BLOCK_REPORT"
    UNBLOCK_REPORT = "UNBLOCK_REPORT"
    CREATE_COURSE_RESOURCE = "CREATE_COURSE_RESOURCE"
    CREATE_DISCIPLINARY_ACTION = "CREATE_DISCIPLINARY_ACTION"
    CREATE_SUBJECT = "CREATE_SUBJECT"
    UPDATE_CLASS_SUBJECT_MAXIMA = "UPDATE_CLASS_SUBJECT_MAXIMA"
    CREATE_USER = "CREATE_USER"
    UPDATE_USER = "UPDATE_USER"
    RESTORE_AUDIT = "RESTORE_AUDIT"
    LOCK_GRADE_MANUAL = "LOCK_GRADE_MANUAL"
    UNLOCK_GRADE = "UNLOCK_GRADE"
    REQUEST_PASSWORD_RESET = "REQUEST_PASSWORD_RESET"
    RESET_PASSWORD = "RESET_PASSWORD"
    IMPORT_GRADES_EXCEL = "IMPORT_GRADES_EXCEL"
    CREATE_ENROLLMENT = "CREATE_ENROLLMENT"
    REENROLL_STUDENT = "REENROLL_STUDENT"
    CREATE_ATTENDANCE = "CREATE_ATTENDANCE"
    CREATE_SCHEDULE_SLOT = "CREATE_SCHEDULE_SLOT"
    GENERATE_DOCUMENT = "GENERATE_DOCUMENT"
    CREATE_BACKUP = "CREATE_BACKUP"
    RESTORE_BACKUP = "RESTORE_BACKUP"
    CREATE_LIBRARY_BOOK = "CREATE_LIBRARY_BOOK"
    CREATE_LIBRARY_LOAN = "CREATE_LIBRARY_LOAN"
    CREATE_OPTION = "CREATE_OPTION"
    CREATE_CLASS = "CREATE_CLASS"
    UPDATE_CLASS = "UPDATE_CLASS"
    ASSIGN_TITULAR = "ASSIGN_TITULAR"
    REMOVE_TITULAR = "REMOVE_TITULAR"
    CREATE_EXAM = "CREATE_EXAM"
    UPDATE_EXAM = "UPDATE_EXAM"
    SEND_GRADES_TO_JURY = "SEND_GRADES_TO_JURY"
    VALIDATE_GRADES_JURY = "VALIDATE_GRADES_JURY"
    REQUEST_GRADE_CORRECTION = "REQUEST_GRADE_CORRECTION"
    IMPORT_FULL_GRADES_EXCEL = "IMPORT_FULL_GRADES_EXCEL"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class School(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(String(180), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(80))
    commune: Mapped[str | None] = mapped_column(String(80))
    province: Mapped[str | None] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(30), default="active")
    logo_path: Mapped[str | None] = mapped_column(String(255))
    seal_path: Mapped[str | None] = mapped_column(String(255))

    users: Mapped[list[UserProfile]] = relationship(back_populates="school")
    classes: Mapped[list[ClassRoom]] = relationship(back_populates="school")


class SchoolYear(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "school_years"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    school: Mapped[School] = relationship()


class UserProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "profiles"

    # Dans Supabase production, ce profil doit être lié à auth.users(id).
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(60))
    role: Mapped[RoleCode] = mapped_column(Enum(RoleCode), nullable=False)
    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Photo de profil stockée en data URL en développement.
    # En production, stocker plutôt le fichier dans Supabase Storage privé et garder seulement le chemin signé.
    photo_path: Mapped[str | None] = mapped_column(Text)

    school: Mapped[School | None] = relationship(back_populates="users")


class ClassRoom(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "classes"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[str | None] = mapped_column(String(80))
    section: Mapped[str | None] = mapped_column(String(80))
    option: Mapped[str | None] = mapped_column(String(120))
    cycle: Mapped[str | None] = mapped_column(String(80))
    room: Mapped[str | None] = mapped_column(String(80))
    option_required: Mapped[bool] = mapped_column(Boolean, default=False)
    titulaire_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    school: Mapped[School] = relationship(back_populates="classes")
    school_year: Mapped[SchoolYear] = relationship()
    students: Mapped[list[Student]] = relationship(back_populates="classroom")
    class_subjects: Mapped[list[ClassSubject]] = relationship(back_populates="classroom")
    titulars: Mapped[list[ClassTitular]] = relationship(back_populates="classroom")


class SchoolOption(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "school_options"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_school_option_name"),)


class ClassTitular(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "class_titulars"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)

    classroom: Mapped[ClassRoom] = relationship(back_populates="titulars")
    teacher: Mapped[UserProfile] = relationship()

    __table_args__ = (UniqueConstraint("class_id", "teacher_id", "school_year_id", name="uq_class_titular_year"),)


class Student(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "students"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    profile_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    matricule: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    first_name: Mapped[str | None] = mapped_column(String(100))
    sex: Mapped[str] = mapped_column(String(1), default="M")
    birth_date: Mapped[date | None] = mapped_column(Date)
    birth_place: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="actif")
    photo_path: Mapped[str | None] = mapped_column(String(255))
    observations: Mapped[str | None] = mapped_column(Text)

    classroom: Mapped[ClassRoom] = relationship(back_populates="students")
    profile: Mapped[UserProfile | None] = relationship()
    grades: Mapped[list[Grade]] = relationship(back_populates="student")

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.middle_name, self.first_name]
        return " ".join([p for p in parts if p]).strip()


class Parent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "parents"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    profile_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(60))
    email: Mapped[str | None] = mapped_column(String(180))
    address: Mapped[str | None] = mapped_column(String(255))
    profession: Mapped[str | None] = mapped_column(String(120))
    account_status: Mapped[str] = mapped_column(String(30), default="active")

    profile: Mapped[UserProfile | None] = relationship()


class ParentStudent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "parent_students"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("parents.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(40), default="tuteur")

    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),)


class Subject(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "subjects"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ClassSubject(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "class_subjects"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    max_p1: Mapped[float] = mapped_column(Float, default=10)
    max_p2: Mapped[float] = mapped_column(Float, default=10)
    max_ex1: Mapped[float] = mapped_column(Float, default=20)
    max_p3: Mapped[float] = mapped_column(Float, default=10)
    max_p4: Mapped[float] = mapped_column(Float, default=10)
    max_ex2: Mapped[float] = mapped_column(Float, default=20)
    max_rattrapage: Mapped[float] = mapped_column(Float, default=20)
    max_tenasop: Mapped[float] = mapped_column(Float, default=40)
    max_bac: Mapped[float] = mapped_column(Float, default=40)
    display_order: Mapped[int] = mapped_column(Integer, default=1)
    schedule_label: Mapped[str | None] = mapped_column(String(180))

    classroom: Mapped[ClassRoom] = relationship(back_populates="class_subjects")
    subject: Mapped[Subject] = relationship()
    teacher: Mapped[UserProfile | None] = relationship()


class Period(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "periods"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    code: Mapped[PeriodCode] = mapped_column(Enum(PeriodCode), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("school_id", "school_year_id", "code", name="uq_period_school_year_code"),)


class Grade(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "grades"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    class_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class_subjects.id"), nullable=False)
    period_code: Mapped[PeriodCode] = mapped_column(Enum(PeriodCode), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    max_value: Mapped[float] = mapped_column(Float, nullable=False)
    entered_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    locked: Mapped[bool] = mapped_column(Boolean, default=False)

    student: Mapped[Student] = relationship(back_populates="grades")
    class_subject: Mapped[ClassSubject] = relationship()

    __table_args__ = (UniqueConstraint("student_id", "class_subject_id", "period_code", name="uq_grade_cell"),)


class GradeHistory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "grade_history"

    grade_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("grades.id"), nullable=False)
    old_value: Mapped[float | None] = mapped_column(Float)
    new_value: Mapped[float] = mapped_column(Float, nullable=False)
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    reason: Mapped[str | None] = mapped_column(Text)


class StudentFeeStatus(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "student_fee_statuses"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    total_due: Mapped[float] = mapped_column(Float, default=0)
    total_paid: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[FeeStatus] = mapped_column(Enum(FeeStatus), default=FeeStatus.NON_PAYE)
    bulletin_access_override: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("student_id", "school_year_id", name="uq_fee_status_student_year"),)


class Payment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payments"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, default=date.today)
    method: Mapped[str] = mapped_column(String(60), default="cash")
    receipt_number: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class ReportCard(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_cards"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.DRAFT)
    version: Mapped[int] = mapped_column(Integer, default=1)
    total: Mapped[float] = mapped_column(Float, default=0)
    max_total: Mapped[float] = mapped_column(Float, default=0)
    percentage: Mapped[float] = mapped_column(Float, default=0)
    rank: Mapped[int | None] = mapped_column(Integer)
    decision: Mapped[str | None] = mapped_column(String(120))
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    validated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    published_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student: Mapped[Student] = relationship()
    classroom: Mapped[ClassRoom] = relationship()

    __table_args__ = (UniqueConstraint("student_id", "school_year_id", name="uq_report_student_year"),)


class ReportCardVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_card_versions"

    report_card_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_cards.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), nullable=False)
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    correction_reason: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class ReportCardSignature(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "report_card_signatures"

    report_card_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_cards.id"), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("parents.id"))
    signature_name: Mapped[str] = mapped_column(String(180), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(255))


class Notification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"))
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(255))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    # Trace de l'envoi email. Sans SMTP configuré, l'email est marqué SIMULE_DEV.
    email_to: Mapped[str | None] = mapped_column(String(180))
    email_status: Mapped[str | None] = mapped_column(String(40))
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"

    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    user_role: Mapped[str | None] = mapped_column(String(80))
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(String(100))
    old_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)
    reason: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(255))


class Letter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "letters"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    letter_type: Mapped[str] = mapped_column(String(80), default="information")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class DisciplinaryAction(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "disciplinary_actions"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    action_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class CourseResource(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_resources"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class_subjects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    resource_type: Mapped[str] = mapped_column(String(40), default="lesson")
    url: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    class_subject: Mapped[ClassSubject] = relationship()
    created_by: Mapped[UserProfile | None] = relationship()


class PasswordResetToken(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[UserProfile] = relationship()


class Enrollment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "enrollments"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    school_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_years.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    enrollment_type: Mapped[str] = mapped_column(String(40), default="inscription")
    status: Mapped[str] = mapped_column(String(40), default="actif")
    decision: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    student: Mapped[Student] = relationship()
    classroom: Mapped[ClassRoom] = relationship()
    school_year: Mapped[SchoolYear] = relationship()

    __table_args__ = (UniqueConstraint("student_id", "school_year_id", name="uq_enrollment_student_year"),)


class AttendanceRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attendance_records"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, default=date.today)
    status: Mapped[str] = mapped_column(String(30), default="present")
    period_label: Mapped[str | None] = mapped_column(String(80))
    reason: Mapped[str | None] = mapped_column(Text)
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    student: Mapped[Student] = relationship()
    classroom: Mapped[ClassRoom] = relationship()

    __table_args__ = (UniqueConstraint("student_id", "attendance_date", "period_label", name="uq_attendance_student_date_period"),)


class ScheduleSlot(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "schedule_slots"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class_subjects.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    room: Mapped[str | None] = mapped_column(String(60))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    class_subject: Mapped[ClassSubject] = relationship()
    classroom: Mapped[ClassRoom] = relationship()
    teacher: Mapped[UserProfile | None] = relationship(foreign_keys=[teacher_id])


class AdministrativeDocument(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "administrative_documents"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(80), nullable=False)
    document_number: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="generated")
    file_path: Mapped[str | None] = mapped_column(String(500))
    generated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    student: Mapped[Student] = relationship()


class BackupSnapshot(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "backup_snapshots"

    school_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("schools.id"))
    label: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="created")
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    restored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    restored_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class ExamSchedule(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "exam_schedules"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    class_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class_subjects.id"), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str | None] = mapped_column(String(5))
    room: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(40), default="PROGRAMME")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    classroom: Mapped[ClassRoom] = relationship()
    class_subject: Mapped[ClassSubject] = relationship()
    created_by: Mapped[UserProfile | None] = relationship()


class GradeSubmission(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "grade_submissions"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    class_subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("class_subjects.id"), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), nullable=False)
    periods_json: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(50), default="ENVOYE_AU_JURY")
    students_total: Mapped[int] = mapped_column(Integer, default=0)
    grades_total: Mapped[int] = mapped_column(Integer, default=0)
    missing_total: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(Text)
    validated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    class_subject: Mapped[ClassSubject] = relationship()
    classroom: Mapped[ClassRoom] = relationship()
    teacher: Mapped[UserProfile] = relationship(foreign_keys=[teacher_id])
    validated_by: Mapped[UserProfile | None] = relationship(foreign_keys=[validated_by_id])


class LibraryBook(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "library_books"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    author: Mapped[str | None] = mapped_column(String(180))
    category: Mapped[str | None] = mapped_column(String(100))
    isbn: Mapped[str | None] = mapped_column(String(80))
    total_copies: Mapped[int] = mapped_column(Integer, default=1)
    available_copies: Mapped[int] = mapped_column(Integer, default=1)
    location: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="available")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))


class LibraryLoan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "library_loans"

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("library_books.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    loan_date: Mapped[date] = mapped_column(Date, default=date.today)
    due_date: Mapped[date | None] = mapped_column(Date)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), default="borrowed")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))

    book: Mapped[LibraryBook] = relationship()
    student: Mapped[Student] = relationship()
