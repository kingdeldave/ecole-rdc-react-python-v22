export type RoleCode =
  | 'SUPER_ADMIN'
  | 'ADMIN_ECOLE'
  | 'PREFET'
  | 'DIRECTEUR'
  | 'ENSEIGNANT'
  | 'COMPTABLE'
  | 'PARENT'
  | 'ELEVE'

export type PeriodCode = 'P1' | 'P2' | 'EX1' | 'P3' | 'P4' | 'EX2' | 'RATTRAPAGE' | 'TENASOP' | 'BAC'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string | null
  role: RoleCode
  school_id: string | null
  is_active: boolean
  photo_path?: string | null
}

export interface DashboardStats {
  students: number
  classes: number
  subjects: number
  teachers: number
  report_cards: number
  published_report_cards: number
  blocked_report_cards: number
  payments_total: number
  unread_notifications: number
  role: RoleCode
  my_children: number
  my_courses: number
  locked_grades: number
  unpaid_students: number
  disciplinary_actions: number
  course_resources: number
}

export interface ClassRoom {
  id: string
  name: string
  level?: string | null
  section?: string | null
  option?: string | null
  cycle?: string | null
  room?: string | null
  option_required?: boolean
  student_count: number
  titulars?: ClassTitular[]
}

export interface ClassTitular {
  teacher_id: string
  teacher_name: string
  teacher_email?: string | null
  teacher_phone?: string | null
}

export interface SchoolOption {
  id: string
  name: string
  description?: string | null
  is_active: boolean
}

export interface Student {
  id: string
  matricule: string
  full_name: string
  sex: string
  class_id: string
  class_name: string
  class_option?: string | null
  class_room?: string | null
  status: string
  birth_date?: string | null
  birth_place?: string | null
  address?: string | null
  payment_status?: 'EN_ORDRE' | 'PARTIEL' | 'NON_PAYE' | 'EXEMPTION' | null
  payment_blocked: boolean
  total_due: number
  total_paid: number
  parent_count: number
  photo_path?: string | null
}

export interface ClassSubject {
  id: string
  subject_id: string
  subject_name: string
  class_name?: string | null
  teacher_id?: string | null
  teacher_name?: string | null
  teacher_phone?: string | null
  schedule_label?: string | null
  max_p1: number
  max_p2: number
  max_ex1: number
  max_p3: number
  max_p4: number
  max_ex2: number
  max_rattrapage: number
  max_tenasop: number
  max_bac: number
  display_order: number
}

export interface Grade {
  id: string
  student_id: string
  class_subject_id: string
  period_code: PeriodCode
  value: number
  max_value: number
  locked: boolean
}

export interface ReportCard {
  id: string
  student_id: string
  student_name: string
  class_id: string
  class_name: string
  status: 'DRAFT' | 'CALCULATED' | 'TITULAR_REVIEW' | 'VALIDATED_BY_TITULAR' | 'VALIDATED' | 'PUBLISHED' | 'BLOCKED' | 'UNBLOCKED' | 'CORRECTED' | 'ARCHIVED'
  version: number
  total: number
  max_total: number
  percentage: number
  rank: number | null
  decision: string | null
  payment_blocked: boolean
  locked: boolean
  published_at: string | null
  snapshot_json: any
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
  email_to?: string | null
  email_status?: string | null
}

export interface AuditLog {
  id: string
  action: string
  entity_type?: string | null
  entity_id?: string | null
  user_role?: string | null
  reason?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  created_at: string
  can_restore: boolean
}


export interface CourseResource {
  id: string
  class_subject_id: string
  subject_name: string
  class_name: string
  title: string
  description?: string | null
  resource_type: string
  url?: string | null
  content?: string | null
  is_published: boolean
  created_by_name?: string | null
  teacher_name?: string | null
  teacher_phone?: string | null
  schedule_label?: string | null
  created_at: string
}

export interface DisciplinaryAction {
  id: string
  student_id: string
  student_name: string
  action_type: string
  reason: string
  action_date: string
  created_at: string
}

