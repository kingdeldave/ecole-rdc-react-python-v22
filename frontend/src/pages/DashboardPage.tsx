import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileCheck,
  FileText,
  Gavel,
  GraduationCap,
  IdCard,
  Landmark,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { CourseResource, DashboardStats, DisciplinaryAction, NotificationItem, ReportCard, RoleCode, Student } from '../types'
import { StatCard } from '../components/StatCard'
import { useAuth } from '../providers/AuthProvider'
import { PhotoStrip, SchoolMiniature } from '../components/SchoolIdentity'

function roleTitle(role: RoleCode) {
  const titles: Record<RoleCode, string> = {
    ELEVE: 'Tableau de bord élève',
    PARENT: 'Tableau de bord parent',
    ENSEIGNANT: 'Espace professeur',
    DIRECTEUR: 'Directeur des études',
    PREFET: 'Préfet / Chef d’établissement',
    COMPTABLE: 'Intendance / Comptabilité',
    ADMIN_ECOLE: 'Secrétariat scolaire',
    SUPER_ADMIN: 'Super Admin technique',
  }
  return titles[role]
}

function formatDate(value?: string | null) {
  if (!value) return 'Non renseignée'
  return new Date(value).toLocaleDateString('fr-FR')
}

function statusLabel(status?: string) {
  if (!status) return 'Actif'
  const normalized = status.toLowerCase()
  if (normalized === 'actif') return 'Actif'
  if (normalized === 'suspendu') return 'Suspendu'
  if (normalized === 'renvoye' || normalized === 'renvoyé') return 'Renvoyé'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function StudentParentDashboard({
  mode,
  stats,
  students,
  courses,
  reports,
  discipline,
  notifications,
}: {
  mode: 'PARENT' | 'ELEVE'
  stats: DashboardStats
  students: Student[]
  courses: CourseResource[]
  reports: ReportCard[]
  discipline: DisciplinaryAction[]
  notifications: NotificationItem[]
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('')
  useEffect(() => {
    if (!selectedStudentId && students[0]) setSelectedStudentId(students[0].id)
    if (selectedStudentId && !students.some((s) => s.id === selectedStudentId)) setSelectedStudentId(students[0]?.id ?? '')
  }, [students, selectedStudentId])

  const student = students.find((s) => s.id === selectedStudentId) ?? students[0]
  const reportsForStudent = student ? reports.filter((r) => r.student_id === student.id) : reports
  const published = reports.filter((r) => r.status === 'PUBLISHED' && !r.payment_blocked)
  const blocked = reports.filter((r) => r.payment_blocked)
  const latestReport = reportsForStudent[0] ?? reports[0]
  const firstName = student?.full_name?.split(' ')[0] ?? (mode === 'PARENT' ? 'Parent' : 'Élève')

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="app-surface overflow-hidden rounded-[1.8rem] p-5 md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="app-kicker">{mode === 'PARENT' ? 'Espace parent' : 'Espace élève'}</p>
              <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Bonjour {firstName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                {mode === 'PARENT'
                  ? 'Suivez les bulletins, les paiements, les cours en ligne, les notifications et la discipline de vos enfants depuis un espace clair.'
                  : 'Accédez à votre carte d’élève, vos cours, vos notifications et vos bulletins publiés par l’école.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/student-card" className="rounded-2xl bg-[#0b2a5b] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800">Voir la carte d’élève</Link>
                <Link to="/report-cards" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Consulter les bulletins</Link>
              </div>
            </div>
            <div className="hidden w-[330px] lg:block"><SchoolMiniature /></div>
          </div>
        </div>
        <PhotoStrip />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title={mode === 'PARENT' ? 'Enfants liés' : 'Profil élève'} value={mode === 'PARENT' ? stats.my_children : 1} icon={Users} />
        <StatCard title="Bulletins disponibles" value={published.length} icon={FileCheck} tone="emerald" />
        <StatCard title="Bulletins bloqués" value={blocked.length} icon={LockKeyhole} tone={blocked.length ? 'red' : 'slate'} />
        <StatCard title="Cours en ligne" value={courses.length} icon={BookOpen} tone="blue" />
      </div>

      {mode === 'PARENT' && students.length > 1 && (
        <section className="app-card rounded-[1.8rem] p-6">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="app-kicker">Suivi multi-enfants</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Enfants liés au compte parent</h2>
              <p className="mt-1 text-sm text-slate-500">Le parent peut suivre plusieurs élèves depuis le même espace.</p>
            </div>
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500">
              {students.map((child) => <option key={child.id} value={child.id}>{child.full_name} — {child.class_name}</option>)}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {students.map((child) => (
              <button key={child.id} onClick={() => setSelectedStudentId(child.id)} className={`rounded-2xl border p-4 text-left transition ${child.id === student?.id ? 'border-blue-200 bg-blue-50 ring-4 ring-blue-100' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{child.matricule}</p>
                <p className="mt-1 font-black text-slate-950">{child.full_name}</p>
                <p className="mt-1 text-sm text-slate-500">{child.class_name}</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${child.payment_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{child.payment_blocked ? 'Résultats bloqués' : 'Résultats accessibles'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="app-card rounded-[1.8rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="app-kicker">Identité scolaire</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{student?.full_name ?? 'Aucun élève lié'}</h2>
              <p className="mt-1 text-sm text-slate-500">Informations principales du dossier scolaire.</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><IdCard size={24} /></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoPill label="Classe" value={student?.class_name ?? 'Non affecté'} />
            <InfoPill label="Matricule" value={student?.matricule ?? '—'} />
            <InfoPill label="Statut" value={statusLabel(student?.status)} />
            <InfoPill label="Naissance" value={formatDate(student?.birth_date)} />
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            Le parent ou l’élève ne voit que les données autorisées par son rôle.
          </div>
        </section>

        <section className="app-card rounded-[1.8rem] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="app-kicker">Bulletin officiel</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Résultat scolaire vérifiable</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">Le bulletin publié devient un document verrouillé. Le QR code renvoie vers la page de vérification pour réduire les risques de faux bulletins.</p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 text-white"><QrCode size={25} /></div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
            {latestReport ? (
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">Version {latestReport.version}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${latestReport.payment_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{latestReport.payment_blocked ? 'Bloqué paiement' : 'Accessible'}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-slate-950">{latestReport.student_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">Pourcentage : <b>{latestReport.percentage.toFixed(1)}%</b> · Place : <b>{latestReport.rank ?? '—'}</b> · Décision : <b>{latestReport.decision ?? 'En attente'}</b></p>
                </div>
                <Link to="/report-cards" className="inline-flex justify-center rounded-2xl bg-[#0b2a5b] px-4 py-3 text-sm font-black text-white hover:bg-blue-800">Ouvrir</Link>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500">Aucun bulletin publié pour le moment.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="app-card rounded-[1.8rem] p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="app-kicker">Ressources</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Derniers cours en ligne</h2>
            </div>
            <Link to="/courses" className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">Tout voir</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {courses.slice(0, 4).map((course) => (
              <article key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{course.subject_name}</p>
                <h3 className="mt-2 font-black text-slate-950">{course.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{course.class_name}</p>
              </article>
            ))}
            {courses.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucun cours publié pour le moment.</p>}
          </div>
        </section>

        <section className="app-card rounded-[1.8rem] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><Bell size={21} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Notifications récentes</h2>
              <p className="text-sm text-slate-500">Messages et alertes de l’école.</p>
            </div>
          </div>
          <div className="space-y-3">
            {discipline[0] && <NotificationLine icon={Gavel} title="Discipline" text={`${discipline[0].student_name} — ${discipline[0].reason}`} tone="amber" />}
            {notifications.slice(0, 4).map((item) => <NotificationLine key={item.id} icon={Bell} title={item.title} text={item.message} tone={item.is_read ? 'slate' : 'blue'} />)}
            {notifications.length === 0 && !discipline[0] && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucune notification pour le moment.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function StaffDashboard({ role, stats, courses, discipline, notifications }: { role: RoleCode; stats: DashboardStats; courses: CourseResource[]; discipline: DisciplinaryAction[]; notifications: NotificationItem[] }) {
  const direction = role === 'DIRECTEUR' || role === 'PREFET'
  const teacher = role === 'ENSEIGNANT'

  const cards = useMemo(() => {
    if (role === 'ENSEIGNANT') {
      return [
        { title: 'Mes cours', value: stats.my_courses, icon: BookOpen, tone: 'blue' as const },
        { title: 'Points verrouillés', value: stats.locked_grades, icon: LockKeyhole, tone: 'slate' as const },
        { title: 'Ressources publiées', value: stats.course_resources, icon: FileText, tone: 'emerald' as const },
        { title: 'Notifications', value: stats.unread_notifications, icon: Bell, tone: 'amber' as const },
      ]
    }
    if (role === 'COMPTABLE') {
      return [
        { title: 'Paiements reçus', value: `${stats.payments_total.toLocaleString()} $`, icon: CreditCard, tone: 'emerald' as const },
        { title: 'Élèves non en ordre', value: stats.unpaid_students, icon: AlertTriangle, tone: 'red' as const },
        { title: 'Bulletins bloqués', value: stats.blocked_report_cards, icon: LockKeyhole, tone: 'red' as const },
        { title: 'Bulletins publiés', value: stats.published_report_cards, icon: FileCheck, tone: 'blue' as const },
      ]
    }
    return [
      { title: 'Élèves', value: stats.students, icon: Users, tone: 'blue' as const },
      { title: 'Classes', value: stats.classes, icon: GraduationCap, tone: 'slate' as const },
      { title: 'Professeurs', value: stats.teachers, icon: Users, tone: 'emerald' as const },
      { title: 'Bulletins publiés', value: stats.published_report_cards, icon: ShieldCheck, tone: 'emerald' as const },
      { title: 'Bulletins bloqués', value: stats.blocked_report_cards, icon: LockKeyhole, tone: stats.blocked_report_cards ? 'red' as const : 'slate' as const },
      { title: 'Sanctions', value: stats.disciplinary_actions, icon: Gavel, tone: stats.disciplinary_actions ? 'amber' as const : 'slate' as const },
      { title: 'Paiements', value: `${stats.payments_total.toLocaleString()} $`, icon: Landmark, tone: 'emerald' as const },
      { title: 'Notifications', value: stats.unread_notifications, icon: Bell, tone: 'blue' as const },
    ]
  }, [role, stats])

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-surface rounded-[1.8rem] p-6 md:p-7">
          <p className="app-kicker">Lycée Technique & Professionnel de Matonge</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{roleTitle(role)}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
            {teacher && 'Publiez les cours, encodez les points et envoyez-les officiellement. Une note envoyée est verrouillée et ne peut plus être modifiée par le professeur.'}
            {direction && 'Validez les bulletins, contrôlez les corrections officielles, gérez la discipline et suivez les blocages liés aux paiements.'}
            {role === 'COMPTABLE' && 'Suivez les paiements, identifiez les élèves non en ordre et bloquez ou débloquez l’accès aux bulletins selon les règles de l’école.'}
            {!teacher && !direction && role !== 'COMPTABLE' && 'Pilotez l’établissement avec un tableau de bord clair : élèves, classes, professeurs, bulletins, paiements et notifications.'}
          </p>
        </div>
        <PhotoStrip />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} tone={card.tone} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="app-card rounded-[1.8rem] p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">{teacher ? <ClipboardCheck /> : <ShieldCheck />}</div>
            <div>
              <h2 className="text-xl font-black text-slate-950">{teacher ? 'Processus professeur' : 'Chaîne officielle du bulletin'}</h2>
              <p className="text-sm text-slate-500">Une procédure claire pour éviter les manipulations et les faux documents.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <WorkflowStep index="01" title={teacher ? 'Saisir' : 'Contrôler'} text={teacher ? 'Le professeur encode les points par classe, branche et période.' : 'La direction vérifie les résultats, paiements et anomalies.'} />
            <WorkflowStep index="02" title={teacher ? 'Envoyer' : 'Valider'} text={teacher ? 'Après envoi, les notes sont verrouillées automatiquement.' : 'Le Préfet ou Directeur valide le bulletin officiel.'} />
            <WorkflowStep index="03" title={teacher ? 'Attendre correction' : 'Publier'} text={teacher ? 'Toute correction exige une autorisation de la direction.' : 'Le parent reçoit le document verrouillé et vérifiable.'} />
          </div>
        </section>

        <section className="rounded-[1.8rem] bg-[#0b2a5b] p-6 text-white shadow-lg shadow-blue-950/18">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3 text-blue-100"><QrCode /></div>
            <div>
              <h2 className="text-xl font-black">Protection anti-fraude</h2>
              <p className="text-sm text-blue-100/80">QR code, versioning et audit des actions sensibles.</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm leading-7 text-blue-50">
            Un bulletin publié conserve une copie figée des points, totaux, pourcentage, classement et décision. Une correction crée une nouvelle version avec motif obligatoire.
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="app-card rounded-[1.8rem] p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Activités récentes</h2>
              <p className="text-sm text-slate-500">Cours publiés, sanctions et notifications.</p>
            </div>
            <TrendingUp className="text-blue-700" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {courses.slice(0, 4).map((course) => (
              <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{course.subject_name}</p>
                <p className="mt-2 font-black text-slate-950">{course.title}</p>
                <p className="mt-1 text-sm text-slate-500">{course.class_name}</p>
              </div>
            ))}
            {courses.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucun cours publié.</p>}
          </div>
        </section>

        <section className="app-card rounded-[1.8rem] p-6">
          <div className="mb-4 flex items-center gap-3"><AlertTriangle className="text-amber-600" /><h2 className="text-xl font-black text-slate-950">Alertes</h2></div>
          <div className="space-y-3">
            {discipline[0] && <NotificationLine icon={Gavel} title="Discipline" text={`Dernière sanction : ${discipline[0].student_name}`} tone="amber" />}
            {notifications[0] && <NotificationLine icon={Bell} title={notifications[0].title} text={notifications[0].message} tone="blue" />}
            {!discipline[0] && !notifications[0] && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Aucune alerte critique.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<CourseResource[]>([])
  const [reports, setReports] = useState<ReportCard[]>([])
  const [discipline, setDiscipline] = useState<DisciplinaryAction[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.dashboard(),
      api.students().catch(() => []),
      api.courseResources().catch(() => []),
      api.reportCards().catch(() => []),
      api.disciplinaryActions().catch(() => []),
      api.notifications().catch(() => []),
    ])
      .then(([statsRows, studentRows, courseRows, reportRows, disciplineRows, notificationRows]) => {
        setStats(statsRows)
        setStudents(studentRows)
        setCourses(courseRows)
        setReports(reportRows)
        setDiscipline(disciplineRows)
        setNotifications(notificationRows)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>
  if (!stats || !user) return <div className="app-card rounded-2xl p-6 text-slate-500">Chargement du tableau de bord...</div>

  if (user.role === 'ELEVE' || user.role === 'PARENT') {
    return <StudentParentDashboard mode={user.role} stats={stats} students={students} courses={courses} reports={reports} discipline={discipline} notifications={notifications} />
  }

  return <StaffDashboard role={user.role} stats={stats} courses={courses} discipline={discipline} notifications={notifications} />
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  )
}

function WorkflowStep({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black text-blue-700">{index}</p>
      <h3 className="mt-2 font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  )
}

function NotificationLine({ icon: Icon, title, text, tone }: { icon: LucideIcon; title: string; text: string; tone: 'blue' | 'amber' | 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-50 text-slate-600',
  }
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></div>
      <div>
        <p className="font-black text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
      </div>
    </div>
  )
}
