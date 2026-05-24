import { useEffect, useMemo, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { ClassRoom, ClassSubject, Grade, PeriodCode, Student } from '../types'

const periods: Array<{ code: PeriodCode; label: string }> = [
  { code: 'P1', label: '1ère période' },
  { code: 'P2', label: '2ème période' },
  { code: 'EX1', label: 'Examen S1' },
  { code: 'P3', label: '3ème période' },
  { code: 'P4', label: '4ème période' },
  { code: 'EX2', label: 'Examen S2' },
  { code: 'RATTRAPAGE', label: 'Rattrapage' },
  { code: 'TENASOP', label: 'TENASOP' },
  { code: 'BAC', label: 'BAC' },
]

const directionRoles = new Set(['PREFET', 'DIRECTEUR', 'SUPER_ADMIN'])

function maxForPeriod(subject: ClassSubject | undefined, period: PeriodCode): number {
  if (!subject) return 0
  const map = {
    P1: subject.max_p1,
    P2: subject.max_p2,
    EX1: subject.max_ex1,
    P3: subject.max_p3,
    P4: subject.max_p4,
    EX2: subject.max_ex2,
    RATTRAPAGE: subject.max_rattrapage,
    TENASOP: subject.max_tenasop,
    BAC: subject.max_bac,
  }
  return map[period]
}

export function GradesPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<ClassSubject[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classId, setClassId] = useState('')
  const [classSubjectId, setClassSubjectId] = useState('')
  const [period, setPeriod] = useState<PeriodCode>('P1')
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isDirection = !!user && directionRoles.has(user.role)
  const isTeacher = user?.role === 'ENSEIGNANT'

  async function refreshGrades(targetClassId = classId) {
    if (!targetClassId) return
    setGrades(await api.grades(targetClassId))
  }

  useEffect(() => {
    api.classes().then((rows) => {
      setClasses(rows)
      if (rows[0]) setClassId(rows[0].id)
    }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!classId) return
    Promise.all([api.students(classId), api.classSubjects(classId), api.grades(classId)])
      .then(([s, cs, g]) => {
        setStudents(s)
        setSubjects(cs)
        setGrades(g)
        setClassSubjectId(cs[0]?.id ?? '')
      })
      .catch((e) => setError(e.message))
  }, [classId])

  const selectedSubject = useMemo(() => subjects.find((s) => s.id === classSubjectId), [subjects, classSubjectId])
  const max = maxForPeriod(selectedSubject, period)
  const periodGrades = grades.filter((g) => g.class_subject_id === classSubjectId && g.period_code === period)
  const lockedCount = periodGrades.filter((g) => g.locked).length
  const filledCount = periodGrades.length
  const unlockedCount = periodGrades.filter((g) => !g.locked).length
  const missingCount = Math.max(students.length - filledCount, 0)

  function getGrade(studentId: string) {
    return grades.find((g) => g.student_id === studentId && g.class_subject_id === classSubjectId && g.period_code === period)
  }

  function isLocked(studentId: string) {
    return !!getGrade(studentId)?.locked
  }

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const student of students) {
      const grade = getGrade(student.id)
      next[student.id] = grade ? String(grade.value) : ''
    }
    setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, grades, classSubjectId, period])

  function setCell(studentId: string, value: string) {
    if (value.includes('/')) {
      setError('La note doit être un nombre simple, pas un format 93/80.')
      return
    }
    const numeric = value.trim() === '' ? 0 : Number(value.replace(',', '.'))
    if (value.trim() !== '' && (Number.isNaN(numeric) || numeric < 0)) {
      setError('La note doit être un nombre positif.')
      return
    }
    if (value.trim() !== '' && numeric > max) {
      setError(`La note ne peut pas dépasser le maximum ${max}.`)
      return
    }
    setError(null)
    setValues((prev) => ({ ...prev, [studentId]: value }))
  }

  async function save() {
    setMessage(null)
    setError(null)
    try {
      if (!classSubjectId) throw new Error(isTeacher ? 'Aucun cours ne vous est attribué pour cette classe.' : 'Choisis un cours.')
      const payload = students
        .filter((s) => values[s.id] !== '')
        // Pour le professeur : on renvoie uniquement les lignes ouvertes.
        // Si la direction a déverrouillé un élève précis pour rattrapage,
        // les autres élèves verrouillés ne bloquent plus l'envoi.
        .filter((s) => isDirection || !isLocked(s.id))
        .map((s) => ({ student_id: s.id, value: values[s.id] }))
      if (payload.length === 0) {
        throw new Error(isTeacher ? 'Aucune note ouverte à renvoyer. La direction doit déverrouiller au moins un élève.' : 'Aucune note à enregistrer.')
      }
      const saved = await api.saveGrades(classSubjectId, period, payload, isDirection ? 'Saisie conservée par la direction' : 'Saisie envoyée par le professeur')
      setMessage(isDirection ? `${saved.length} note(s) enregistrée(s) côté direction.` : `${saved.length} note(s) renvoyée(s) à la direction. Les notes ouvertes sont reverrouillées automatiquement.`)
      await refreshGrades(classId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde')
    }
  }

  async function toggleLock(student: Student) {
    const grade = getGrade(student.id)
    if (!grade) {
      setError('Aucune note à verrouiller/déverrouiller pour cet élève.')
      return
    }
    const nextLocked = !grade.locked
    const reason = window.prompt(nextLocked ? `Motif du verrouillage de ${student.full_name}` : `Motif du déverrouillage de ${student.full_name}`)
    if (!reason) return
    setError(null)
    setMessage(null)
    try {
      const result = await api.setGradeLock(classSubjectId, period, student.id, nextLocked, reason)
      await refreshGrades(classId)
      setMessage(`${student.full_name} : ${result.message}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de verrouillage')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Points et maxima</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Saisie des points</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Un professeur ne voit que ses cours. Après envoi, ses points sont verrouillés. Si la direction déverrouille un élève précis pour rattrapage, le professeur peut renvoyer uniquement cette cote. Les périodes Rattrapage, TENASOP et BAC sont aussi calculées dans le bulletin.
          </p>
        </div>
      </div>

      <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
          {subjects.length === 0 && <option value="">Aucun cours attribué</option>}
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}{s.teacher_name ? ` — ${s.teacher_name}` : ''}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodCode)} className="rounded-xl border border-slate-200 px-3 py-2">
          {periods.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        </select>
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">Maximum : {max} · Remplies : {filledCount}/{students.length} · Verrouillées : {lockedCount}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Points remplis</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{filledCount}/{students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Non remplis</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{missingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Verrouillés</p>
          <p className="mt-2 text-2xl font-black text-blue-700">{lockedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Ouverts correction</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{unlockedCount}</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-700">{message}</div>}

      <div className="mobile-table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Élève</th>
              <th className="px-4 py-3">Note / {max}</th>
              {isDirection && <th className="px-4 py-3">Verrouillage</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => {
              const locked = isLocked(s.id)
              return (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{s.matricule}</td>
                  <td className="px-4 py-2">{s.full_name}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={values[s.id] ?? ''}
                        onChange={(e) => setCell(s.id, e.target.value)}
                        disabled={isTeacher && locked}
                        className="w-32 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                        inputMode="decimal"
                        placeholder="0"
                      />
                      {locked && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">verrouillé</span>}
                    </div>
                  </td>
                  {isDirection && (
                    <td className="px-4 py-2">
                      <button onClick={() => toggleLock(s)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${locked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                        {locked ? <LockOpen size={14} /> : <Lock size={14} />}
                        {locked ? 'Déverrouiller' : 'Verrouiller'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button onClick={save} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">
        {isDirection ? 'Enregistrer les points côté direction' : 'Envoyer et verrouiller mes points'}
      </button>
    </div>
  )
}
