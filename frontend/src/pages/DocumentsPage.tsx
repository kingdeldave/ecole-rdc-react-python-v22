import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AdministrativeDocument, Student } from '../types'

const docTypes = [
  ['attestation_frequentation', 'Attestation de fréquentation'],
  ['certificat_scolarite', 'Certificat de scolarité'],
  ['fiche_inscription', "Fiche d’inscription"],
  ['attestation_bonne_conduite', 'Attestation de bonne conduite'],
]

export function DocumentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [docs, setDocs] = useState<AdministrativeDocument[]>([])
  const [studentId, setStudentId] = useState('')
  const [type, setType] = useState('attestation_frequentation')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  async function refresh() { const [s, d] = await Promise.all([api.students(), api.documents()]); setStudents(s); setDocs(d); if (!studentId && s[0]) setStudentId(s[0].id) }
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])
  async function generate() { setError(null); setMessage(null); try { const d = await api.createDocument({ student_id: studentId, document_type: type }); setMessage(`${d.title} généré : ${d.document_number}`); await refresh() } catch(e) { setError(e instanceof Error ? e.message : 'Erreur document') } }
  return <div className="space-y-6"><div><p className="app-kicker">Documents administratifs</p><h1 className="mobile-page-title mt-2 text-4xl font-black text-slate-950">Attestations, certificats et fiches</h1><p className="mt-2 text-sm text-slate-500">Chaque document PDF possède un numéro unique et un QR code de vérification.</p></div>{error && <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}{message && <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">{message}</div>}<section className="app-card rounded-[2rem] p-5"><div className="grid gap-3 md:grid-cols-3"><select value={studentId} onChange={e => setStudentId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{students.map(s => <option key={s.id} value={s.id}>{s.matricule} — {s.full_name}</option>)}</select><select value={type} onChange={e => setType(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">{docTypes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><button onClick={generate} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white">Générer le PDF</button></div></section><div className="grid gap-3 md:grid-cols-2">{docs.map(d => <article key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{d.document_number}</p><h3 className="mt-2 font-black text-slate-950">{d.title}</h3><p className="text-sm text-slate-500">{d.matricule} — {d.student_name}</p><a href={api.documentDownloadUrl(d.id)} target="_blank" className="mt-3 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Télécharger</a></article>)}</div></div>
}
