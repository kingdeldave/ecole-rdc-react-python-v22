from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models import PeriodCode, ReportStatus, RoleCode, FeeStatus


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None = None
    role: RoleCode
    school_id: UUID | None = None
    is_active: bool
    photo_path: str | None = None

    model_config = {"from_attributes": True}


class ProfilePhotoUpdate(BaseModel):
    photo_path: str | None = Field(default=None, max_length=2_000_000)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
    phone: str | None = Field(default=None, max_length=60)
    photo_path: str | None = Field(default=None, max_length=2_000_000)


class SchoolOut(BaseModel):
    id: UUID
    name: str
    code: str
    city: str | None = None
    commune: str | None = None
    province: str | None = None
    status: str

    model_config = {"from_attributes": True}


class ClassTitularOut(BaseModel):
    teacher_id: UUID
    teacher_name: str
    teacher_email: EmailStr | None = None
    teacher_phone: str | None = None


class ClassOut(BaseModel):
    id: UUID
    name: str
    level: str | None = None
    section: str | None = None
    option: str | None = None
    cycle: str | None = None
    room: str | None = None
    option_required: bool = False
    student_count: int = 0
    titulars: list[ClassTitularOut] = []


class ClassCreate(BaseModel):
    school_year_id: UUID | None = None
    name: str = Field(min_length=2, max_length=100)
    level: str | None = Field(default=None, max_length=80)
    section: str | None = Field(default=None, max_length=80)
    option: str | None = Field(default=None, max_length=120)
    cycle: str | None = Field(default=None, max_length=80)
    room: str | None = Field(default=None, max_length=80)
    option_required: bool = False


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    level: str | None = Field(default=None, max_length=80)
    section: str | None = Field(default=None, max_length=80)
    option: str | None = Field(default=None, max_length=120)
    cycle: str | None = Field(default=None, max_length=80)
    room: str | None = Field(default=None, max_length=80)
    option_required: bool | None = None
    is_archived: bool | None = None


class SchoolOptionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None


class SchoolOptionOut(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class ClassTitularIn(BaseModel):
    teacher_id: UUID


class StudentCreate(BaseModel):
    class_id: UUID
    matricule: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=2, max_length=100)
    middle_name: str | None = None
    first_name: str | None = None
    sex: str = Field(pattern="^(M|F)$")
    birth_date: date | None = None
    birth_place: str | None = None
    address: str | None = None
    observations: str | None = None


class StudentUpdate(BaseModel):
    class_id: UUID | None = None
    matricule: str | None = Field(default=None, min_length=2, max_length=60)
    last_name: str | None = Field(default=None, min_length=2, max_length=100)
    middle_name: str | None = None
    first_name: str | None = None
    sex: str | None = Field(default=None, pattern="^(M|F)$")
    birth_date: date | None = None
    birth_place: str | None = None
    address: str | None = None
    status: str | None = None
    observations: str | None = None
    photo_path: str | None = Field(default=None, max_length=2_000_000)


class StudentBulkRowIn(BaseModel):
    matricule: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=2, max_length=100)
    middle_name: str | None = None
    first_name: str | None = None
    sex: str = Field(default="M", pattern="^(M|F)$")
    birth_date: date | None = None
    birth_place: str | None = None
    address: str | None = None
    observations: str | None = None


class StudentBulkImportIn(BaseModel):
    class_id: UUID
    rows: list[StudentBulkRowIn] = Field(min_length=1, max_length=1000)


class StudentBulkImportOut(BaseModel):
    message: str
    created: int
    skipped: int
    errors: list[str] = []


class StudentOut(BaseModel):
    id: UUID
    matricule: str
    full_name: str
    sex: str
    class_id: UUID
    class_name: str
    class_option: str | None = None
    class_room: str | None = None
    status: str
    birth_date: date | None = None
    birth_place: str | None = None
    address: str | None = None
    payment_status: FeeStatus | None = None
    payment_blocked: bool = False
    total_due: float = 0
    total_paid: float = 0
    parent_count: int = 0
    photo_path: str | None = None


class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=180)
    phone: str | None = Field(default=None, max_length=60)
    role: RoleCode
    password: str = Field(default="Password123!", min_length=8)
    is_active: bool = True


class UserAdminUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
    phone: str | None = Field(default=None, max_length=60)
    role: RoleCode | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    photo_path: str | None = Field(default=None, max_length=2_000_000)


class ParentStudentLinkIn(BaseModel):
    parent_profile_id: UUID
    student_ids: list[UUID] = Field(default_factory=list)
    relationship_type: str = Field(default="tuteur", min_length=2, max_length=40)


class ParentChildrenOut(BaseModel):
    parent_profile_id: UUID
    parent_name: str
    parent_email: EmailStr | None = None
    children: list[StudentOut] = []


class UserAdminOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None = None
    role: RoleCode
    school_id: UUID | None = None
    is_active: bool
    photo_path: str | None = None
    demo_password: str | None = None

    model_config = {"from_attributes": True}


class SubjectOut(BaseModel):
    id: UUID
    name: str
    category: str | None = None
    display_order: int

    model_config = {"from_attributes": True}


class ClassSubjectOut(BaseModel):
    id: UUID
    subject_id: UUID
    subject_name: str
    class_name: str | None = None
    teacher_id: UUID | None = None
    teacher_name: str | None = None
    teacher_phone: str | None = None
    schedule_label: str | None = None
    max_p1: float
    max_p2: float
    max_ex1: float
    max_p3: float
    max_p4: float
    max_ex2: float
    max_rattrapage: float
    max_tenasop: float
    max_bac: float
    display_order: int


class ClassSubjectCreate(BaseModel):
    class_id: UUID
    subject_name: str = Field(min_length=2, max_length=150)
    category: str | None = None
    teacher_id: UUID | None = None
    max_p1: float = Field(default=10, ge=0)
    max_p2: float = Field(default=10, ge=0)
    max_ex1: float = Field(default=20, ge=0)
    max_p3: float = Field(default=10, ge=0)
    max_p4: float = Field(default=10, ge=0)
    max_ex2: float = Field(default=20, ge=0)
    max_rattrapage: float = Field(default=20, ge=0)
    max_tenasop: float = Field(default=40, ge=0)
    max_bac: float = Field(default=40, ge=0)
    display_order: int = Field(default=1, ge=1)
    schedule_label: str | None = Field(default=None, max_length=180)

    @field_validator("max_p1", "max_p2", "max_ex1", "max_p3", "max_p4", "max_ex2", "max_rattrapage", "max_tenasop", "max_bac")
    @classmethod
    def validate_allowed_maxima(cls, value: float) -> float:
        if value not in {0, 5, 10, 20, 40, 50, 80, 100}:
            raise ValueError("Le maximum doit correspondre au barème de l’école : 5, 10, 20, 40, 50, 80 ou 100.")
        return value


class ClassSubjectMaximaUpdate(BaseModel):
    max_p1: float = Field(ge=0)
    max_p2: float = Field(ge=0)
    max_ex1: float = Field(ge=0)
    max_p3: float = Field(ge=0)
    max_p4: float = Field(ge=0)
    max_ex2: float = Field(ge=0)
    max_rattrapage: float = Field(ge=0)
    max_tenasop: float = Field(ge=0)
    max_bac: float = Field(ge=0)
    schedule_label: str | None = Field(default=None, max_length=180)

    @field_validator("max_p1", "max_p2", "max_ex1", "max_p3", "max_p4", "max_ex2", "max_rattrapage", "max_tenasop", "max_bac")
    @classmethod
    def validate_allowed_maxima(cls, value: float) -> float:
        if value not in {0, 5, 10, 20, 40, 50, 80, 100}:
            raise ValueError("Le maximum doit correspondre au barème de l’école : 5, 10, 20, 40, 50, 80 ou 100.")
        return value




class TeacherScheduleCourseOut(BaseModel):
    class_subject_id: UUID
    class_name: str
    subject_name: str
    category: str | None = None
    schedule_label: str | None = None
    max_p1: float
    max_p2: float
    max_ex1: float
    max_p3: float
    max_p4: float
    max_ex2: float
    max_rattrapage: float
    max_tenasop: float
    max_bac: float


class TeacherScheduleOut(BaseModel):
    teacher_id: UUID
    teacher_name: str
    teacher_email: EmailStr | None = None
    teacher_phone: str | None = None
    teacher_photo_path: str | None = None
    course_count: int = 0
    classes_count: int = 0
    courses: list[TeacherScheduleCourseOut] = []


class GradeUnlockIn(BaseModel):
    class_subject_id: UUID
    period_code: PeriodCode
    student_id: UUID | None = None
    reason: str = Field(min_length=5, max_length=255)


class GradeLockToggleIn(BaseModel):
    class_subject_id: UUID
    period_code: PeriodCode
    student_id: UUID
    locked: bool
    reason: str = Field(min_length=5, max_length=255)


class GradeCellIn(BaseModel):
    student_id: UUID
    value: float | str

    @field_validator("value")
    @classmethod
    def validate_number_only(cls, value: float | str) -> float:
        """Empêche les valeurs du type 93/80 et force un nombre réel."""
        if isinstance(value, str):
            raw = value.strip().replace(",", ".")
            if "/" in raw:
                raise ValueError("La note doit être un nombre simple, pas un format 93/80.")
            try:
                return float(raw)
            except ValueError as exc:
                raise ValueError("La note doit être numérique.") from exc
        return float(value)


