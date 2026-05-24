import { useEffect, useState } from 'react'
import { Download, Printer, Search } from 'lucide-react'
import { api } from '../lib/api'
import type { Student } from '../types'

function CongoFlagMini() {
  return (
    <svg viewBox="0 0 120 80" className="h-14 w-20 shadow-sm" aria-label="Drapeau RDC">
      <rect width="120" height="80" fill="#007FFF" />
      <polygon points="0,80 16,80 120,8 120,0 104,0 0,72" fill="#F7D618" />
      <polygon points="0,80 8,80 120,0 112,0" fill="#CE1021" />
      <polygon points="20,13 24,25 37,25 26,32 30,44 20,37 10,44 14,32 3,25 16,25" fill="white" />
    </svg>
  )
}

function IdBoxes({ count = 13 }: { count?: number }) {
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="block h-8 w-6 border border-slate-950 bg-transparent" />
      ))}
    </div>
  )
}

function Dots({ children }: { children: string }) {
  return (
    <div className="flex items-end gap-1 text-[15px] leading-none">
      <span className="min-w-[92px] font-medium text-slate-950">{children}</span>
      <span className="mb-[2px] flex-1 border-b border-dotted border-slate-900" />
    </div>
  )
}

export function StudentCardPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.students()
      .then((rows) => {
        setStudents(rows)
        if (rows[0]) setSelectedId(rows[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  const filteredStudents = students.filter((s) => [s.full_name, s.matricule, s.class_name].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  const student = students.find((s) => s.id === selectedId) ?? filteredStudents[0] ?? students[0]

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="app-kicker">Identité scolaire</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Carte d’élève</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Modèle imprimable proche de la carte physique : recto et verso, avec numéro ID, photo, cachet et signature.</p>
        </div>
        {students.length > 1 && (
          <div className="flex flex-col gap-3 sm:min-w-[420px]">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, matricule ou classe..." className="w-full bg-transparent outline-none" />
            </div>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.matricule}</option>)}
            </select>
          </div>
        )}
      </div>

      {!student ? (
        <div className="app-card rounded-[1.8rem] p-6 text-slate-500">Aucun élève lié à ce compte.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="mobile-card-scroll">
            <StudentCardFront student={student} />
          </div>
          <div className="mobile-card-scroll">
            <StudentCardBack student={student} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100"><Printer size={16} /> Imprimer</button>
        <button className="inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800"><Download size={16} /> PDF bientôt</button>
      </div>
    </div>
  )
}

function StudentCardFront({ student }: { student: Student }) {
  return (
    <section className="mx-auto w-full max-w-[720px] rounded-[6px] bg-[#ebe3c9] p-5 shadow-xl shadow-slate-300/70 print:shadow-none">
      <div className="min-h-[438px] border-2 border-slate-900 p-3">
        <div className="min-h-[410px] border border-slate-900 p-5">
          <div className="grid min-h-[380px] grid-cols-[1.05fr_0.95fr] gap-4">
            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-center text-[22px] font-medium leading-tight text-slate-950">REPUBLIQUE DEMOCRATIQUE DU CONGO</h2>
                <p className="mt-2 text-center text-[19px] leading-tight text-slate-900">Ministère de l’Enseignement Primaire, Secondaire<br />et Technique</p>
                <div className="mt-7 flex justify-center"><CongoFlagMini /></div>
                <div className="mt-7 text-center text-[22px] font-bold tracking-wide text-slate-950">ECOLE<span className="inline-block min-w-[260px] border-b border-dotted border-slate-900 align-middle" /></div>
              </div>
              <div>
                <div className="mt-5 flex items-end justify-center gap-4">
                  <h1 className="text-[42px] font-black uppercase leading-none tracking-[0.08em] text-slate-950">Carte d’Eleve</h1>
                  <span className="pb-1 text-[32px] font-black">N°</span>
                  <span className="min-w-[95px] border-b-2 border-dotted border-slate-950 text-center text-xl font-black">{student.matricule.slice(-4)}</span>
                </div>
                <p className="mt-4 text-center text-[21px] leading-tight text-slate-900">Valable pour l’année scolaire 20......-20......</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[20px] font-medium">N° ID</span>
                  <IdBoxes />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-between border-l border-slate-900 pl-5 text-center">
              <div className="mt-8 h-36 w-32 overflow-hidden border-2 border-slate-900 bg-[#efe8d5]">
                {student.photo_path ? <img src={student.photo_path} alt={`Photo de ${student.full_name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xl text-slate-700">Photo</div>}
              </div>
              <div className="mb-10 text-[19px] leading-tight text-slate-950">Sceau de l’Ecole<br />&<br />Signature du Chef<br />d’Etablissement</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StudentCardBack({ student }: { student: Student }) {
  return (
    <section className="mx-auto w-full max-w-[720px] rounded-[6px] bg-[#ebe3c9] p-5 shadow-xl shadow-slate-300/70 print:shadow-none">
      <div className="min-h-[438px] border-2 border-slate-900 p-3">
        <div className="min-h-[410px] border border-slate-900 p-5">
          <div className="grid min-h-[380px] grid-cols-[1fr_190px] gap-5">
            <div className="space-y-3 text-slate-950">
              <Dots>Nom</Dots>
              <p className="-mt-2 ml-[95px] text-sm font-bold uppercase">{student.full_name}</p>
              <Dots>Post-Nom</Dots>
              <Dots>Prénom</Dots>
              <Dots>Né (e)</Dots>
              <Dots>Le</Dots>
              <p className="-mt-2 ml-[95px] text-sm font-bold">{student.birth_date ? new Date(student.birth_date).toLocaleDateString('fr-FR') : ''}</p>
              <Dots>Matricule</Dots>
              <p className="-mt-2 ml-[95px] text-sm font-bold">{student.matricule}</p>
              <div className="flex items-end gap-3 text-[15px] leading-none"><span className="font-medium">Ecole</span><span className="flex-1 border-b border-dotted border-slate-900" /><span className="font-medium">Classe</span><span className="min-w-[90px] border-b border-dotted border-slate-900 text-center text-sm font-bold">{student.class_name}</span></div>
              <Dots>Section</Dots>
              <Dots>Option</Dots>
              <Dots>Adresse</Dots>
              <p className="-mt-2 ml-[95px] text-sm font-bold">{student.address ?? ''}</p>
              <Dots>Commune de</Dots>
              <div className="mt-4 flex items-end gap-2 text-[15px]"><span>Fait à Kinshasa, le</span><span className="min-w-[150px] border-b border-dotted border-slate-900" /><span>/20</span><span className="min-w-[70px] border-b border-dotted border-slate-900" /></div>
            </div>
            <div className="flex flex-col items-center justify-center gap-8">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden border-2 border-slate-900 text-3xl text-slate-800">{student.photo_path ? <img src={student.photo_path} alt={`Photo de ${student.full_name}`} className="h-full w-full object-cover" /> : "Photo"}</div>
              <p className="text-center text-[18px] leading-tight text-slate-950">Sceau de l’Ecole<br />&<br />Signature du Chef<br />d’Etablissement</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
