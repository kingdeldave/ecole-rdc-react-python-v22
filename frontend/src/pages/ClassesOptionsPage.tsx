import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { ClassRoom, SchoolOption, Student, UserAdmin } from '../types'

const baseClasses = [
  { name: '1CO', level: '7ème', section: 'Cycle d’orientation', cycle: 'Secondaire de base', option_required: false },
  { name: '2sec', level: '8ème', section: 'Secondaire', cycle: 'Secondaire de base', option_required: false },
  { name: '3e H', level: '1ère Humanité', section: 'Humanités', cycle: 'Humanités', option_required: true },
  { name: '4e H', level: '2ème Humanité', section: 'Humanités', cycle: 'Humanités', option_required: true },
  { name: '5e H', level: '3ème Humanité', section: 'Humanités', cycle: 'Humanités', option_required: true },
  { name: '6e H', level: '4ème Humanité', section: 'Humanités', cycle: 'Humanités', option_required: true },
]

export function ClassesOptionsPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [options, setOptions] = useState<SchoolOption[]>([])
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optionName, setOptionName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [form, setForm] = useState({ name: '1CO', level: '7ème', section: 'Cycle d’orientation', cycle: 'Secondaire de base', option: '', room: '', option_required: false })

  const teachers = users.filter((u) => u.role === 'ENSEIGNANT')
  const selectedClass = classes.find((c) => c.id === selectedClassId)

  async function loadAll() {
    const [classRows, optionRows, userRows] = await Promise.all([api.classes(), api.schoolOptions(), api.users()])
    setClasses(classRows)
    setOptions(optionRows)
    setUsers(userRows)
    if (!selectedClassId && classRows[0]) setSelectedClassId(classRows[0].id)
  }

  useEffect(() => { loadAll().catch((e) => setError(e.message)) }, [])
  useEffect(() => { if (selectedClassId) api.students(selectedClassId).then(setStudents).catch((e) => setError(e.message)) }, [selectedClassId])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => [s.matricule, s.full_name, s.class_name, s.class_option ?? '', s.class_room ?? ''].join(' ').toLowerCase().includes(q))
  }, [students, search])

  function setBase(name: string) {
    const found = baseClasses.find((c) => c.name === name) ?? baseClasses[0]
    setForm((old) => ({ ...old, ...found, option: found.option_required ? old.option : '' }))
  }

  async function createOption() {
    setError(null); setMessage(null)
    try {
      if (!optionName.trim()) throw new Error('Nom de l’option obligatoire.')
      await api.createSchoolOption({ name: optionName.trim() })
      setOptionName('')
      await loadAll()
      setMessage('Option créée.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  async function createClass() {
    setError(null); setMessage(null)
    try {
      const payload = { ...form, option: form.option_required ? form.option || null : null }
      await api.createClass(payload)
      await loadAll()
      setMessage('Classe créée avec sa salle et son option.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  async function addTitular() {
    setError(null); setMessage(null)
    try {
      if (!selectedClassId || !teacherId) throw new Error('Choisis une classe et un professeur titulaire.')
      await api.addClassTitular(selectedClassId, teacherId)
      await loadAll()
      setMessage('Professeur titulaire affecté.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  return <div className="space-y-6">
    <div>
      <p className="app-kicker">Administration scolaire</p>
      <h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Classes, options et titulaires</h1>
      <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">1CO et 2sec restent sans option. À partir des humanités, l’administration peut créer des options comme Scientifique, Littéraire ou Nutrition, puis classer les élèves dans la bonne salle.</p>
    </div>

    {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}

    <section className="grid gap-5 xl:grid-cols-3">
      <div className="app-card rounded-[2rem] p-5 xl:col-span-2">
        <h2 className="text-xl font-black text-slate-950">Créer une classe / option</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select value={form.name} onChange={(e) => setBase(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold">
            {baseClasses.map((c) => <option key={c.name} value={c.name}>{c.name} — {c.level}</option>)}
          </select>
          <select value={form.option} disabled={!form.option_required} onChange={(e) => setForm({ ...form, option: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold disabled:bg-slate-100">
            <option value="">Aucune option</option>
            {options.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
          </select>
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Salle ex. Salle 4A" className="rounded-2xl border border-slate-200 px-4 py-3 font-bold" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Niveau" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Section" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} placeholder="Cycle" className="rounded-2xl border border-slate-200 px-4 py-3" />
        </div>
        <button onClick={createClass} className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Créer la classe</button>
      </div>

      <div className="app-card rounded-[2rem] p-5">
        <h2 className="text-xl font-black text-slate-950">Nouvelle option</h2>
        <input value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Scientifique, Littéraire..." className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        <button onClick={createOption} className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-3 font-black text-white">Ajouter option</button>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1fr_1.35fr]">
      <div className="app-card rounded-[2rem] p-5">
        <h2 className="text-xl font-black text-slate-950">Liste des classes</h2>
        <div className="mt-4 space-y-3">
          {classes.map((c) => <button key={c.id} onClick={() => setSelectedClassId(c.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedClassId === c.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{c.name}{c.option ? ` — ${c.option}` : ''}</p>
                <p className="mt-1 text-sm text-slate-500">{c.level} · {c.room || 'Salle non définie'} · {c.student_count} élève(s)</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{c.option_required ? 'Option' : 'Sans option'}</span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">Titulaire(s) : {(c.titulars ?? []).map((t) => t.teacher_name).join(', ') || 'Aucun'}</p>
          </button>)}
        </div>
      </div>

      <div className="space-y-5">
        <div className="app-card rounded-[2rem] p-5">
          <h2 className="text-xl font-black text-slate-950">Professeur titulaire</h2>
          <p className="mt-1 text-sm text-slate-500">Classe sélectionnée : <b>{selectedClass?.name}{selectedClass?.option ? ` — ${selectedClass.option}` : ''}</b></p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3">
              <option value="">Choisir un professeur</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            <button onClick={addTitular} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Affecter</button>
          </div>
        </div>

        <div className="app-card rounded-[2rem] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Élèves de la classe</h2>
              <p className="text-sm text-slate-500">Recherche par matricule, nom, classe, option ou salle.</p>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="rounded-2xl border border-slate-200 px-4 py-3" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Matricule</th><th className="px-4 py-3">Nom complet</th><th className="px-4 py-3">Classe</th><th className="px-4 py-3">Option</th><th className="px-4 py-3">Paiement</th></tr></thead>
              <tbody>{filteredStudents.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{s.matricule}</td><td className="px-4 py-3">{s.full_name}</td><td className="px-4 py-3">{s.class_name}</td><td className="px-4 py-3">{s.class_option || 'Aucune'}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${s.payment_blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{s.payment_blocked ? 'Bloqué' : 'En ordre'}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
}
