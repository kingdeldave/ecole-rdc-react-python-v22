import { useEffect, useState } from 'react'
import { api, getToken } from '../lib/api'
import type { ClassRoom, ReportCard } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../providers/AuthProvider'

const directionRoles = new Set(['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'COMPTABLE'])
const publishRoles = new Set(['SUPER_ADMIN', 'PREFET', 'DIRECTEUR'])

export function ReportCardsPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [classId, setClassId] = useState('')
  const [cards, setCards] = useState<ReportCard[]>([])
  const [selected, setSelected] = useState<ReportCard | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.classes().then((rows) => {
      setClasses(rows)
      if (rows[0]) setClassId(rows[0].id)
      if (!rows[0]) refresh('')
    }).catch((e) => setError(e.message))
  }, [])

  async function refresh(targetClassId = classId) {
    const rows = await api.reportCards(targetClassId || undefined)
    setCards(rows)
    if (selected) setSelected(rows.find((r) => r.id === selected.id) ?? null)
  }

  useEffect(() => {
    if (!classId && classes.length > 0) return
    refresh(classId).catch((e) => setError(e.message))
  }, [classId])

  async function generate() {
    setError(null)
    setMessage(null)
    try {
      const rows = await api.generateClassReportCards(classId)
      setCards(rows)
      setMessage(`${rows.length} bulletin(s) généré(s).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function validate(cardId: string) {
    try {
      await api.validateReportCard(cardId)
      await refresh()
      setMessage('Bulletin validé par la direction.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de validation')
    }
  }

  async function publish(cardId: string) {
    try {
      await api.publishReportCard(cardId)
      await refresh()
      setMessage('Bulletin publié au parent et verrouillé.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de publication')
    }
  }

  async function block(cardId: string, blocked: boolean) {
    const reason = window.prompt(blocked ? 'Motif du blocage financier :' : 'Motif du déblocage :', blocked ? 'Frais scolaires non régularisés' : 'Paiement régularisé')
    if (!reason) return
    try {
      await api.setReportPaymentBlock(cardId, blocked, reason)
      await refresh()
      setMessage(blocked ? 'Bulletin bloqué et parent notifié.' : 'Bulletin débloqué et parent notifié.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  function download(cardId: string) {
    const token = getToken()
    fetch(api.reportCardDownloadUrl(cardId), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).detail ?? 'Téléchargement impossible')
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bulletin-${cardId}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((e) => setError(e.message))
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold">Bulletins officiels</h1>
          <p className="text-slate-500">Validation direction, blocage financier, publication verrouillée et PDF avec QR code de vérification.</p>
        </div>
        {user && directionRoles.has(user.role) && (
          <div className="flex gap-3">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={generate} className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">Générer classe</button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-700">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_480px]">
        <div className="mobile-table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">%</th>
                <th className="px-4 py-3">Place</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((card) => (
                <tr key={card.id}>
                  <td className="px-4 py-3 font-medium">{card.student_name}</td>
                  <td className="px-4 py-3">{card.percentage}%</td>
                  <td className="px-4 py-3">{card.rank ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={card.payment_blocked ? 'BLOCKED' : card.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelected(card)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-100">Voir</button>
                      {user && publishRoles.has(user.role) && <button onClick={() => validate(card.id)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">Valider</button>}
                      {user && publishRoles.has(user.role) && <button onClick={() => publish(card.id)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">Publier</button>}
                      {user && directionRoles.has(user.role) && !card.payment_blocked && <button onClick={() => block(card.id, true)} className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">Bloquer</button>}
                      {user && directionRoles.has(user.role) && card.payment_blocked && <button onClick={() => block(card.id, false)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">Débloquer</button>}
                      <button onClick={() => download(card.id)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-white">PDF</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <div className="text-slate-500">Sélectionne un bulletin pour prévisualiser.</div>
          ) : (
            <div className="print-bulletin">
              <div className="text-center text-sm font-bold">REPUBLIQUE DEMOCRATIQUE DU CONGO</div>
              <div className="text-center text-xs">MINISTERE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET TECHNIQUE</div>
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-center text-xs text-blue-900">
                <b>Bulletin officiel de l'État</b><br />
                QR code intégré dans le PDF pour vérifier l'existence du bulletin et limiter les faux bulletins.
              </div>
              <div className="mt-3 text-center font-bold">{selected.snapshot_json?.school?.name}</div>
              <div className="mt-2 text-sm"><b>Élève :</b> {selected.student_name}</div>
              <div className="text-sm"><b>Classe :</b> {selected.class_name}</div>
              <div className="text-sm"><b>Version :</b> {selected.version} — <b>Verrouillé :</b> {selected.locked ? 'Oui' : 'Non'}</div>
              <div className="mt-3 overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-blue-700 text-white">
                      <th className="border p-1">Branches</th><th className="border p-1">P1</th><th className="border p-1">P2</th><th className="border p-1">EX1</th><th className="border p-1">S1</th><th className="border p-1">P3</th><th className="border p-1">P4</th><th className="border p-1">EX2</th><th className="border p-1">S2</th><th className="border p-1">Rattr.</th><th className="border p-1">TENASOP</th><th className="border p-1">BAC</th><th className="border p-1">TG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.snapshot_json?.lines?.map((line: any) => (
                      <tr key={line.subject_id}>
                        <td className="border p-1">{line.subject_name}</td>
                        <td className="border p-1 text-center">{line.p1 ?? ''}</td>
                        <td className="border p-1 text-center">{line.p2 ?? ''}</td>
                        <td className="border p-1 text-center">{line.ex1 ?? ''}</td>
                        <td className="border p-1 text-center font-semibold">{line.s1_total}</td>
                        <td className="border p-1 text-center">{line.p3 ?? ''}</td>
                        <td className="border p-1 text-center">{line.p4 ?? ''}</td>
                        <td className="border p-1 text-center">{line.ex2 ?? ''}</td>
                        <td className="border p-1 text-center font-semibold">{line.s2_total}</td>
                        <td className="border p-1 text-center">{line.rattrapage ?? ''}</td>
                        <td className="border p-1 text-center">{line.tenasop ?? ''}</td>
                        <td className="border p-1 text-center">{line.bac ?? ''}</td>
                        <td className="border p-1 text-center font-semibold">{line.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>Total ordinaire : <b>{selected.snapshot_json?.ordinary_total ?? 0}/{selected.snapshot_json?.ordinary_max_total ?? 0}</b></div>
                <div>Rattrapage : <b>{selected.snapshot_json?.rattrapage_total ?? 0}/{selected.snapshot_json?.rattrapage_max_total ?? 0}</b></div>
                <div>TENASOP : <b>{selected.snapshot_json?.tenasop_total ?? 0}/{selected.snapshot_json?.tenasop_max_total ?? 0}</b></div>
                <div>BAC : <b>{selected.snapshot_json?.bac_total ?? 0}/{selected.snapshot_json?.bac_max_total ?? 0}</b></div>
                <div>Total général : <b>{selected.total}/{selected.max_total}</b></div>
                <div>Pourcentage : <b>{selected.percentage}%</b></div>
                <div>Place : <b>{selected.rank ?? '-'}</b></div>
                <div>Décision : <b>{selected.decision}</b></div>
              </div>
              {selected.payment_blocked && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">Bulletin bloqué pour frais scolaires non régularisés. Veuillez contacter l’administration de l’école.</p>}
              <p className="mt-4 text-xs text-slate-500">Document scolaire confidentiel — usage réservé au parent ou tuteur légal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
