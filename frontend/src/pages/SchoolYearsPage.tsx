import { useEffect, useMemo, useState } from 'react'
import { Archive, CalendarDays, CheckCircle2, Lock, Plus, RotateCcw, Unlock } from 'lucide-react'
import { api } from '../lib/api'
import type { PeriodItem, SchoolYear } from '../types'

function YearBadge({ year }: { year: SchoolYear }) {
  if (year.is_archived) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Archivée</span>
  if (year.is_closed) return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">Clôturée</span>
  if (year.is_active) return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Active</span>
  return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Préparée</span>
}

function PeriodBadge({ period }: { period: PeriodItem }) {
  return period.is_closed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700"><Lock size={12} /> Fermée</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"><Unlock size={12} /> Ouverte</span>
  )
}

export function SchoolYearsPage() {
  const [years, setYears] = useState<SchoolYear[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [newLabel, setNewLabel] = useState('2026-2027')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = useMemo(() => years.find((y) => y.id === selectedId) ?? years[0], [years, selectedId])

  async function refresh() {
    const rows = await api.schoolYears()
    setYears(rows)
    if (!selectedId && rows[0]) setSelectedId(rows[0].id)
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message))
  }, [])

  async function createYear() {
    setError(null)
    setMessage(null)
    try {
      await api.createSchoolYear({ label: newLabel, is_active: false })
      await refresh()
      setMessage(`Année scolaire ${newLabel} créée avec ses périodes par défaut.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la création.')
    }
  }

  async function updateYear(yearId: string, payload: { is_active?: boolean; is_closed?: boolean; is_archived?: boolean }) {
    setError(null)
    setMessage(null)
    try {
      await api.updateSchoolYear(yearId, payload)
      await refresh()
      if (payload.is_active) setMessage('Année scolaire ouverte comme session active.')
      else if (payload.is_archived) setMessage('Année scolaire archivée.')
      else if (payload.is_closed) setMessage('Année scolaire clôturée et périodes fermées.')
      else setMessage('Année scolaire mise à jour.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la mise à jour.')
    }
  }

  async function togglePeriod(period: PeriodItem) {
    if (!selected) return
    setError(null)
    setMessage(null)
    try {
      await api.updatePeriod(selected.id, period.id, period.is_closed ? { is_open: true, is_closed: false } : { is_closed: true, is_open: false })
      await refresh()
      setMessage(period.is_closed ? 'Période rouverte.' : 'Période verrouillée.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la modification de la période.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="app-kicker">Paramètres scolaires</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Années scolaires et périodes</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">
              Créez les années scolaires, ouvrez la session active, fermez les périodes terminées et archivez les années passées.
              Les périodes fermées servent de base au verrouillage pédagogique des points et des bulletins.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-blue-500" placeholder="2026-2027" />
            <button onClick={createYear} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800"><Plus size={17} /> Créer</button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><CalendarDays size={22} /></div>
            <div>
              <p className="app-kicker">Sessions</p>
              <h2 className="text-xl font-black text-slate-950">Années disponibles</h2>
            </div>
          </div>
          <div className="space-y-3">
            {years.map((year) => (
              <button key={year.id} onClick={() => setSelectedId(year.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === year.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black text-slate-950">{year.label}</p>
                  <YearBadge year={year} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{year.periods.length} période(s) configurée(s)</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <p className="text-slate-500">Aucune année scolaire trouvée.</p>
          ) : (
            <div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="app-kicker">Année sélectionnée</p>
                  <h2 className="mt-1 text-3xl font-black text-slate-950">{selected.label}</h2>
                  <div className="mt-2"><YearBadge year={selected} /></div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => updateYear(selected.id, { is_active: true, is_closed: false, is_archived: false })} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700"><CheckCircle2 size={16} /> Ouvrir/Activer</button>
                  <button onClick={() => updateYear(selected.id, { is_closed: true })} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700"><Lock size={16} /> Clôturer</button>
                  <button onClick={() => updateYear(selected.id, { is_archived: true })} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"><Archive size={16} /> Archiver</button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selected.periods.map((period) => (
                  <article key={period.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{period.code}</p>
                        <h3 className="mt-1 font-black text-slate-950">{period.label}</h3>
                      </div>
                      <PeriodBadge period={period} />
                    </div>
                    <button onClick={() => togglePeriod(period)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">
                      {period.is_closed ? <><RotateCcw size={15} /> Rouvrir</> : <><Lock size={15} /> Verrouiller</>}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
