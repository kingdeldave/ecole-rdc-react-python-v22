from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models import ClassRoom, ClassSubject, CourseResource, DisciplinaryAction, Grade, Notification, Parent, ParentStudent, Payment, ReportCard, ReportStatus, RoleCode, Student, StudentFeeStatus, FeeStatus, Subject, UserProfile
from app.schemas import DashboardOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    """Statistiques de base adaptées au rôle connecté."""
    school_filter = [] if user.role == RoleCode.SUPER_ADMIN else [Student.school_id == user.school_id]
    class_filter = [] if user.role == RoleCode.SUPER_ADMIN else [ClassRoom.school_id == user.school_id]
    subject_filter = [] if user.role == RoleCode.SUPER_ADMIN else [Subject.school_id == user.school_id]
    card_filter = [] if user.role == RoleCode.SUPER_ADMIN else [ReportCard.school_id == user.school_id]
    payment_filter = [] if user.role == RoleCode.SUPER_ADMIN else [Payment.school_id == user.school_id]

    my_children = 0
    if user.role == RoleCode.PARENT:
        parent = db.query(Parent).filter(Parent.profile_id == user.id).first()
        if parent:
            my_children = db.query(ParentStudent).filter(ParentStudent.parent_id == parent.id).count()

    my_courses = 0
    if user.role == RoleCode.ENSEIGNANT:
        my_courses = db.query(ClassSubject).filter(ClassSubject.teacher_id == user.id).count()

    payments_total = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(*payment_filter).scalar() or 0
    return DashboardOut(
        students=db.query(Student).filter(*school_filter).count(),
        classes=db.query(ClassRoom).filter(*class_filter).count(),
        subjects=db.query(Subject).filter(*subject_filter).count(),
        teachers=db.query(UserProfile).filter(UserProfile.role == RoleCode.ENSEIGNANT, *([] if user.role == RoleCode.SUPER_ADMIN else [UserProfile.school_id == user.school_id])).count(),
        report_cards=db.query(ReportCard).filter(*card_filter).count(),
        published_report_cards=db.query(ReportCard).filter(ReportCard.status == ReportStatus.PUBLISHED, *card_filter).count(),
        blocked_report_cards=db.query(ReportCard).filter(ReportCard.payment_blocked == True, *card_filter).count(),
        payments_total=float(payments_total),
        unread_notifications=db.query(Notification).filter(Notification.recipient_id == user.id, Notification.is_read == False).count(),
        role=user.role,
        my_children=my_children,
        my_courses=my_courses,
        locked_grades=db.query(Grade).filter(Grade.locked == True, *([] if user.role == RoleCode.SUPER_ADMIN else [Grade.school_id == user.school_id])).count(),
        unpaid_students=db.query(StudentFeeStatus).filter(StudentFeeStatus.status != FeeStatus.EN_ORDRE, *([] if user.role == RoleCode.SUPER_ADMIN else [StudentFeeStatus.school_id == user.school_id])).count(),
        disciplinary_actions=db.query(DisciplinaryAction).filter(*([] if user.role == RoleCode.SUPER_ADMIN else [DisciplinaryAction.school_id == user.school_id])).count(),
        course_resources=db.query(CourseResource).filter(*([] if user.role == RoleCode.SUPER_ADMIN else [CourseResource.school_id == user.school_id])).count(),
    )
