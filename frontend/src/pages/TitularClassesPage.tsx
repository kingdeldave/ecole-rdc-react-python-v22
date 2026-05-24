import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { ClassRoom, Student } from '../types'

export function TitularClassesPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedClass = classes.find((c) => c.id === classId)

  useEffect(() => {
    api.myTitularClasses()
      .then((rows) => { setClasses(rows); if (rows[0]) setClassId(rows[0].id) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (classId) api.students(classId).then(setStudents).catch((e) => setError(e.message))
  }, [classId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => [s.matricule, s.full_name, s.class_name, s.class_option ?? '', s.payment_status ?? ''].join(' ').toLowerCase().includes(q))
  }, [students, search])

  async function generateReports() {
    setError(null); setMessage(null)
    try {
      if (!classId) throw new Error('Choisis une classe titulaire.')
      const rows = await api.generateClassReportCards(classId)
      setMessage(`${rows.length} bulletin(s) calculé(s). Les bulletins bloqués restent protégés pour frais scolaires.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  return <div className="space-y-6">
    <div>
      <p className="app-kicker">Professeur titulaire</p>
      <h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Mes classes titulaires</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Le titulaire voit les élèves de ses classes, vérifie les points reçus et peut lancer le calcul des bulletins. Si l’élève est bloqué pour frais, le bulletin reste masqué.</p>
    </div>
    {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
    {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}

    <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="app-card rounded-[2rem] p-5">
        <h2 className="text-xl font-black text-slate-950">Classes</h2>
        <div className="mt-4 space-y-3">
          {classes.map((c) => <button key={c.id} onClick={() => setClassId(c.id)} className={`w-full rounded-2xl border p-4 text-left ${classId === c.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <p className="font-black text-slate-950">{c.name}{c.option ? ` — ${c.option}` : ''}</p>
            <p className="mt-1 text-sm text-slate-500">{c.level} · {c.room || 'Salle non définie'} · {c.student_count} élève(s)</p>
          </button>)}
          {!classes.length && <p className="text-sm text-slate-500">Aucune classe titulaire affectée.</p>}
        </div>
      </div>

      <div className="app-card rounded-[2rem] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">{selectedClass ? `${selectedClass.name}${selectedClass.option ? ` — ${selectedClass.option}` : ''}` : 'Classe'}</h2>
            <p className="text-sm text-slate-500">Liste des élèves avec statut financier.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="rounded-2xl border border-slate-200 px-4 py-3" />
            <button onClick={generateReports} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Calculer les bulletins</button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Matricule</th><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Option</th><th className="px-4 py-3">Payé</th><th className="px-4 py-3">Dû</th><th className="px-4 py-3">Accès bulletin</th></tr></thead>
            <tbody>{filtered.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{s.matricule}</td><td className="px-4 py-3">{s.full_name}</td><td className="px-4 py-3">{s.class_option || 'Aucune'}</td><td className="px-4 py-3">{s.total_paid}</td><td className="px-4 py-3">{s.total_due}</td><td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${s.payment_blocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{s.payment_blocked ? 'Bloqué' : 'Autorisé'}</span></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
}
