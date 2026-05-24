import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ClassRoom, ClassSubject, ExamSchedule } from '../types'

export function ExamsPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [subjects, setSubjects] = useState<ClassSubject[]>([])
  const [exams, setExams] = useState<ExamSchedule[]>([])
  const [classId, setClassId] = useState('')
  const [form, setForm] = useState({ class_subject_id: '', exam_date: '', start_time: '08:00', end_time: '', room: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadExams() { setExams(await api.exams()) }
  useEffect(() => { Promise.all([api.classes(), api.exams()]).then(([c, e]) => { setClasses(c); setExams(e); if (c[0]) setClassId(c[0].id) }).catch((e) => setError(e.message)) }, [])
  useEffect(() => { if (classId) api.classSubjects(classId).then((rows) => { setSubjects(rows); setForm((f) => ({ ...f, class_subject_id: rows[0]?.id ?? '' })) }).catch((e) => setError(e.message)) }, [classId])

  async function createExam() {
    setError(null); setMessage(null)
    try {
      if (!form.class_subject_id || !form.exam_date || !form.start_time) throw new Error('Cours, date et heure obligatoires.')
      await api.createExam({ ...form, end_time: form.end_time || undefined, room: form.room || undefined })
      await loadExams()
      setMessage('Examen programmé. Les parents ont reçu une notification dans l’application et par email si SMTP est configuré. Le nom du professeur n’est pas affiché aux parents.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  return <div className="space-y-6">
    <div><p className="app-kicker">Examens</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Programmer un examen</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">L’administration, la direction ou le professeur titulaire peut programmer un examen. La notification parent contient le cours, la classe, l’option, la date, l’heure et la salle, sans nom du professeur.</p></div>
    {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
    <section className="app-card rounded-[2rem] p-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.option ? ` — ${c.option}` : ''}</option>)}</select>
        <select value={form.class_subject_id} onChange={(e) => setForm({ ...form, class_subject_id: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold">{subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}</select>
        <input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
        <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Salle" className="rounded-2xl border border-slate-200 px-4 py-3" />
      </div>
      <button onClick={createExam} className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Programmer et notifier</button>
    </section>
    <section className="app-card rounded-[2rem] p-5">
      <h2 className="text-xl font-black text-slate-950">Examens programmés</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam) => <article key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-black text-slate-950">{exam.subject_name}</p><p className="mt-1 text-sm text-slate-500">{exam.class_name}{exam.class_option ? ` — ${exam.class_option}` : ''}</p><p className="mt-3 text-sm font-bold text-slate-700">{exam.exam_date} · {exam.start_time}{exam.end_time ? `-${exam.end_time}` : ''}</p><p className="text-sm text-slate-500">Salle : {exam.room || 'Non précisée'}</p></article>)}
      </div>
    </section>
  </div>
}
