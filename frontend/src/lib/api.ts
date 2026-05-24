import type { ClassRoom, ClassSubject, DashboardStats, Grade, NotificationItem, PeriodCode, ReportCard, Student, User, AuditLog, CourseResource,
  TeacherSchedule, DisciplinaryAction, ReportVerification, UserAdmin, RoleCode, ParentChildrenLink, SchoolYear, EnrollmentItem, AttendanceItem, ScheduleSlot, AdministrativeDocument, BackupSnapshot, LibraryBook, LibraryLoan, SchoolOption, ExamSchedule, GradeSubmissionCourse, GradeSubmission } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem('ecole_rdc_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ecole_rdc_token', token)
  else localStorage.removeItem('ecole_rdc_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let message = `Erreur API ${response.status}`
    try {
      const data = await response.json()
      message = data.detail ?? message
    } catch {
      // La réponse n'est pas JSON.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function formRequest<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData })
  if (!response.ok) {
    let message = `Erreur API ${response.status}`
    try {
      const data = await response.json()
      message = data.detail ?? message
    } catch {
      // La réponse n'est pas JSON.
    }
    throw new ApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

export const api = {
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  },
  async me(): Promise<User> {
    return request('/auth/me')
  },
  async updateMyPhoto(photoPath: string | null): Promise<User> {
    return request('/auth/me/photo', { method: 'PATCH', body: JSON.stringify({ photo_path: photoPath }) })
  },
  async updateMyProfile(payload: Partial<{ full_name: string; phone: string; photo_path: string | null }>): Promise<User> {
    return request('/auth/me/profile', { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async dashboard(): Promise<DashboardStats> {
    return request('/dashboard')
  },
  async users(): Promise<UserAdmin[]> {
    return request('/users')
  },
  async createUser(payload: { email: string; full_name: string; phone?: string; role: RoleCode; password?: string; is_active?: boolean }): Promise<UserAdmin> {
    return request('/users', { method: 'POST', body: JSON.stringify(payload) })
  },
  async updateUser(userId: string, payload: Partial<{ full_name: string; phone: string; role: RoleCode; is_active: boolean; password: string; photo_path: string | null }>): Promise<UserAdmin> {
    return request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async parentChildrenLinks(): Promise<ParentChildrenLink[]> {
    return request('/users/parents/children')
  },
  async linkParentChildren(payload: { parent_profile_id: string; student_ids: string[]; relationship_type?: string }): Promise<ParentChildrenLink> {
    return request('/users/parents/link', { method: 'POST', body: JSON.stringify(payload) })
  },
  async classes(): Promise<ClassRoom[]> {
    return request('/classes')
  },
  async createClass(payload: { name: string; level?: string; section?: string; option?: string | null; cycle?: string; room?: string; option_required?: boolean; school_year_id?: string }): Promise<ClassRoom> {
    return request('/classes', { method: 'POST', body: JSON.stringify(payload) })
  },
  async updateClass(classId: string, payload: Partial<{ name: string; level: string; section: string; option: string | null; cycle: string; room: string; option_required: boolean; is_archived: boolean }>): Promise<ClassRoom> {
    return request(`/classes/${classId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async schoolOptions(): Promise<SchoolOption[]> {
    return request('/classes/options')
  },
  async createSchoolOption(payload: { name: string; description?: string }): Promise<SchoolOption> {
    return request('/classes/options', { method: 'POST', body: JSON.stringify(payload) })
  },
  async addClassTitular(classId: string, teacherId: string): Promise<ClassRoom> {
    return request(`/classes/${classId}/titulars`, { method: 'POST', body: JSON.stringify({ teacher_id: teacherId }) })
  },
  async removeClassTitular(classId: string, teacherId: string): Promise<ClassRoom> {
    return request(`/classes/${classId}/titulars/${teacherId}`, { method: 'DELETE' })
  },
  async myTitularClasses(): Promise<ClassRoom[]> {
    return request('/classes/my-titulars')
  },
  async students(classId?: string): Promise<Student[]> {
    const query = classId ? `?class_id=${classId}` : ''
    return request(`/students${query}`)
  },
  async createStudent(payload: { class_id: string; matricule: string; last_name: string; middle_name?: string; first_name?: string; sex: 'M' | 'F'; birth_date?: string; birth_place?: string; address?: string; observations?: string }): Promise<Student> {
    return request('/students', { method: 'POST', body: JSON.stringify(payload) })
  },
  async updateStudent(studentId: string, payload: Partial<{ class_id: string; matricule: string; last_name: string; middle_name: string; first_name: string; sex: 'M' | 'F'; birth_date: string; birth_place: string; address: string; status: string; observations: string; photo_path: string | null }>): Promise<Student> {
    return request(`/students/${studentId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async deleteStudent(studentId: string): Promise<void> {
    return request(`/students/${studentId}`, { method: 'DELETE' })
  },
  async bulkCreateStudents(payload: { class_id: string; rows: Array<{ matricule: string; last_name: string; middle_name?: string; first_name?: string; sex: 'M' | 'F'; birth_date?: string; birth_place?: string; address?: string; observations?: string }> }): Promise<{ message: string; created: number; skipped: number; errors: string[] }> {
    return request('/students/bulk', { method: 'POST', body: JSON.stringify(payload) })
  },
  async importStudentsExcel(classId: string, file: File): Promise<{ message: string; created: number; skipped: number; errors: string[] }> {
    const form = new FormData()
    form.append('file', file)
    return formRequest(`/excel/students/import?class_id=${encodeURIComponent(classId)}`, form)
  },
  async updateFeeStatus(payload: { student_id: string; school_year_id?: string; total_due: number; total_paid: number; bulletin_access_override?: boolean }): Promise<{ message: string; status: string; payment_blocked: boolean }> {
    return request('/payments/status', { method: 'POST', body: JSON.stringify(payload) })
  },
  async classSubjects(classId: string): Promise<ClassSubject[]> {
    return request(`/subjects/class/${classId}`)
  },
  async classSubjectProgram(): Promise<ClassSubject[]> {
    return request('/subjects/program')
  },
  async teacherSchedule(): Promise<TeacherSchedule[]> {
    return request('/subjects/teachers-schedule')
  },
  async createClassSubject(payload: { class_id: string; subject_name: string; category?: string; teacher_id?: string; schedule_label?: string; max_p1: number; max_p2: number; max_ex1: number; max_p3: number; max_p4: number; max_ex2: number; max_rattrapage: number; max_tenasop: number; max_bac: number; display_order?: number }): Promise<ClassSubject> {
    return request('/subjects/class-subjects', { method: 'POST', body: JSON.stringify(payload) })
  },
  async updateClassSubjectMaxima(classSubjectId: string, payload: { max_p1: number; max_p2: number; max_ex1: number; max_p3: number; max_p4: number; max_ex2: number; max_rattrapage: number; max_tenasop: number; max_bac: number; schedule_label?: string | null }): Promise<ClassSubject> {
    return request(`/subjects/class-subjects/${classSubjectId}/maxima`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async grades(classId: string): Promise<Grade[]> {
    return request(`/grades/class/${classId}`)
  },
  async saveGrades(classSubjectId: string, periodCode: PeriodCode, grades: Array<{ student_id: string; value: number | string }>, reason?: string): Promise<Grade[]> {
    return request('/grades/bulk', {
      method: 'POST',
      body: JSON.stringify({ class_subject_id: classSubjectId, period_code: periodCode, grades, reason }),
    })
  },
  async unlockGrades(classSubjectId: string, periodCode: PeriodCode, reason: string, studentId?: string): Promise<{ message: string; unlocked: number }> {
    return request('/grades/unlock', { method: 'POST', body: JSON.stringify({ class_subject_id: classSubjectId, period_code: periodCode, reason, student_id: studentId }) })
  },
  async setGradeLock(classSubjectId: string, periodCode: PeriodCode, studentId: string, locked: boolean, reason: string): Promise<{ message: string; locked: boolean }> {
    return request('/grades/lock-toggle', { method: 'POST', body: JSON.stringify({ class_subject_id: classSubjectId, period_code: periodCode, student_id: studentId, locked, reason }) })
  },
  async reportCards(classId?: string): Promise<ReportCard[]> {
    const query = classId ? `?class_id=${classId}` : ''
    return request(`/report-cards${query}`)
  },
  async generateClassReportCards(classId: string): Promise<ReportCard[]> {
    return request('/report-cards/generate-class', { method: 'POST', body: JSON.stringify({ class_id: classId }) })
  },
  async validateReportCard(cardId: string): Promise<ReportCard> {
    return request(`/report-cards/${cardId}/validate`, { method: 'POST', body: JSON.stringify({}) })
  },
  async publishReportCard(cardId: string): Promise<ReportCard> {
    return request(`/report-cards/${cardId}/publish`, { method: 'POST', body: JSON.stringify({}) })
  },
  async setReportPaymentBlock(cardId: string, blocked: boolean, reason: string): Promise<ReportCard> {
    return request(`/report-cards/${cardId}/payment-block`, { method: 'POST', body: JSON.stringify({ blocked, reason }) })
  },
  async signReportCard(cardId: string, signatureName: string, comment?: string): Promise<{ message: string }> {
    return request(`/report-cards/${cardId}/sign`, { method: 'POST', body: JSON.stringify({ signature_name: signatureName, comment }) })
  },
  reportCardDownloadUrl(cardId: string): string {
    return `${API_BASE_URL}/report-cards/${cardId}/download`
  },
  async notifications(): Promise<NotificationItem[]> {
    return request('/notifications')
  },
  async auditLogs(): Promise<AuditLog[]> {
    return request('/audit-logs')
  },
  async restoreAuditLog(logId: string): Promise<{ message: string }> {
    return request(`/audit-logs/${logId}/restore`, { method: 'POST', body: JSON.stringify({}) })
  },
  async courseResources(): Promise<CourseResource[]> {
    return request('/course-resources')
  },
  async createCourseResource(payload: { class_subject_id: string; title: string; description?: string; resource_type?: string; url?: string; content?: string; is_published?: boolean }): Promise<CourseResource> {
    return request('/course-resources', { method: 'POST', body: JSON.stringify(payload) })
  },
  async disciplinaryActions(): Promise<DisciplinaryAction[]> {
    return request('/discipline')
  },
  async createDisciplinaryAction(payload: { student_id: string; action_type: string; reason: string }): Promise<DisciplinaryAction> {
    return request('/discipline', { method: 'POST', body: JSON.stringify(payload) })
  },

  async schoolYears(): Promise<SchoolYear[]> {
    return request('/school-years')
  },
  async createSchoolYear(payload: { label: string; is_active?: boolean }): Promise<SchoolYear> {
    return request('/school-years', { method: 'POST', body: JSON.stringify(payload) })
  },
  async updateSchoolYear(yearId: string, payload: { label?: string; is_active?: boolean; is_closed?: boolean; is_archived?: boolean }): Promise<SchoolYear> {
    return request(`/school-years/${yearId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async updatePeriod(yearId: string, periodId: string, payload: { is_open?: boolean; is_closed?: boolean }): Promise<any> {
    return request(`/school-years/${yearId}/periods/${periodId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  async forgotPassword(email: string): Promise<{ message: string; dev_reset_token?: string | null }> {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password: newPassword }) })
  },
  async importGradesExcel(classSubjectId: string, periodCode: PeriodCode, file: File): Promise<{ message: string; imported: number; skipped: number; errors: string[] }> {
    const form = new FormData()
    form.append('file', file)
    return formRequest(`/grades/import-excel?class_subject_id=${encodeURIComponent(classSubjectId)}&period_code=${encodeURIComponent(periodCode)}`, form)
  },
  async importGradesExcelFull(classSubjectId: string, file: File): Promise<{ message: string; imported: number; skipped: number; errors: string[] }> {
    const form = new FormData()
    form.append('file', file)
    return formRequest(`/grades/import-excel-full?class_subject_id=${encodeURIComponent(classSubjectId)}`, form)
  },
  async exams(): Promise<ExamSchedule[]> {
    return request('/exams')
  },
  async createExam(payload: { class_subject_id: string; exam_date: string; start_time: string; end_time?: string; room?: string }): Promise<ExamSchedule> {
    return request('/exams', { method: 'POST', body: JSON.stringify(payload) })
  },
  async gradeSubmissionCourses(): Promise<GradeSubmissionCourse[]> {
    return request('/grade-submissions/courses')
  },
  async gradeSubmissions(classId?: string): Promise<GradeSubmission[]> {
    const query = classId ? `?class_id=${encodeURIComponent(classId)}` : ''
    return request(`/grade-submissions${query}`)
  },
  async sendGradesToJury(payload: { class_subject_id: string; periods?: PeriodCode[]; note?: string }): Promise<GradeSubmission> {
    return request('/grade-submissions', { method: 'POST', body: JSON.stringify(payload) })
  },
  async validateGradeSubmission(submissionId: string): Promise<GradeSubmission> {
    return request(`/grade-submissions/${submissionId}/validate`, { method: 'POST', body: JSON.stringify({}) })
  },
  async enrollments(): Promise<EnrollmentItem[]> {
    return request('/enrollments')
  },
  async createEnrollment(payload: { student_id: string; school_year_id: string; class_id: string; enrollment_type?: string; status?: string; decision?: string; notes?: string }): Promise<EnrollmentItem> {
    return request('/enrollments', { method: 'POST', body: JSON.stringify(payload) })
  },
  async reenroll(payload: { student_id: string; target_school_year_id: string; target_class_id: string; decision?: string; notes?: string }): Promise<EnrollmentItem> {
    return request('/enrollments/reenroll', { method: 'POST', body: JSON.stringify(payload) })
  },
  async attendance(classId?: string): Promise<AttendanceItem[]> {
    const query = classId ? `?class_id=${classId}` : ''
    return request(`/attendance${query}`)
  },
  async saveAttendance(payload: { class_id: string; attendance_date: string; period_label?: string; records: Array<{ student_id: string; status: string; reason?: string }> }): Promise<AttendanceItem[]> {
    return request('/attendance/bulk', { method: 'POST', body: JSON.stringify(payload) })
  },
  async schedules(): Promise<ScheduleSlot[]> {
    return request('/schedules')
  },
  async createSchedule(payload: { class_subject_id: string; day_of_week: string; start_time: string; end_time: string; room?: string }): Promise<ScheduleSlot> {
    return request('/schedules', { method: 'POST', body: JSON.stringify(payload) })
  },
  async documents(): Promise<AdministrativeDocument[]> {
    return request('/documents')
  },
  async createDocument(payload: { student_id: string; document_type: string }): Promise<AdministrativeDocument> {
    return request('/documents', { method: 'POST', body: JSON.stringify(payload) })
  },
  documentDownloadUrl(documentId: string): string {
    return `${API_BASE_URL}/documents/${documentId}/download`
  },
  paymentReceiptUrl(paymentId: string): string {
    return `${API_BASE_URL}/payments/${paymentId}/receipt`
  },
  async backups(): Promise<BackupSnapshot[]> {
    return request('/backups')
  },
  async createBackup(label: string): Promise<BackupSnapshot> {
    return request('/backups', { method: 'POST', body: JSON.stringify({ label }) })
  },
  async restoreBackup(backupId: string): Promise<BackupSnapshot> {
    return request(`/backups/${backupId}/restore`, { method: 'POST', body: JSON.stringify({}) })
  },
  async libraryBooks(): Promise<LibraryBook[]> {
    return request('/library/books')
  },
  async createLibraryBook(payload: { title: string; author?: string; category?: string; isbn?: string; total_copies: number; location?: string }): Promise<LibraryBook> {
    return request('/library/books', { method: 'POST', body: JSON.stringify(payload) })
  },
  async libraryLoans(): Promise<LibraryLoan[]> {
    return request('/library/loans')
  },
  async createLibraryLoan(payload: { book_id: string; student_id: string; due_date?: string }): Promise<LibraryLoan> {
    return request('/library/loans', { method: 'POST', body: JSON.stringify(payload) })
  },
  async returnLibraryLoan(loanId: string): Promise<LibraryLoan> {
    return request(`/library/loans/${loanId}/return`, { method: 'POST', body: JSON.stringify({}) })
  },
  async verifyReportCard(cardId: string, version?: string | null): Promise<ReportVerification> {
    const query = version ? `?version=${encodeURIComponent(version)}` : ''
    return request(`/public/report-cards/${cardId}/verify${query}`)
  },
}
