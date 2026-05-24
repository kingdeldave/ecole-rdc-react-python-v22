import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BookOpen, CalendarDays, Clock3, MapPin, Plus, RefreshCw, Search, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { ClassRoom, ClassSubject, ScheduleSlot, TeacherSchedule } from '../types'

const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const managementRoles = ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR']

type DisplayCourse = {
  id: string
  classSubjectId?: string
  day: string
  startTime: string
  endTime: string
  subjectName: string
  className: string
  teacherName: string
  room: string
  source: 'schedule' | 'program'
}

function normalizeDay(value?: string | null): string {
  const raw = String(value ?? '').toLowerCase()
  if (raw.includes('lundi')) return 'Lundi'
  if (raw.includes('mardi')) return 'Mardi'
  if (raw.includes('mercredi')) return 'Mercredi'
  if (raw.includes('jeudi')) return 'Jeudi'
  if (raw.includes('vendredi')) return 'Vendredi'
  if (raw.includes('samedi')) return 'Samedi'
  return 'Non planifié'
}

function cleanTime(value?: string | null): string {
  if (!value) return '--:--'
  const raw = String(value).trim()
  const match = raw.match(/(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/i)
  if (!match) return raw
  return `${match[1].padStart(2, '0')}:${match[2] ?? '00'}`
}

function parseScheduleLabel(label?: string | null) {
  const raw = String(label ?? '').trim()
  const day = normalizeDay(raw)
  const timeMatch = raw.match(/(\d{1,2}\s*(?:h|:)\s*\d{2}|\d{1,2}h?)\s*[-–]\s*(\d{1,2}\s*(?:h|:)\s*\d{2}|\d{1,2}h?)/i)
  const roomParts = raw.split('·').map((part) => part.trim()).filter(Boolean)
  const room = roomParts.length > 1 ? roomParts.slice(1).join(' · ') : 'Salle à compléter'

  return {
    day,
    startTime: timeMatch ? cleanTime(timeMatch[1]) : '--:--',
    endTime: timeMatch ? cleanTime(timeMatch[2]) : '--:--',
    room,
  }
}

function slotToDisplay(slot: ScheduleSlot): DisplayCourse {
  return {
    id: slot.id,
    classSubjectId: slot.class_subject_id,
    day: normalizeDay(slot.day_of_week),
    startTime: cleanTime(slot.start_time),
    endTime: cleanTime(slot.end_time),
    subjectName: slot.subject_name,
    className: slot.class_name,
    teacherName: slot.teacher_name ?? 'Professeur à compléter',
    room: slot.room ?? 'Salle à compléter',
    source: 'schedule',
  }
}

function programToDisplay(rows: TeacherSchedule[]): DisplayCourse[] {
  return rows.flatMap((teacher) =>
    teacher.courses.map((course) => {
      const parsed = parseScheduleLabel(course.schedule_label)
      return {
        id: `${teacher.teacher_id}-${course.class_subject_id}`,
        classSubjectId: course.class_subject_id,
        day: parsed.day,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        subjectName: course.subject_name,
        className: course.class_name,
        teacherName: teacher.teacher_name,
        room: parsed.room,
        source: 'program' as const,
      }
    }),
  )
}

function sortCourses(a: DisplayCourse, b: DisplayCourse) {
  const dayA = days.includes(a.day) ? days.indexOf(a.day) : 99
  const dayB = days.includes(b.day) ? days.indexOf(b.day) : 99
  if (dayA !== dayB) return dayA - dayB
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime)
  return a.subjectName.localeCompare(b.subjectName)
}

