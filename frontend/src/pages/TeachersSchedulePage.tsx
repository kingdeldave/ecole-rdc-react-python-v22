import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Clock3, Mail, Phone, Search, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { TeacherSchedule } from '../types'

function roleIntro(role?: string) {
  if (role === 'ENSEIGNANT') return 'Tes cours sont regroupés par classe avec les horaires et les maxima utilisés pour les points.'
  if (role === 'PARENT') return 'Voici les professeurs qui interviennent dans les classes de tes enfants, avec leurs numéros et horaires.'
  if (role === 'ELEVE') return 'Voici les cours de ta classe avec les horaires. Les numéros et emails des professeurs ne sont pas visibles dans l’espace élève.'
  return 'Vue complète des professeurs, cours, classes et horaires de l’établissement.'
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'PR'
}

export function TeachersSchedulePage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<TeacherSchedule[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.teacherSchedule())
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement.'
      setError(msg === 'Failed to fetch' ? 'Impossible de joindre le backend. Vérifie que FastAPI est lancé sur le port 8000.' : msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((teacher) => {
      const haystack = [
        teacher.teacher_name,
        user?.role === 'ELEVE' ? '' : (teacher.teacher_email ?? ''),
        user?.role === 'ELEVE' ? '' : (teacher.teacher_phone ?? ''),
        ...teacher.courses.flatMap((c) => [c.class_name, c.subject_name, c.schedule_label ?? '', c.category ?? '']),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Professeurs, cours et horaires</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Programme pédagogique</h1>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">{roleIntro(user?.role)}</p>
        </div>
        <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">
          Actualiser
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}

      <section className="app-card rounded-[1.8rem] p-5">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={user?.role === 'ELEVE' ? 'Rechercher cours, classe ou horaire...' : 'Rechercher professeur, cours, classe, horaire, numéro...'}
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {filtered.map((teacher) => (
          <article key={teacher.teacher_id} className="app-card overflow-hidden rounded-[2rem]">
            <div className="grid gap-0 md:grid-cols-[220px_1fr]">
              <div className="bg-[#0b2a5b] p-6 text-white">
                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-white/10 ring-1 ring-white/20">
                  {teacher.teacher_photo_path ? (
                    <img src={teacher.teacher_photo_path} alt={teacher.teacher_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black tracking-tight text-white/90">{initials(teacher.teacher_name)}</span>
                  )}
                </div>
                <h2 className="mt-4 text-center text-xl font-black leading-tight">{teacher.teacher_name}</h2>
                {user?.role !== 'ELEVE' ? (
                  <div className="mt-4 space-y-2 text-sm text-blue-50">
                    <p className="flex items-center justify-center gap-2"><Phone size={15} /> {teacher.teacher_phone ?? 'Numéro à compléter'}</p>
                    <p className="flex items-center justify-center gap-2 break-all"><Mail size={15} /> {teacher.teacher_email ?? 'Email non défini'}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-white/10 p-3 text-center text-xs font-bold leading-5 text-blue-50">
                    Coordonnées masquées pour les élèves.
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">{teacher.course_count}</p><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-100">Cours</p></div>
                  <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">{teacher.classes_count}</p><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-100">Classes</p></div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><BookOpen size={22} /></div>
                  <div>
                    <p className="app-kicker">Cours assurés</p>
                    <p className="text-sm text-slate-500">Classe, matière, horaire et maxima principaux.</p>
                  </div>
                </div>
                <div className="max-h-[410px] space-y-3 overflow-y-auto pr-1">
                  {teacher.courses.map((course) => (
                    <div key={course.class_subject_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{course.class_name}</p>
                          <h3 className="mt-1 font-black text-slate-950">{course.subject_name}</h3>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{course.category ?? 'Général'}</span>
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600"><Clock3 size={15} /> {course.schedule_label ?? 'Horaire à compléter'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600">
                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Période: {course.max_p1}/{course.max_p2}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Examens: {course.max_ex1}/{course.max_ex2}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Rattrapage: {course.max_rattrapage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Aucun professeur ou cours trouvé pour ce profil.</div>
      )}
    </div>
  )
}
