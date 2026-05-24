from __future__ import annotations

from datetime import date
from random import randint

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    ClassRoom,
    ClassSubject,
    ClassTitular,
    AttendanceRecord,
    CourseResource,
    Enrollment,
    LibraryBook,
    LibraryLoan,
    ScheduleSlot,
    DisciplinaryAction,
    FeeStatus,
    Notification,
    Parent,
    ParentStudent,
    Period,
    PeriodCode,
    ReportStatus,
    RoleCode,
    School,
    SchoolOption,
    SchoolYear,
    Student,
    StudentFeeStatus,
    Subject,
    UserProfile,
)
from app.services.grades import upsert_grade
from app.services.report_cards import compute_class_ranks, publish_report_card, upsert_report_card, validate_report_card

PASSWORD = "Password123!"


def create_user(db, *, email: str, full_name: str, role: RoleCode, school_id=None, phone: str | None = None):
    user = UserProfile(
        email=email.lower(),
        hashed_password=hash_password(PASSWORD),
        full_name=full_name,
        phone=phone,
        role=role,
        school_id=school_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def run():
    """Réinitialise la base de développement et insère une école réaliste multi-utilisateurs."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        school = School(
            name="Lycée Technique & Professionnel de Matonge",
            code="LTPM",
            address="Matonge, Kinshasa",
            city="Kinshasa",
            commune="Kalamu",
            province="Kinshasa",
            email="contact@ltpm.cd",
            phone="+243000000000",
            status="active",
        )
        db.add(school)
        db.flush()

        year_2024 = SchoolYear(school_id=school.id, label="2024-2025", is_active=False, is_closed=True, is_archived=True)
        year = SchoolYear(school_id=school.id, label="2025-2026", is_active=True, is_closed=False, is_archived=False)
        year_2026 = SchoolYear(school_id=school.id, label="2026-2027", is_active=False, is_closed=False, is_archived=False)
        db.add_all([year_2024, year, year_2026])
        db.flush()

        # Direction, administration et comptes de démonstration.
        create_user(db, email="superadmin@plateforme.cd", full_name="Super Admin Plateforme", role=RoleCode.SUPER_ADMIN)
        admin = create_user(db, email="admin@matonge.cd", full_name="Admin École Matonge", role=RoleCode.ADMIN_ECOLE, school_id=school.id, phone="+243810100001")
        admin2 = create_user(db, email="admin2@matonge.cd", full_name="Admin Scolarité", role=RoleCode.ADMIN_ECOLE, school_id=school.id)
        prefet = create_user(db, email="prefet@matonge.cd", full_name="Préfet des études", role=RoleCode.PREFET, school_id=school.id, phone="+243810100003")
        prefet2 = create_user(db, email="prefet2@matonge.cd", full_name="Préfet Adjoint", role=RoleCode.PREFET, school_id=school.id)
        directeur = create_user(db, email="directeur@matonge.cd", full_name="Directeur", role=RoleCode.DIRECTEUR, school_id=school.id, phone="+243810100005")
        directeur2 = create_user(db, email="directeur2@matonge.cd", full_name="Directrice Adjointe", role=RoleCode.DIRECTEUR, school_id=school.id)
        comptable = create_user(db, email="comptable@matonge.cd", full_name="Comptable Finance", role=RoleCode.COMPTABLE, school_id=school.id, phone="+243810100007")
        create_user(db, email="comptable2@matonge.cd", full_name="Assistant Comptable", role=RoleCode.COMPTABLE, school_id=school.id)

        # Plusieurs professeurs : chaque cours est rattaché à un professeur précis.
        teacher_general = create_user(db, email="enseignant@matonge.cd", full_name="Professeur Titulaire", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000001")
        teacher_math = create_user(db, email="prof.math@matonge.cd", full_name="Professeur Mathématiques", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000002")
        teacher_fr = create_user(db, email="prof.francais@matonge.cd", full_name="Professeur Français", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000003")
        teacher_info = create_user(db, email="prof.info@matonge.cd", full_name="Professeur Informatique", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000004")
        teacher_svt = create_user(db, email="prof.svt@matonge.cd", full_name="Professeur SVT / Chimie", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000005")
        teacher_history = create_user(db, email="prof.histoire@matonge.cd", full_name="Professeur Histoire-Géographie", role=RoleCode.ENSEIGNANT, school_id=school.id, phone="+243820000006")

        # Parents et élèves avec comptes distincts.
        parent_users = [
            create_user(db, email="parent@matonge.cd", full_name="Parent Démo", role=RoleCode.PARENT, school_id=school.id),
            create_user(db, email="parent2@matonge.cd", full_name="Parent Mukendi", role=RoleCode.PARENT, school_id=school.id),
            create_user(db, email="parent3@matonge.cd", full_name="Parent Kalonji", role=RoleCode.PARENT, school_id=school.id),
            create_user(db, email="parent4@matonge.cd", full_name="Parent Mbuyi", role=RoleCode.PARENT, school_id=school.id),
        ]
        for i, parent_user in enumerate(parent_users, start=1):
            parent_user.phone = f"+24383000000{i}"

        student_users = [
            create_user(db, email=f"eleve{i}@matonge.cd", full_name=f"Élève Démo {i}", role=RoleCode.ELEVE, school_id=school.id)
            for i in range(1, 9)
        ]
        # Compatibilité avec l'ancien compte de test.
        student_users.insert(0, create_user(db, email="eleve@matonge.cd", full_name="Élève Démo", role=RoleCode.ELEVE, school_id=school.id))

        option_names = ["Scientifique", "Littéraire", "Nutrition", "Pédagogie Générale", "Commerciale", "Technique", "Informatique"]
        for option_name in option_names:
            db.add(SchoolOption(school_id=school.id, name=option_name, description=f"Option {option_name}"))
        db.flush()

        class_definitions = [
            {"name": "1CO", "level": "7ème", "section": "Cycle d’orientation", "option": None, "cycle": "Secondaire de base", "room": "Salle 1", "option_required": False},
            {"name": "2sec", "level": "8ème", "section": "Secondaire", "option": None, "cycle": "Secondaire de base", "room": "Salle 2", "option_required": False},
            {"name": "3e H", "level": "1ère Humanité", "section": "Humanités", "option": "Scientifique", "cycle": "Humanités", "room": "Salle 3A", "option_required": True},
            {"name": "3e H", "level": "1ère Humanité", "section": "Humanités", "option": "Littéraire", "cycle": "Humanités", "room": "Salle 3B", "option_required": True},
            {"name": "4e H", "level": "2ème Humanité", "section": "Humanités", "option": "Scientifique", "cycle": "Humanités", "room": "Salle 4A", "option_required": True},
            {"name": "4e H", "level": "2ème Humanité", "section": "Humanités", "option": "Nutrition", "cycle": "Humanités", "room": "Salle 4B", "option_required": True},
            {"name": "5e H", "level": "3ème Humanité", "section": "Humanités", "option": "Pédagogie Générale", "cycle": "Humanités", "room": "Salle 5A", "option_required": True},
            {"name": "6e H", "level": "4ème Humanité", "section": "Humanités", "option": "Pédagogie Générale", "cycle": "Humanités", "room": "Salle 6A", "option_required": True},
        ]
        classrooms: list[ClassRoom] = []
        for item in class_definitions:
            classroom = ClassRoom(
                school_id=school.id,
                school_year_id=year.id,
                name=item["name"],
                level=item["level"],
                section=item["section"],
                option=item["option"],
                cycle=item["cycle"],
                room=item["room"],
                option_required=item["option_required"],
                titulaire_id=teacher_general.id,
            )
            db.add(classroom)
            db.flush()
            # Plusieurs professeurs titulaires possibles par classe.
            main_titular = teacher_general if classroom.name in {"1CO", "2sec"} else teacher_math
            db.add(ClassTitular(school_id=school.id, class_id=classroom.id, teacher_id=main_titular.id, school_year_id=year.id))
            if classroom.option in {"Scientifique", "Nutrition"}:
                db.add(ClassTitular(school_id=school.id, class_id=classroom.id, teacher_id=teacher_svt.id, school_year_id=year.id))
            classrooms.append(classroom)

        default_periods = [
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
        for school_year in [year_2024, year, year_2026]:
            for code, label in default_periods:
                closed = bool(school_year.is_closed or school_year.is_archived)
                db.add(Period(school_id=school.id, school_year_id=school_year.id, code=code, label=label, is_open=not closed, is_closed=closed))

        subject_names = [
            "Religion",
            "Education à la vie",
            "Education civique et morale",
            "Chimie",
            "SVT",
            "Dessin",
            "Education physique",
            "Economie politique",
            "Géographie",
            "Histoire",
            "Informatique",
            "Langues nationales",
            "Mathématiques",
            "Pédagogie",
            "Psychologie",
            "Anglais",
            "Français",
        ]
        subjects: list[Subject] = []
        for i, name in enumerate(subject_names, start=1):
            subject = Subject(school_id=school.id, name=name, category="Général", display_order=i)
            db.add(subject)
            db.flush()
            subjects.append(subject)

        def teacher_for_subject(subject_name: str) -> UserProfile:
            if subject_name == "Mathématiques":
                return teacher_math
            if subject_name == "Français" or subject_name == "Anglais":
                return teacher_fr
            if subject_name == "Informatique":
                return teacher_info
            if subject_name in {"SVT", "Chimie"}:
                return teacher_svt
            if subject_name in {"Histoire", "Géographie"}:
                return teacher_history
            return teacher_general

        class_subjects: list[ClassSubject] = []
        for classroom in classrooms:
            for i, subject in enumerate(subjects, start=1):
                low = subject.name in {"Religion", "Education à la vie", "Education civique et morale", "Dessin", "Education physique", "Langues nationales", "Economie politique"}
                medium = subject.name in {"SVT", "Chimie", "Informatique", "Histoire", "Géographie"}
                high = subject.name in {"Mathématiques", "Pédagogie", "Psychologie"}
                language = subject.name in {"Français", "Anglais"}
                if language:
                    p_max, ex_max = 50, 100
                elif high:
                    p_max, ex_max = 40, 80
                elif medium:
                    p_max, ex_max = 20, 40
                else:
                    p_max, ex_max = 10, 20
                cs = ClassSubject(
                    school_id=school.id,
                    class_id=classroom.id,
                    subject_id=subject.id,
                    teacher_id=teacher_for_subject(subject.name).id,
                    max_p1=p_max,
                    max_p2=p_max,
                    max_ex1=ex_max,
                    max_p3=p_max,
                    max_p4=p_max,
                    max_ex2=ex_max,
                    max_rattrapage=20,
                    max_tenasop=40,
                    max_bac=40,
                    display_order=i,
                    schedule_label=f"{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'][i % 5]} {7 + (i % 6):02d}h00-{8 + (i % 6):02d}h00",
                )
                db.add(cs)
                db.flush()
                class_subjects.append(cs)

        sample_names = [
            ("PAULO", "TLAGO", "", "M"),
            ("BILONDA", "LUKUSA", "", "F"),
            ("BENGA", "KAMALANDUA", "", "F"),
            ("KALABA", "KAMBA", "Chadrack", "M"),
            ("BOFIO", "NGONGE", "", "M"),
            ("LIAKI", "MOSEKA", "", "F"),
            ("KABAMBA", "MBUYI", "Sarah", "F"),
            ("MUTOMBO", "KAZADI", "David", "M"),
            ("TSHIMANGA", "ILUNGA", "Grâce", "F"),
            ("KALONJI", "KABONGO", "Jean", "M"),
            ("MUKENDI", "KASONGO", "Esther", "F"),
            ("MABIALA", "NZUZI", "Joël", "M"),
            ("KAPINGA", "ILUNGA", "Prisca", "F"),
            ("NTUMBA", "MAVINGA", "Samuel", "M"),
            ("LUZOLO", "NGOMA", "Bénédicte", "F"),
            ("TSHILOMBO", "KALALA", "Moïse", "M"),
        ]

        students: list[Student] = []
        global_index = 1
        for classroom in classrooms:
            for _ in range(4):
                last, middle, first, sex = sample_names[(global_index - 1) % len(sample_names)]
                profile = student_users[global_index - 1] if global_index - 1 < len(student_users) else None
                student = Student(
                    school_id=school.id,
                    profile_id=profile.id if profile else None,
                    class_id=classroom.id,
                    matricule=f"LTPM-{global_index:04d}",
                    last_name=last,
                    middle_name=middle,
                    first_name=first,
                    sex=sex,
                    birth_date=date(2010, min((global_index % 12) + 1, 12), min(global_index + 1, 28)),
                    birth_place="Kinshasa",
                    address="Matonge, Kinshasa",
                    status="actif",
                    photo_path=f"/avatars/{'f' if sex == 'F' else 'm'}-student.svg",
                )
                db.add(student)
                db.flush()
                students.append(student)
                global_index += 1

        parents = [
            Parent(school_id=school.id, profile_id=parent_users[0].id, full_name="Parent Démo", phone="+243810000000", email="parent@matonge.cd"),
            Parent(school_id=school.id, profile_id=parent_users[1].id, full_name="Parent Mukendi", phone="+243810000001", email="parent2@matonge.cd"),
            Parent(school_id=school.id, profile_id=parent_users[2].id, full_name="Parent Kalonji", phone="+243810000002", email="parent3@matonge.cd"),
            Parent(school_id=school.id, profile_id=parent_users[3].id, full_name="Parent Mbuyi", phone="+243810000003", email="parent4@matonge.cd"),
        ]
        for parent in parents:
            db.add(parent)
            db.flush()
        # Parent 1 a 4 enfants ; autres parents ont aussi plusieurs enfants.
        links = {
            0: students[:4],
            1: students[4:8],
            2: students[8:12],
            3: students[12:16],
        }
        for parent_index, children in links.items():
            for child in children:
                db.add(ParentStudent(parent_id=parents[parent_index].id, student_id=child.id, relationship_type="tuteur"))

        # Ressources de cours : seulement visibles au professeur assigné et à la classe liée.
        db.add(CourseResource(
            school_id=school.id,
            class_subject_id=class_subjects[0].id,
            title="Introduction au cours : Religion",
            description="Cours de démonstration visible par les parents et les élèves.",
            resource_type="lesson",
            content="Objectifs : comprendre les notions de base, lire la fiche et préparer les questions pour la prochaine séance.",
            is_published=True,
            created_by_id=teacher_general.id,
        ))
        math_cs = next(cs for cs in class_subjects if cs.subject.name == "Mathématiques")
        db.add(CourseResource(
            school_id=school.id,
            class_subject_id=math_cs.id,
            title="Exercices de mathématiques",
            description="Série d’exercices pour consolider la première période.",
            resource_type="exercise",
            content="Résoudre les exercices 1 à 10 et préparer les questions pour le prochain cours.",
            is_published=True,
            created_by_id=teacher_math.id,
        ))

        db.add(DisciplinaryAction(
            school_id=school.id,
            student_id=students[0].id,
            action_type="avertissement",
            reason="Retard répété en classe",
            created_by_id=prefet.id,
        ))

        for user in parent_users + student_users[:4]:
            db.add(Notification(school_id=school.id, recipient_id=user.id, type="INFO", title="Bienvenue sur le portail", message="Votre compte de démonstration est prêt.", action_url="/"))
        for direction_user in [admin, admin2, prefet, prefet2, directeur, directeur2]:
            db.add(Notification(school_id=school.id, recipient_id=direction_user.id, type="ACCES", title="Gestion des identifiants activée", message="La direction et l'administration peuvent gérer les comptes utilisateurs depuis l'interface.", action_url="/users"))

        for index, student in enumerate(students):
            total_due = 300.0
            paid = 100.0 if index in {1, 3, 9, 12} else 300.0
            db.add(StudentFeeStatus(
                school_id=school.id,
                student_id=student.id,
                school_year_id=year.id,
                total_due=total_due,
                total_paid=paid,
                status=FeeStatus.EN_ORDRE if paid >= total_due else FeeStatus.PARTIEL,
            ))
            db.add(Enrollment(
                school_id=school.id,
                student_id=student.id,
                school_year_id=year.id,
                class_id=student.class_id,
                enrollment_type="inscription" if index < 6 else "reinscription",
                status="actif",
                decision="admis",
                notes="Dossier initialisé automatiquement",
                created_by_id=admin.id,
            ))

        # Horaire complet : quelques créneaux réels, avec détection des conflits côté API.
        for cs in class_subjects[:18]:
            day = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"][cs.display_order % 5]
            start_hour = 7 + (cs.display_order % 6)
            db.add(ScheduleSlot(
                school_id=school.id,
                class_subject_id=cs.id,
                class_id=cs.class_id,
                teacher_id=cs.teacher_id,
                day_of_week=day,
                start_time=f"{start_hour:02d}:00",
                end_time=f"{start_hour + 1:02d}:00",
                room=cs.classroom.room or f"Salle {cs.classroom.name}",
                created_by_id=directeur.id,
            ))

        # Présences de démonstration.
        for student in students[:8]:
            db.add(AttendanceRecord(
                school_id=school.id,
                student_id=student.id,
                class_id=student.class_id,
                attendance_date=date.today(),
                status="present",
                period_label="Journée",
                recorded_by_id=admin.id,
            ))

        # Bibliothèque de démonstration.
        book1 = LibraryBook(school_id=school.id, title="Manuel de mathématiques", author="Collection scolaire", category="Sciences", total_copies=5, available_copies=4, location="Bibliothèque A", created_by_id=admin.id)
        book2 = LibraryBook(school_id=school.id, title="Lecture et expression française", author="Collection RDC", category="Langues", total_copies=3, available_copies=3, location="Rayon B", created_by_id=admin.id)
        db.add_all([book1, book2])
        db.flush()
        db.add(LibraryLoan(school_id=school.id, book_id=book1.id, student_id=students[0].id, due_date=date.today(), created_by_id=admin.id))

        class_subjects_by_class: dict[str, list[ClassSubject]] = {}
        for cs in class_subjects:
            class_subjects_by_class.setdefault(str(cs.class_id), []).append(cs)

        for student in students:
            for cs in class_subjects_by_class[str(student.class_id)]:
                entered_by = cs.teacher or teacher_general
                for code in [PeriodCode.P1, PeriodCode.P2, PeriodCode.EX1, PeriodCode.P3, PeriodCode.P4, PeriodCode.EX2]:
                    max_value = {
                        PeriodCode.P1: cs.max_p1,
                        PeriodCode.P2: cs.max_p2,
                        PeriodCode.EX1: cs.max_ex1,
                        PeriodCode.P3: cs.max_p3,
                        PeriodCode.P4: cs.max_p4,
                        PeriodCode.EX2: cs.max_ex2,
                    }[code]
                    value = randint(int(max_value * 0.45), int(max_value * 0.9))
                    upsert_grade(db, user=entered_by, student_id=student.id, class_subject=cs, period_code=code, value=float(value), reason="Données de démonstration")

        for classroom in classrooms:
            class_students = [s for s in students if s.class_id == classroom.id]
            for student in class_students:
                card = upsert_report_card(db, user=admin, student=student)
                if not card.payment_blocked:
                    validate_report_card(db, user=prefet, card=card)
                    publish_report_card(db, user=prefet, card=card)
                else:
                    card.status = ReportStatus.BLOCKED
            compute_class_ranks(db, classroom.id)

        db.commit()
        print("Base initialisée avec succès.")
        print("Classes créées : 1CO, 2sec, humanités avec options Scientifique, Littéraire, Nutrition et Pédagogie")
        print("Comptes professeurs : prof.math@matonge.cd, prof.francais@matonge.cd, prof.info@matonge.cd, prof.svt@matonge.cd")
        print("Compte parent lié à 4 enfants : parent@matonge.cd")
        print("Mot de passe commun :", PASSWORD)
    finally:
        db.close()


if __name__ == "__main__":
    run()