export function SchedulesPage() {
  const { user } = useAuth()
  const canManageSchedules = Boolean(user && managementRoles.includes(user.role))

  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [subjects, setSubjects] = useState<ClassSubject[]>([])
  const [rows, setRows] = useState<DisplayCourse[]>([])
  const [selectedDay, setSelectedDay] = useState('Lundi')
  const [classId, setClassId] = useState('')
  const [classSubjectId, setClassSubjectId] = useState('')
  const [day, setDay] = useState('Lundi')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('09:00')
  const [room, setRoom] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const scheduleSlots = await api.schedules()
      setRows(scheduleSlots.map(slotToDisplay).sort(sortCourses))
    } catch (scheduleError) {
      try {
        const teacherProgram = await api.teacherSchedule()
        setRows(programToDisplay(teacherProgram).sort(sortCourses))
      } catch (programError) {
        const err = programError instanceof Error ? programError : scheduleError
        const msg = err instanceof Error ? err.message : 'Erreur de chargement des horaires.'
        setError(msg === 'Failed to fetch' ? 'Impossible de joindre le backend. Vérifie que FastAPI est lancé sur le port 8000.' : msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!canManageSchedules) return
    api.classes()
      .then((classRows) => {
        setClasses(classRows)
        if (classRows[0]) setClassId(classRows[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement des classes.'))
  }, [canManageSchedules])

  useEffect(() => {
    if (!canManageSchedules || !classId) return
    api.classSubjects(classId)
      .then((classSubjects) => {
        setSubjects(classSubjects)
        setClassSubjectId(classSubjects[0]?.id ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement des cours.'))
  }, [canManageSchedules, classId])

  async function save() {
    if (!classSubjectId) {
      setError('Choisis d’abord une matière.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      const res = await api.createSchedule({
        class_subject_id: classSubjectId,
        day_of_week: day,
        start_time: start,
        end_time: end,
        room,
      })

      setMessage(`Créneau ajouté : ${res.class_name} — ${res.subject_name}`)
      setRoom('')
      setShowCreateForm(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement du créneau.')
    }
  }

  const countByDay = useMemo(() => {
    return days.reduce<Record<string, number>>((acc, item) => {
      acc[item] = rows.filter((row) => row.day === item).length
      return acc
    }, {})
  }, [rows])

  const selectedDayCourses = useMemo(() => {
    return rows.filter((row) => row.day === selectedDay).sort(sortCourses)
  }, [rows, selectedDay])

  const filteredYearCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((row) =>
      [row.subjectName, row.teacherName, row.className, row.room, row.day, row.startTime, row.endTime]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [rows, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="app-kicker">Horaire scolaire</p>
          <h1 className="mobile-page-title mt-2 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Mes cours par jour</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Sélectionne un jour pour voir uniquement les cours prévus, les heures, les salles et le professeur responsable.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>

          {canManageSchedules && (
            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-100 hover:bg-blue-800"
            >
              <Plus size={17} />
              Nouveau créneau
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      {canManageSchedules && showCreateForm && (
        <section className="app-card rounded-[2rem] p-5">
          <div className="mb-4">
            <p className="app-kicker">Administration</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Ajouter un créneau</h2>
            <p className="mt-1 text-sm text-slate-500">Le système bloque les conflits de classe ou de professeur au même moment.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>

            <select value={day} onChange={(e) => setDay(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {days.map((d) => <option key={d}>{d}</option>)}
            </select>

            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Salle" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>

          <button type="button" onClick={save} className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800">
            Enregistrer le créneau
          </button>
        </section>
      )}

      <section className="app-card rounded-[2rem] p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {days.map((item) => {
            const active = selectedDay === item
            return (
              <button
                key={item}
                type="button"
                onClick={() => setSelectedDay(item)}
                className={`rounded-2xl px-4 py-3 text-left transition ${
                  active
                    ? 'bg-blue-700 text-white shadow-sm shadow-blue-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-800'
                }`}
              >
                <p className="text-sm font-black">{item}</p>
                <p className={`mt-1 text-xs font-bold ${active ? 'text-blue-100' : 'text-slate-400'}`}>{countByDay[item] ?? 0} cours</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="app-kicker">{selectedDay}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Cours du jour</h2>
          </div>
          <div className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-blue-700 ring-1 ring-blue-100">
            {selectedDayCourses.length} cours
          </div>
        </div>

        {loading ? (
          <div className="app-card rounded-[2rem] p-8 text-center text-sm font-semibold text-slate-500">Chargement des horaires...</div>
        ) : selectedDayCourses.length === 0 ? (
          <div className="app-card rounded-[2rem] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <CalendarDays size={25} />
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">Aucun cours prévu</h3>
            <p className="mt-1 text-sm text-slate-500">Aucun créneau n’est enregistré pour {selectedDay}.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {selectedDayCourses.map((course) => (
              <article key={`${course.id}-${course.day}-${course.startTime}`} className="app-card rounded-[2rem] p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white">
                      <BookOpen size={23} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{course.startTime} — {course.endTime}</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{course.subjectName}</h3>
                      <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600 md:grid-cols-2">
                        <span className="flex items-center gap-2"><UserRound size={16} className="text-blue-700" />{course.teacherName}</span>
                        <span className="flex items-center gap-2"><MapPin size={16} className="text-blue-700" />{course.room}</span>
                        <span className="flex items-center gap-2"><CalendarDays size={16} className="text-blue-700" />{course.className}</span>
                        <span className="flex items-center gap-2"><Clock3 size={16} className="text-blue-700" />{course.day}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="app-card rounded-[2rem] p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="app-kicker">Programme annuel</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Tous les cours</h2>
            <p className="mt-1 text-sm text-slate-500">Liste simple inspirée d’un portail universitaire : cours, professeur, jour et heure.</p>
          </div>

          <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:w-96">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher cours, professeur, classe..."
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        {filteredYearCourses.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">Aucun cours trouvé.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredYearCourses.map((course) => (
              <div key={`year-${course.id}-${course.day}-${course.startTime}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{course.subjectName}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{course.teacherName}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{course.day}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{course.startTime} - {course.endTime}</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{course.className}</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{course.room}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