class GradeBulkIn(BaseModel):
    class_subject_id: UUID
    period_code: PeriodCode
    grades: list[GradeCellIn]
    reason: str | None = None


class GradeOut(BaseModel):
    id: UUID
    student_id: UUID
    class_subject_id: UUID
    period_code: PeriodCode
    value: float
    max_value: float
    locked: bool

    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    students: int
    classes: int
    subjects: int
    teachers: int
    report_cards: int
    published_report_cards: int
    blocked_report_cards: int
    payments_total: float
    unread_notifications: int
    role: RoleCode
    my_children: int = 0
    my_courses: int = 0
    locked_grades: int = 0
    unpaid_students: int = 0
    disciplinary_actions: int = 0
    course_resources: int = 0


class ReportLine(BaseModel):
    subject_id: UUID
    subject_name: str
    p1: float | None = None
    p2: float | None = None
    ex1: float | None = None
    s1_total: float
    p3: float | None = None
    p4: float | None = None
    ex2: float | None = None
    s2_total: float
    rattrapage: float | None = None
    tenasop: float | None = None
    bac: float | None = None
    total: float
    max_total: float


class ReportCardOut(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    class_id: UUID
    class_name: str
    status: ReportStatus
    version: int
    total: float
    max_total: float
    percentage: float
    rank: int | None = None
    decision: str | None = None
    payment_blocked: bool
    locked: bool
    published_at: datetime | None = None
    snapshot_json: dict[str, Any]

    model_config = {"from_attributes": True}


class ReportGenerateIn(BaseModel):
    student_id: UUID


class ReportClassGenerateIn(BaseModel):
    class_id: UUID


class ReportCorrectionIn(BaseModel):
    reason: str = Field(min_length=5)


class ReportSignatureIn(BaseModel):
    signature_name: str = Field(min_length=2, max_length=180)
    comment: str | None = None


class PaymentCreate(BaseModel):
    student_id: UUID
    school_year_id: UUID
    amount: float = Field(gt=0)
    method: str = "cash"


class FeeStatusUpdate(BaseModel):
    student_id: UUID
    school_year_id: UUID | None = None
    total_due: float = Field(ge=0)
    total_paid: float = Field(ge=0)
    bulletin_access_override: bool = False


class PaymentOut(BaseModel):
    id: UUID
    student_id: UUID
    amount: float
    payment_date: date
    method: str
    receipt_number: str

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: UUID
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    email_to: str | None = None
    email_status: str | None = None

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: UUID
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    user_role: str | None = None
    reason: str | None = None
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    created_at: datetime
    can_restore: bool = False

    model_config = {"from_attributes": True}


class ReportPaymentBlockIn(BaseModel):
    blocked: bool
    reason: str = Field(min_length=3, max_length=255)


class CourseResourceCreate(BaseModel):
    class_subject_id: UUID
    title: str = Field(min_length=3, max_length=180)
    description: str | None = None
    resource_type: str = "lesson"
    url: str | None = None
    content: str | None = None
    is_published: bool = True


class CourseResourceOut(BaseModel):
    id: UUID
    class_subject_id: UUID
    subject_name: str
    class_name: str
    title: str
    description: str | None = None
    resource_type: str
    url: str | None = None
    content: str | None = None
    is_published: bool
    created_by_name: str | None = None
    teacher_name: str | None = None
    teacher_phone: str | None = None
    schedule_label: str | None = None
    created_at: datetime


class DisciplinaryActionCreate(BaseModel):
    student_id: UUID
    action_type: str = Field(min_length=3, max_length=80)
    reason: str = Field(min_length=5)


class DisciplinaryActionOut(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    action_type: str
    reason: str
    action_date: date
    created_at: datetime


class PeriodOut(BaseModel):
    id: UUID
    code: PeriodCode
    label: str
    is_open: bool
    is_closed: bool

    model_config = {"from_attributes": True}


class PeriodUpdate(BaseModel):
    is_open: bool | None = None
    is_closed: bool | None = None


class SchoolYearCreate(BaseModel):
    label: str = Field(min_length=9, max_length=20)
    is_active: bool = False


class SchoolYearUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=9, max_length=20)
    is_active: bool | None = None
    is_closed: bool | None = None
    is_archived: bool | None = None


class SchoolYearOut(BaseModel):
    id: UUID
    label: str
    is_active: bool
    is_closed: bool
    is_archived: bool = False
    periods: list[PeriodOut] = []

    model_config = {"from_attributes": True}


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ForgotPasswordOut(BaseModel):
    message: str
    dev_reset_token: str | None = None


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8)


class GradeExcelImportOut(BaseModel):
    message: str
    imported: int
    skipped: int
    errors: list[str] = []


