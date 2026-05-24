import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ClassRoom, ClassSubject, PeriodCode } from '../types'

const periods: Array<{ code: PeriodCode; label: string }> = [
  { code: 'P1', label: '1ère période' }, { code: 'P2', label: '2ème période' }, { code: 'EX1', label: 'Examen S1' },
  { code: 'P3', label: '3ème période' }, { code: 'P4', label: '4ème période' }, { code: 'EX2', label: 'Examen S2' },
  { code: 'RATTRAPAGE', label: 'Rattrapage' }, { code: 'TENASOP', label: 'TENASOP' }, { code: 'BAC', label: 'BAC / EXETAT' },
]

export function GradeExcelImportPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [subjects, setSubjects] = useState<ClassSubject[]>([])
  const [classId, setClassId] = useState('')
  const [classSubjectId, setClassSubjectId] = useState('')
  const [period, setPeriod] = useState<PeriodCode>('P1')
  const [mode, setMode] = useState<'single' | 'full'>('single')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { api.classes().then((rows) => { setClasses(rows); if (rows[0]) setClassId(rows[0].id) }).catch((e) => setError(e.message)) }, [])
  useEffect(() => { if (classId) api.classSubjects(classId).then((rows) => { setSubjects(rows); setClassSubjectId(rows[0]?.id ?? '') }).catch((e) => setError(e.message)) }, [classId])

  async function submit() {
    setError(null); setMessage(null)
    try {
      if (!file || !classSubjectId) throw new Error('Choisis le cours et le fichier Excel.')
      const res = mode === 'full' ? await api.importGradesExcelFull(classSubjectId, file) : await api.importGradesExcel(classSubjectId, period, file)
      setMessage(`${res.imported} point(s) importé(s), ${res.skipped} ligne(s) ignorée(s). ${res.errors.slice(0, 5).join(' | ')}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur import') }
  }

  return <div className="space-y-6">
    <div><p className="app-kicker">Import Excel des points</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Points par fichier Excel</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Le professeur peut importer une seule période avec <b>matricule + note</b>, ou une liste complète avec <b>matricule, p1, p2, ex1, p3, p4, ex2</b>. Le calcul garde les points réels : 11/20 reste 11 et ne devient pas 10.</p></div>
    {error && <div className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}
    <section className="app-card rounded-[2rem] p-5"><div className="grid gap-3 md:grid-cols-5">
      <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.option ? ` — ${c.option}` : ''}</option>)}</select>
      <select value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}</select>
      <select value={mode} onChange={(e) => setMode(e.target.value as 'single' | 'full')} className="rounded-2xl border border-slate-200 px-4 py-3">
        <option value="single">Une période</option>
        <option value="full">Liste complète</option>
      </select>
      <select disabled={mode === 'full'} value={period} onChange={(e) => setPeriod(e.target.value as PeriodCode)} className="rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100">{periods.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}</select>
      <input type="file" accept=".xlsx,.xlsm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-2xl border border-slate-200 px-4 py-3" />
    </div>
    <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
      <b>Format complet accepté :</b> matricule | p1 | p2 | ex1 | p3 | p4 | ex2. Les colonnes rattrapage, tenasop et bac sont optionnelles.
    </div>
    <button onClick={submit} className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Importer les points</button></section>
  </div>
}
