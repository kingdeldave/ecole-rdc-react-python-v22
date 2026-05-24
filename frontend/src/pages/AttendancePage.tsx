import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AttendanceItem, ClassRoom, Student } from '../types'

export function AttendancePage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [rows, setRows] = useState<AttendanceItem[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { api.classes().then(r => { setClasses(r); if (r[0]) setClassId(r[0].id) }).catch(e => setError(e.message)) }, [])
  useEffect(() => { if (!classId) return; Promise.all([api.students(classId), api.attendance(classId)]).then(([s, a]) => { setStudents(s); setRows(a); setValues(Object.fromEntries(s.map(x => [x.id, 'present']))) }).catch(e => setError(e.message)) }, [classId])
  async function save() { setError(null); setMessage(null); try { const res = await api.saveAttendance({ class_id: classId, attendance_date: date, period_label: 'Journée', records: students.map(s => ({ student_id: s.id, status: values[s.id] ?? 'present' })) }); setMessage(`${res.length} présence(s) enregistrée(s).`); setRows(await api.attendance(classId)) } catch(e) { setError(e instanceof Error ? e.message : 'Erreur') } }
  return <div className="space-y-6"><div><p className="app-kicker">Présence / absence</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Appel journalier</h1><p className="mt-2 text-sm text-slate-500">Présent, absent, retard ou absence justifiée avec notification parent.</p></div>{error && <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}{message && <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>}<section className="app-card rounded-[2rem] p-5"><div className="grid gap-3 md:grid-cols-3"><select value={classId} onChange={e => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3"/><button onClick={save} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Enregistrer l’appel</button></div></section><div className="grid gap-3">{students.map(s => <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{s.full_name}</p><p className="text-sm text-slate-500">{s.matricule}</p></div><select value={values[s.id] ?? 'present'} onChange={e => setValues(v => ({...v, [s.id]: e.target.value}))} className="rounded-2xl border border-slate-200 px-4 py-3"><option value="present">Présent</option><option value="absent">Absent</option><option value="retard">Retard</option><option value="justifie">Justifié</option></select></div>)}</div><section className="app-card rounded-[2rem] p-5"><h2 className="text-xl font-black">Historique récent</h2>{rows.slice(0,10).map(r => <p key={r.id} className="mt-2 text-sm"><b>{r.attendance_date}</b> — {r.matricule} {r.student_name} : {r.status}</p>)}</section></div>
}
