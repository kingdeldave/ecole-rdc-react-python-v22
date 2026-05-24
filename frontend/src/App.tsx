import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './providers/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { StudentsPage } from './pages/StudentsPage'
import { GradesPage } from './pages/GradesPage'
import { ReportCardsPage } from './pages/ReportCardsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { CoursesPage } from './pages/CoursesPage'
import { DisciplinePage } from './pages/DisciplinePage'
import { VerificationPage } from './pages/VerificationPage'
import { StudentCardPage } from './pages/StudentCardPage'
import { UsersPage } from './pages/UsersPage'
import { ProfilePage } from './pages/ProfilePage'
import { TeachersSchedulePage } from './pages/TeachersSchedulePage'
import { SchoolYearsPage } from './pages/SchoolYearsPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { GradeExcelImportPage } from './pages/GradeExcelImportPage'
import { EnrollmentsPage } from './pages/EnrollmentsPage'
import { AttendancePage } from './pages/AttendancePage'
import { SchedulesPage } from './pages/SchedulesPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { BackupsPage } from './pages/BackupsPage'
import { LibraryPage } from './pages/LibraryPage'
import { ClassesOptionsPage } from './pages/ClassesOptionsPage'
import { TitularClassesPage } from './pages/TitularClassesPage'
import { ExamsPage } from './pages/ExamsPage'
import { JuryPointsPage } from './pages/JuryPointsPage'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-600">Chargement...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify/bulletin/:cardId" element={<VerificationPage />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="classes-options" element={<ClassesOptionsPage />} />
        <Route path="titular-classes" element={<TitularClassesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="student-card" element={<StudentCardPage />} />
        <Route path="grades" element={<GradesPage />} />
        <Route path="report-cards" element={<ReportCardsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="teachers" element={<TeachersSchedulePage />} />
        <Route path="discipline" element={<DisciplinePage />} />
        <Route path="school-years" element={<SchoolYearsPage />} />
        <Route path="grade-import" element={<GradeExcelImportPage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="jury-points" element={<JuryPointsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="backups" element={<BackupsPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>
    </Routes>
  )
}
