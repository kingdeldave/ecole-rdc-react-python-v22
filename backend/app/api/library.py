from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import ensure_same_school, get_current_user, request_meta
from app.models import AuditAction, LibraryBook, LibraryLoan, RoleCode, Student, UserProfile
from app.schemas import LibraryBookCreate, LibraryBookOut, LibraryLoanCreate, LibraryLoanOut
from app.services.audit import log_action

router = APIRouter(prefix="/library", tags=["library"])
LIBRARY_ROLES = {RoleCode.SUPER_ADMIN, RoleCode.ADMIN_ECOLE, RoleCode.PREFET, RoleCode.DIRECTEUR}


def _loan_out(row: LibraryLoan) -> LibraryLoanOut:
    return LibraryLoanOut(id=row.id, book_id=row.book_id, book_title=row.book.title, student_id=row.student_id, student_name=row.student.full_name, matricule=row.student.matricule, loan_date=row.loan_date, due_date=row.due_date, status=row.status, returned_at=row.returned_at)


@router.get("/books", response_model=list[LibraryBookOut])
def list_books(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(LibraryBook)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(LibraryBook.school_id == user.school_id)
    return q.order_by(LibraryBook.title.asc()).all()


@router.post("/books", response_model=LibraryBookOut)
def create_book(payload: LibraryBookCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in LIBRARY_ROLES:
        raise HTTPException(status_code=403, detail="Gestion bibliothèque non autorisée.")
    if not user.school_id and user.role != RoleCode.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="École introuvable.")
    school_id = user.school_id
    if user.role == RoleCode.SUPER_ADMIN:
        # Démo mono-école : on prend l'école du premier élève ou profil si elle existe.
        first_student = db.query(Student).first()
        school_id = first_student.school_id if first_student else user.school_id
    if not school_id:
        raise HTTPException(status_code=400, detail="Impossible de déterminer l'école.")
    book = LibraryBook(school_id=school_id, title=payload.title, author=payload.author, category=payload.category, isbn=payload.isbn, total_copies=payload.total_copies, available_copies=payload.total_copies, location=payload.location, created_by_id=user.id)
    db.add(book)
    log_action(db, user=user, action=AuditAction.CREATE_LIBRARY_BOOK, entity_type="library_books", new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(book)
    return book


@router.get("/loans", response_model=list[LibraryLoanOut])
def list_loans(db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    q = db.query(LibraryLoan)
    if user.role != RoleCode.SUPER_ADMIN:
        q = q.filter(LibraryLoan.school_id == user.school_id)
    return [_loan_out(row) for row in q.order_by(LibraryLoan.created_at.desc()).limit(300).all()]


@router.post("/loans", response_model=LibraryLoanOut)
def create_loan(payload: LibraryLoanCreate, request: Request, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in LIBRARY_ROLES:
        raise HTTPException(status_code=403, detail="Gestion des prêts non autorisée.")
    book = db.get(LibraryBook, payload.book_id)
    student = db.get(Student, payload.student_id)
    if not book or not student:
        raise HTTPException(status_code=404, detail="Livre ou élève introuvable.")
    ensure_same_school(user, book.school_id)
    if book.school_id != student.school_id:
        raise HTTPException(status_code=400, detail="Livre et élève doivent appartenir à la même école.")
    if book.available_copies <= 0:
        raise HTTPException(status_code=409, detail="Aucun exemplaire disponible.")
    book.available_copies -= 1
    loan = LibraryLoan(school_id=book.school_id, book_id=book.id, student_id=student.id, due_date=payload.due_date, created_by_id=user.id)
    db.add(loan)
    log_action(db, user=user, action=AuditAction.CREATE_LIBRARY_LOAN, entity_type="library_loans", new_value=payload.model_dump(mode="json"), **request_meta(request))
    db.commit()
    db.refresh(loan)
    return _loan_out(loan)


@router.post("/loans/{loan_id}/return", response_model=LibraryLoanOut)
def return_loan(loan_id: str, db: Session = Depends(get_db), user: UserProfile = Depends(get_current_user)):
    if user.role not in LIBRARY_ROLES:
        raise HTTPException(status_code=403, detail="Retour non autorisé.")
    loan = db.get(LibraryLoan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Prêt introuvable.")
    ensure_same_school(user, loan.school_id)
    if not loan.returned_at:
        loan.returned_at = datetime.now(timezone.utc)
        loan.status = "returned"
        loan.book.available_copies += 1
    db.commit()
    db.refresh(loan)
    return _loan_out(loan)
