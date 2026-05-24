import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { BackupSnapshot } from '../types'

export function BackupsPage() {
  const [rows, setRows] = useState<BackupSnapshot[]>([])
  const [label, setLabel] = useState(() => `Sauvegarde ${new Date().toLocaleString()}`)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  async function refresh() { setRows(await api.backups()) }
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])
  async function create() { setError(null); setMessage(null); try { const b = await api.createBackup(label); setMessage(`Sauvegarde créée : ${b.label}`); await refresh() } catch(e) { setError(e instanceof Error ? e.message : 'Erreur sauvegarde') } }
  async function restore(id: string) { if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) return; setError(null); setMessage(null); try { const b = await api.restoreBackup(id); setMessage(`Sauvegarde restaurée : ${b.label}`); await refresh() } catch(e) { setError(e instanceof Error ? e.message : 'Erreur restauration') } }
  return <div className="space-y-6"><div><p className="app-kicker">Sauvegarde / restauration</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Protection des données</h1><p className="mt-2 text-sm text-slate-500">Snapshot JSON complet des tables du système. Réservé à la direction.</p></div>{error && <div className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>}{message && <div className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}<section className="app-card rounded-[2rem] p-5"><div className="flex flex-col gap-3 sm:flex-row"><input value={label} onChange={e => setLabel(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3"/><button onClick={create} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Créer une sauvegarde</button></div></section><div className="grid gap-3">{rows.map(r => <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{r.label}</p><p className="text-sm text-slate-500">{r.table_count} tables · {new Date(r.created_at).toLocaleString()} · {r.status}</p></div><button onClick={() => restore(r.id)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Restaurer</button></div></article>)}</div></div>
}
