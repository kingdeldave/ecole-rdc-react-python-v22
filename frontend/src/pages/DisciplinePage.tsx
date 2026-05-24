import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { DisciplinaryAction, Student } from '../types'

const canCreate = new Set(['ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'SUPER_ADMIN'])

export function DisciplinePage() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [actions, setActions] = useState<DisciplinaryAction[]>([])
  const [studentId, setStudentId] = useState('')
  const [actionType, setActionType] = useState('avertissement')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const [studentRows, actionRows] = await Promise.all([api.students(), api.disciplinaryActions()])
    setStudents(studentRows)
    setActions(actionRows)
    if (studentRows[0] && !studentId) setStudentId(studentRows[0].id)
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message))
  }, [])

  async function save() {
    setError(null)
    setMessage(null)
    try {
      await api.createDisciplinaryAction({ student_id: studentId, action_type: actionType, reason })
      setReason('')
      await refresh()
      setMessage('Sanction enregistrée et notification envoyée au parent.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Discipline</h1>
        <p className="text-slate-500">Suspension, renvoi, avertissement et notification automatique aux parents.</p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-700">{message}</div>}

      {user && canCreate.has(user.role) && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Créer une sanction</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.class_name}</option>)}
            </select>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="avertissement">Avertissement</option>
              <option value="suspension">Suspension</option>
              <option value="renvoi">Renvoi</option>
              <option value="convocation">Convocation</option>
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif obligatoire" className="rounded-xl border border-slate-200 px-3 py-2" />
          </div>
          <button onClick={save} className="mt-4 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Notifier le parent</button>
        </div>
      )}

      <div className="mobile-table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th className="px-4 py-3">Élève</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actions.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">{a.student_name}</td>
                <td className="px-4 py-3">{a.action_type}</td>
                <td className="px-4 py-3">{a.reason}</td>
                <td className="px-4 py-3">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
