import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { ClassRoom, EnrollmentItem, SchoolYear, Student } from '../types'

export function EnrollmentsPage() {
  const [rows, setRows] = useState<EnrollmentItem[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [years, setYears] = useState<SchoolYear[]>([])
  const [studentId, setStudentId] = useState('')
  const [yearId, setYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const activeYears = useMemo(() => years.filter(y => !y.is_archived), [years])

  async function refresh() {
    const [enr, st, cl, yr] = await Promise.all([api.enrollments(), api.students(), api.classes(), api.schoolYears()])
    setRows(enr); setStudents(st); setClasses(cl); setYears(yr)
    if (!studentId && st[0]) setStudentId(st[0].id)
    if (!classId && cl[0]) setClassId(cl[0].id)
    if (!yearId && yr[0]) setYearId(yr.find(y => y.is_active)?.id ?? yr[0].id)
  }
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])

  async function submit(type: 'inscription' | 'reinscription') {
    setError(null); setMessage(null)
    try {
      const res = type === 'inscription'
        ? await api.createEnrollment({ student_id: studentId, school_year_id: yearId, class_id: classId, enrollment_type: 'inscription', status: 'actif', decision: 'admis', notes })
        : await api.reenroll({ student_id: studentId, target_school_year_id: yearId, target_class_id: classId, decision: 'admis', notes })
      setMessage(`${res.enrollment_type} enregistrée pour ${res.student_name}.`)
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur inscription') }
  }

  return <div className="space-y-6">
    <div><p className="app-kicker">Inscriptions et réinscriptions</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Parcours scolaire</h1><p className="mt-2 text-sm text-slate-500">Inscrire, réinscrire, transférer ou archiver un parcours annuel.</p></div>
    {error && <div className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>}{message && <div className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}
    <section className="app-card rounded-[2rem] p-5"><div className="grid gap-3 md:grid-cols-4">
      <select value={studentId} onChange={e => setStudentId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{students.map(s => <option key={s.id} value={s.id}>{s.matricule} — {s.full_name}</option>)}</select>
      <select value={yearId} onChange={e => setYearId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{activeYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</select>
      <select value={classId} onChange={e => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observation" className="rounded-2xl border border-slate-200 px-4 py-3" />
    </div><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => submit('inscription')} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Inscrire</button><button onClick={() => submit('reinscription')} className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white">Réinscrire</button></div></section>
    <div className="mobile-table-scroll rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Élève</th><th>Année</th><th>Classe</th><th>Type</th><th>Décision</th><th>Statut</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="p-3 font-bold">{r.matricule} — {r.student_name}</td><td>{r.school_year_label}</td><td>{r.class_name}</td><td>{r.enrollment_type}</td><td>{r.decision}</td><td>{r.status}</td></tr>)}</tbody></table></div>
  </div>
}
