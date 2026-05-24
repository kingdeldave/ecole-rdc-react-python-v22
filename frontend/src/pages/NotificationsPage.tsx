import { useEffect, useState } from 'react'
import { Mail, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import type { NotificationItem } from '../types'

export function NotificationsPage() {
  const [rows, setRows] = useState<NotificationItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      setRows(await api.notifications())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Centre de messages</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Notifications</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Les parents reçoivent les alertes dans le portail et par email lorsque l’adresse est disponible. En développement local, l’envoi email est simulé si aucun SMTP n’est configuré.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Actualiser</button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}

      <div className="space-y-3">
        {rows.map((n) => (
          <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="font-black text-slate-950">{n.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{n.message}</p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{n.type}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <span>{new Date(n.created_at).toLocaleString()}</span>
              {n.email_to && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"><Mail size={13} /> Email : {n.email_status ?? 'préparé'} → {n.email_to}</span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-xl bg-white p-4 text-slate-500">Aucune notification.</div>}
      </div>
    </div>
  )
}