class EnrollmentCreate(BaseModel):
    student_id: UUID
    school_year_id: UUID
    class_id: UUID
    enrollment_type: str = Field(default="inscription", max_length=40)
    status: str = Field(default="actif", max_length=40)
    decision: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class ReEnrollmentCreate(BaseModel):
    student_id: UUID
    target_school_year_id: UUID
    target_class_id: UUID
    decision: str | None = Field(default="admis", max_length=120)
    notes: str | None = None


class EnrollmentOut(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    matricule: str
    school_year_id: UUID
    school_year_label: str
    class_id: UUID
    class_name: str
    enrollment_type: str
    status: str
    decision: str | None = None
    notes: str | None = None
    created_at: datetime


class AttendanceCellIn(BaseModel):
    student_id: UUID
    status: str = Field(pattern="^(present|absent|retard|justifie)$")
    reason: str | None = None


class AttendanceBulkIn(BaseModel):
    class_id: UUID
    attendance_date: date
    period_label: str | None = Field(default="Journée", max_length=80)
    records: list[AttendanceCellIn] = Field(min_length=1)


class AttendanceOut(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    matricule: str
    class_id: UUID
    class_name: str
    attendance_date: date
    period_label: str | None = None
    status: str
    reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleSlotCreate(BaseModel):
    class_subject_id: UUID
    day_of_week: str = Field(min_length=3, max_length=20)
    start_time: str = Field(pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    room: str | None = Field(default=None, max_length=60)


class ScheduleSlotOut(BaseModel):
    id: UUID
    class_subject_id: UUID
    class_id: UUID
    class_name: str
    subject_name: str
    teacher_id: UUID | None = None
    teacher_name: str | None = None
    day_of_week: str
    start_time: str
    end_time: str
    room: str | None = None
    is_active: bool


class AdministrativeDocumentCreate(BaseModel):
    student_id: UUID
    document_type: str = Field(pattern="^(attestation_frequentation|certificat_scolarite|fiche_inscription|attestation_bonne_conduite)$")


class AdministrativeDocumentOut(BaseModel):
    id: UUID
    student_id: UUID
    student_name: str
    matricule: str
    document_type: str
    document_number: str
    title: str
    status: str
    created_at: datetime


class BackupCreate(BaseModel):
    label: str = Field(min_length=3, max_length=180)


class BackupOut(BaseModel):
    id: UUID
    label: str
    status: str
    created_at: datetime
    restored_at: datetime | None = None
    table_count: int = 0


class LibraryBookCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    author: str | None = Field(default=None, max_length=180)
    category: str | None = Field(default=None, max_length=100)
    isbn: str | None = Field(default=None, max_length=80)
    total_copies: int = Field(default=1, ge=1)
    location: str | None = Field(default=None, max_length=120)


class LibraryBookOut(BaseModel):
    id: UUID
    title: str
    author: str | None = None
    category: str | None = None
    isbn: str | None = None
    total_copies: int
    available_copies: int
    location: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LibraryLoanCreate(BaseModel):
    book_id: UUID
    student_id: UUID
    due_date: date | None = None


class LibraryLoanOut(BaseModel):
    id: UUID
    book_id: UUID
    book_title: str
    student_id: UUID
    student_name: str
    matricule: str
    loan_date: date
    due_date: date | None = None
    status: str
    returned_at: datetime | None = None


class ExamScheduleCreate(BaseModel):
    class_subject_id: UUID
    exam_date: date
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    room: str | None = Field(default=None, max_length=80)


class ExamScheduleOut(BaseModel):
    id: UUID
    class_id: UUID
    class_name: str
    class_option: str | None = None
    class_subject_id: UUID
    subject_name: str
    exam_date: date
    start_time: str
    end_time: str | None = None
    room: str | None = None
    status: str
    created_by_name: str | None = None
    created_at: datetime


class GradeSubmissionCreate(BaseModel):
    class_subject_id: UUID
    periods: list[PeriodCode] = Field(default_factory=lambda: [PeriodCode.P1, PeriodCode.P2, PeriodCode.EX1, PeriodCode.P3, PeriodCode.P4, PeriodCode.EX2])
    note: str | None = None


class GradeSubmissionCourseOut(BaseModel):
    class_subject_id: UUID
    class_id: UUID
    class_name: str
    class_option: str | None = None
    subject_name: str
    teacher_name: str | None = None
    students_total: int
    grades_total: int
    missing_total: int
    latest_status: str | None = None


class GradeSubmissionOut(BaseModel):
    id: UUID
    class_subject_id: UUID
    class_id: UUID
    class_name: str
    class_option: str | None = None
    subject_name: str
    teacher_id: UUID
    teacher_name: str
    periods: list[str]
    status: str
    students_total: int
    grades_total: int
    missing_total: int
    note: str | None = None
    created_at: datetime
    validated_at: datetime | None = None
