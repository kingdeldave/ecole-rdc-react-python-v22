import { useEffect, useState } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import type { AuditLog } from '../types'

function previewValue(value?: Record<string, unknown> | null) {
  if (!value) return '—'
  const keys = Object.keys(value).slice(0, 4)
  if (keys.length === 0) return '—'
  return keys.map((key) => `${key}: ${String(value[key]).slice(0, 32)}`).join(' · ')
}

export function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const data = await api.auditLogs()
    setRows(data)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function restore(row: AuditLog) {
    if (!window.confirm('Restaurer cette modification administrative ?')) return
    setError(null)
    setMessage(null)
    try {
      const res = await api.restoreAuditLog(row.id)
      setMessage(res.message)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restauration impossible')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="app-kicker">Contrôle direction</p>
        <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Audit et restaurations</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          Les actions sensibles de l’administration sont visibles ici. La direction peut restaurer une modification non autorisée. Les actions du Préfet restent sous autorité de la préfecture.
        </p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><ShieldAlert size={22} /></div>
          <div>
            <h2 className="font-black text-slate-950">Journal des actions sensibles</h2>
            <p className="text-sm text-slate-500">Restaurer est réservé au Directeur, Préfet ou Super Admin.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Entité</th>
                <th className="px-4 py-3">Avant</th>
                <th className="px-4 py-3">Après</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Contrôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{row.action}</td>
                  <td className="px-4 py-3">{row.user_role ?? '-'}</td>
                  <td className="px-4 py-3">{row.entity_type ?? '-'} {row.entity_id ? `#${row.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{previewValue(row.old_value)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{previewValue(row.new_value)}</td>
                  <td className="px-4 py-3">{row.reason ?? '-'}</td>
                  <td className="px-4 py-3">
                    {row.can_restore ? (
                      <button onClick={() => restore(row)} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">
                        <RotateCcw size={14} /> Restaurer
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Non restaurable</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">Aucune action trouvée.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
