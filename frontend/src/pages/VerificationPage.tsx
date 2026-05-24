import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import type { ReportVerification } from '../types'

export function VerificationPage() {
  const { cardId } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState<ReportVerification | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cardId) return
    api.verifyReportCard(cardId, params.get('version')).then(setData).catch((e) => setError(e.message))
  }, [cardId, params])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            {error ? <XCircle /> : <ShieldCheck />}
          </div>
          <h1 className="text-2xl font-bold">Vérification officielle du bulletin</h1>
          <p className="mt-1 text-sm text-slate-500">Page destinée à être reliée au portail ministériel ou au domaine officiel de l’école.</p>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
        {!error && !data && <div className="text-center text-slate-500">Vérification en cours...</div>}

        {data && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-700">Bulletin trouvé : document officiel existant dans la plateforme.</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><b>École :</b> {data.school}</div>
              <div><b>Classe :</b> {data.class_name}</div>
              <div><b>Élève :</b> {data.student_name}</div>
              <div><b>Matricule :</b> {data.student_matricule}</div>
              <div><b>Version :</b> {data.version}</div>
              <div><b>Pourcentage :</b> {data.percentage}%</div>
              <div><b>Place :</b> {data.rank ?? '-'}</div>
              <div><b>Publication :</b> {data.published_at ? new Date(data.published_at).toLocaleString() : '-'}</div>
            </div>
            <p className="rounded-xl bg-slate-50 p-4 text-slate-600">{data.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