export interface ReportVerification {
  exists: boolean
  official_document: boolean
  report_card_id: string
  version: number
  student_matricule: string
  student_name: string
  school: string
  class_name: string
  percentage: number
  rank: number | null
  published_at: string | null
  message: string
}


export interface UserAdmin {
  id: string
  email: string
  full_name: string
  phone?: string | null
  role: RoleCode
  school_id: string | null
  is_active: boolean
  photo_path?: string | null
  demo_password?: string | null
}

export interface ParentChildrenLink {
  parent_profile_id: string
  parent_name: string
  parent_email?: string | null
  children: Student[]
}


export interface TeacherScheduleCourse {
  class_subject_id: string
  class_name: string
  subject_name: string
  category?: string | null
  schedule_label?: string | null
  max_p1: number
  max_p2: number
  max_ex1: number
  max_p3: number
  max_p4: number
  max_ex2: number
  max_rattrapage: number
  max_tenasop: number
  max_bac: number
}

export interface TeacherSchedule {
  teacher_id: string
  teacher_name: string
  teacher_email?: string | null
  teacher_phone?: string | null
  teacher_photo_path?: string | null
  course_count: number
  classes_count: number
  courses: TeacherScheduleCourse[]
}

export interface PeriodItem {
  id: string
  code: PeriodCode
  label: string
  is_open: boolean
  is_closed: boolean
}

export interface SchoolYear {
  id: string
  label: string
  is_active: boolean
  is_closed: boolean
  is_archived: boolean
  periods: PeriodItem[]
}

export interface EnrollmentItem {
  id: string
  student_id: string
  student_name: string
  matricule: string
  school_year_id: string
  school_year_label: string
  class_id: string
  class_name: string
  enrollment_type: string
  status: string
  decision?: string | null
  notes?: string | null
  created_at: string
}

export interface AttendanceItem {
  id: string
  student_id: string
  student_name: string
  matricule: string
  class_id: string
  class_name: string
  attendance_date: string
  period_label?: string | null
  status: string
  reason?: string | null
  created_at: string
}

export interface ScheduleSlot {
  id: string
  class_subject_id: string
  class_id: string
  class_name: string
  subject_name: string
  teacher_id?: string | null
  teacher_name?: string | null
  day_of_week: string
  start_time: string
  end_time: string
  room?: string | null
  is_active: boolean
}

export interface AdministrativeDocument {
  id: string
  student_id: string
  student_name: string
  matricule: string
  document_type: string
  document_number: string
  title: string
  status: string
  created_at: string
}

export interface BackupSnapshot {
  id: string
  label: string
  status: string
  created_at: string
  restored_at?: string | null
  table_count: number
}

export interface LibraryBook {
  id: string
  title: string
  author?: string | null
  category?: string | null
  isbn?: string | null
  total_copies: number
  available_copies: number
  location?: string | null
  status: string
  created_at: string
}

export interface LibraryLoan {
  id: string
  book_id: string
  book_title: string
  student_id: string
  student_name: string
  matricule: string
  loan_date: string
  due_date?: string | null
  status: string
  returned_at?: string | null
}


export interface ExamSchedule {
  id: string
  class_id: string
  class_name: string
  class_option?: string | null
  class_subject_id: string
  subject_name: string
  exam_date: string
  start_time: string
  end_time?: string | null
  room?: string | null
  status: string
  created_by_name?: string | null
  created_at: string
}

export interface GradeSubmissionCourse {
  class_subject_id: string
  class_id: string
  class_name: string
  class_option?: string | null
  subject_name: string
  teacher_name?: string | null
  students_total: number
  grades_total: number
  missing_total: number
  latest_status?: string | null
}

export interface GradeSubmission {
  id: string
  class_subject_id: string
  class_id: string
  class_name: string
  class_option?: string | null
  subject_name: string
  teacher_id: string
  teacher_name: string
  periods: string[]
  status: string
  students_total: number
  grades_total: number
  missing_total: number
  note?: string | null
  created_at: string
  validated_at?: string | null
}
