import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { Grade, GradeSubmission, GradeSubmissionCourse, PeriodCode, Student } from '../types'

const juryPeriods: PeriodCode[] = ['P1', 'P2', 'EX1', 'P3', 'P4', 'EX2']

export function JuryPointsPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<GradeSubmissionCourse[]>([])
  const [submissions, setSubmissions] = useState<GradeSubmission[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = courses.find((c) => c.class_subject_id === selectedId)
  const gradesForCourse = useMemo(() => grades.filter((g) => g.class_subject_id === selectedId), [grades, selectedId])

  async function loadAll() {
    const [courseRows, submissionRows] = await Promise.all([api.gradeSubmissionCourses(), api.gradeSubmissions()])
    setCourses(courseRows)
    setSubmissions(submissionRows)
    if (!selectedId && courseRows[0]) setSelectedId(courseRows[0].class_subject_id)
  }

  useEffect(() => { loadAll().catch((e) => setError(e.message)) }, [])
  useEffect(() => {
    if (!selected) return
    Promise.all([api.students(selected.class_id), api.grades(selected.class_id)]).then(([s, g]) => { setStudents(s); setGrades(g) }).catch((e) => setError(e.message))
  }, [selectedId])

  function valueFor(studentId: string, period: PeriodCode) {
    return gradesForCourse.find((g) => g.student_id === studentId && g.period_code === period)?.value ?? ''
  }

  async function sendToJury() {
    setError(null); setMessage(null)
    try {
      if (!selected) throw new Error('Choisis un cours.')
      const res = await api.sendGradesToJury({ class_subject_id: selected.class_subject_id, periods: juryPeriods, note: 'Envoi depuis l’interface professeur.' })
      await loadAll()
      setMessage(`Points envoyés au jury par ${res.teacher_name}. Lignes manquantes : ${res.missing_total}.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  async function validateSubmission(id: string) {
    setError(null); setMessage(null)
    try {
      await api.validateGradeSubmission(id)
      await loadAll()
      setMessage('Envoi validé par le jury.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  return <div className="space-y-6">
    <div><p className="app-kicker">Jury des points</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Envoyer les points au jury</h1><p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">Le professeur choisit son cours, vérifie les élèves, puis confirme l’envoi. Le jury est composé de l’administration, de la direction et du professeur titulaire de la classe.</p></div>
    {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}

    <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <div className="app-card rounded-[2rem] p-5">
        <h2 className="text-xl font-black text-slate-950">Mes cours</h2>
        <div className="mt-4 space-y-3">
          {courses.map((c) => <button key={c.class_subject_id} onClick={() => setSelectedId(c.class_subject_id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === c.class_subject_id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <p className="font-black text-slate-950">{c.subject_name}</p>
            <p className="mt-1 text-sm text-slate-500">{c.class_name}{c.class_option ? ` — ${c.class_option}` : ''}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{c.grades_total} point(s) · {c.missing_total} manquant(s)</p>
            {c.latest_status && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{c.latest_status}</span>}
          </button>)}
        </div>
      </div>

      <div className="app-card rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{selected?.subject_name ?? 'Cours'}</h2>
            <p className="text-sm text-slate-500">{selected ? `${selected.class_name}${selected.class_option ? ` — ${selected.class_option}` : ''}` : 'Sélectionne un cours'}</p>
            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
              <p className="font-black">Professeur responsable avant envoi</p>
              <p className="mt-1">{selected?.teacher_name || user?.full_name || 'Professeur connecté'}</p>
            </div>
          </div>
          <button onClick={sendToJury} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Confirmer l’envoi au jury</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Matricule</th><th className="px-4 py-3">Nom</th>{juryPeriods.map((p) => <th key={p} className="px-4 py-3">{p}</th>)}</tr></thead>
            <tbody>{students.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{s.matricule}</td><td className="px-4 py-3">{s.full_name}</td>{juryPeriods.map((p) => <td key={p} className="px-4 py-3">{valueFor(s.id, p) || <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="app-card rounded-[2rem] p-5">
      <h2 className="text-xl font-black text-slate-950">Historique des envois</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Cours</th><th className="px-4 py-3">Classe</th><th className="px-4 py-3">Professeur</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Manquants</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{submissions.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{s.subject_name}</td><td className="px-4 py-3">{s.class_name}{s.class_option ? ` — ${s.class_option}` : ''}</td><td className="px-4 py-3">{s.teacher_name}</td><td className="px-4 py-3">{s.status}</td><td className="px-4 py-3">{s.missing_total}</td><td className="px-4 py-3"><button onClick={() => validateSubmission(s.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Valider</button></td></tr>)}</tbody></table></div>
    </section>
  </div>
}
