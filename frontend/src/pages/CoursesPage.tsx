import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Clock3, Phone, Plus, Save, Settings2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { ClassRoom, ClassSubject, CourseResource, UserAdmin } from '../types'

const canPublishRoles = new Set(['ENSEIGNANT', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'SUPER_ADMIN'])
const canManageSubjects = new Set(['ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'SUPER_ADMIN'])
const maximaOptions = [0, 5, 10, 20, 40, 50, 80, 100]

type MaximaForm = {
  max_p1: number
  max_p2: number
  max_ex1: number
  max_p3: number
  max_p4: number
  max_ex2: number
  max_rattrapage: number
  max_tenasop: number
  max_bac: number
}

const defaultMaxima: MaximaForm = {
  max_p1: 10,
  max_p2: 10,
  max_ex1: 20,
  max_p3: 10,
  max_p4: 10,
  max_ex2: 20,
  max_rattrapage: 20,
  max_tenasop: 40,
  max_bac: 40,
}

function MaxSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-blue-500">
        {maximaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  )
}

export function CoursesPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [subjects, setSubjects] = useState<ClassSubject[]>([])
  const [resources, setResources] = useState<CourseResource[]>([])
  const [program, setProgram] = useState<ClassSubject[]>([])
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [classId, setClassId] = useState('')
  const [classSubjectId, setClassSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectCategory, setNewSubjectCategory] = useState('Général')
  const [newSubjectTeacherId, setNewSubjectTeacherId] = useState('')
  const [newSubjectSchedule, setNewSubjectSchedule] = useState('')
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [newSubjectMaxima, setNewSubjectMaxima] = useState<MaximaForm>(defaultMaxima)
  const [selectedMaxima, setSelectedMaxima] = useState<MaximaForm>(defaultMaxima)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedClassSubject = useMemo(() => subjects.find((item) => item.id === classSubjectId), [subjects, classSubjectId])
  const canManage = !!user && canManageSubjects.has(user.role)
  const teachers = users.filter((row) => row.role === 'ENSEIGNANT' && row.is_active)

  async function loadResources() {
    setResources(await api.courseResources())
  }

  async function loadSubjects(targetClassId = classId) {
    if (!targetClassId) return
    const rows = await api.classSubjects(targetClassId)
    setSubjects(rows)
    if (rows[0] && !rows.some((row) => row.id === classSubjectId)) setClassSubjectId(rows[0].id)
    return rows
  }

  useEffect(() => {
    Promise.all([api.classes(), api.courseResources(), api.users().catch(() => []), api.classSubjectProgram().catch(() => [])])
      .then(([classRows, resourceRows, userRows, programRows]) => {
        setClasses(classRows)
        setResources(resourceRows)
        setUsers(userRows)
        setProgram(programRows)
        const firstTeacher = userRows.find((row) => row.role === 'ENSEIGNANT')
        if (firstTeacher) setNewSubjectTeacherId(firstTeacher.id)
        if (classRows[0]) setClassId(classRows[0].id)
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!classId) return
    loadSubjects(classId).catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  useEffect(() => {
    if (!selectedClassSubject) return
    setSelectedMaxima({
      max_p1: selectedClassSubject.max_p1,
      max_p2: selectedClassSubject.max_p2,
      max_ex1: selectedClassSubject.max_ex1,
      max_p3: selectedClassSubject.max_p3,
      max_p4: selectedClassSubject.max_p4,
      max_ex2: selectedClassSubject.max_ex2,
      max_rattrapage: selectedClassSubject.max_rattrapage,
      max_tenasop: selectedClassSubject.max_tenasop,
      max_bac: selectedClassSubject.max_bac,
    })
    setSelectedSchedule(selectedClassSubject.schedule_label ?? '')
  }, [selectedClassSubject])

  async function publishCourse() {
    setError(null)
    setMessage(null)
    try {
      if (!classSubjectId) throw new Error('Choisis une branche.')
      await api.createCourseResource({ class_subject_id: classSubjectId, title, description, url, content, resource_type: 'lesson', is_published: true })
      setTitle('')
      setDescription('')
      setUrl('')
      setContent('')
      await loadResources()
      setMessage('Cours publié en ligne.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function addSubjectToClass() {
    setError(null)
    setMessage(null)
    try {
      if (!classId) throw new Error('Choisis une classe.')
      if (!newSubjectName.trim()) throw new Error('Nom du cours obligatoire.')
      await api.createClassSubject({
        class_id: classId,
        subject_name: newSubjectName.trim(),
        category: newSubjectCategory.trim() || 'Général',
        teacher_id: newSubjectTeacherId || undefined,
        schedule_label: newSubjectSchedule.trim() || undefined,
        ...newSubjectMaxima,
        display_order: subjects.length + 1,
      })
      setNewSubjectName('')
      setNewSubjectCategory('Général')
      setNewSubjectTeacherId(teachers[0]?.id ?? '')
      setNewSubjectSchedule('')
      setNewSubjectMaxima(defaultMaxima)
      await loadSubjects(classId)
      setProgram(await api.classSubjectProgram())
      setMessage('Nouveau cours ajouté à la classe. Il apparaîtra dans les points, le bulletin et le programme des professeurs.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant l’ajout du cours')
    }
  }

  async function saveMaxima() {
    setError(null)
    setMessage(null)
    try {
      if (!classSubjectId) throw new Error('Choisis un cours.')
      await api.updateClassSubjectMaxima(classSubjectId, { ...selectedMaxima, schedule_label: selectedSchedule })
      await loadSubjects(classId)
      setProgram(await api.classSubjectProgram())
      setMessage('Maxima mis à jour. Les prochains calculs de points/bulletins suivront ces valeurs.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la modification des maxima')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Cours et branches</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Gestion des cours</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Ajoutez un cours qui n’existe pas encore, définissez ses maxima sur 10, 20 ou 40, puis publiez les leçons en ligne. Les sessions rattrapage, TENASOP et BAC sont prises en compte dans les bulletins.
          </p>
        </div>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.level}</option>)}
        </select>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      {canManage && (
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="app-card rounded-[1.8rem] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-blue-700 p-3 text-white"><Plus size={22} /></div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Ajouter un nouveau cours à la classe</h2>
                <p className="text-sm text-slate-500">Exemple : SVT n’est pas dans la liste, l’école peut l’ajouter ici.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Nom du cours : SVT" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
              <input value={newSubjectCategory} onChange={(e) => setNewSubjectCategory(e.target.value)} placeholder="Catégorie" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
              <select value={newSubjectTeacherId} onChange={(e) => setNewSubjectTeacherId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 md:col-span-2">
                <option value="">Aucun professeur assigné</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} — {teacher.email}</option>)}
              </select>
              <input value={newSubjectSchedule} onChange={(e) => setNewSubjectSchedule(e.target.value)} placeholder="Horaire : Lundi 08h00-09h00" className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 md:col-span-2" />
              <MaxSelect label="P1" value={newSubjectMaxima.max_p1} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_p1: v }))} />
              <MaxSelect label="P2" value={newSubjectMaxima.max_p2} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_p2: v }))} />
              <MaxSelect label="Examen S1" value={newSubjectMaxima.max_ex1} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_ex1: v }))} />
              <MaxSelect label="P3" value={newSubjectMaxima.max_p3} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_p3: v }))} />
              <MaxSelect label="P4" value={newSubjectMaxima.max_p4} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_p4: v }))} />
              <MaxSelect label="Examen S2" value={newSubjectMaxima.max_ex2} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_ex2: v }))} />
              <MaxSelect label="Rattrapage" value={newSubjectMaxima.max_rattrapage} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_rattrapage: v }))} />
              <MaxSelect label="TENASOP" value={newSubjectMaxima.max_tenasop} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_tenasop: v }))} />
              <MaxSelect label="BAC" value={newSubjectMaxima.max_bac} onChange={(v) => setNewSubjectMaxima((p) => ({ ...p, max_bac: v }))} />
            </div>
            <button onClick={addSubjectToClass} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800"><Plus size={17} /> Ajouter le cours</button>
          </div>

          <div className="app-card rounded-[1.8rem] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white"><Settings2 size={22} /></div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Modifier les maxima</h2>
                <p className="text-sm text-slate-500">La direction peut adapter les maxima à 10, 20 ou 40, y compris le rattrapage, le TENASOP et le BAC.</p>
              </div>
            </div>
            <select value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)} className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
            <input value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)} placeholder="Horaire du cours : Mardi 10h00-11h00" className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500" />
            <div className="grid gap-4 md:grid-cols-3">
              <MaxSelect label="P1" value={selectedMaxima.max_p1} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_p1: v }))} />
              <MaxSelect label="P2" value={selectedMaxima.max_p2} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_p2: v }))} />
              <MaxSelect label="Examen S1" value={selectedMaxima.max_ex1} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_ex1: v }))} />
              <MaxSelect label="P3" value={selectedMaxima.max_p3} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_p3: v }))} />
              <MaxSelect label="P4" value={selectedMaxima.max_p4} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_p4: v }))} />
              <MaxSelect label="Examen S2" value={selectedMaxima.max_ex2} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_ex2: v }))} />
              <MaxSelect label="Rattrapage" value={selectedMaxima.max_rattrapage} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_rattrapage: v }))} />
              <MaxSelect label="TENASOP" value={selectedMaxima.max_tenasop} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_tenasop: v }))} />
              <MaxSelect label="BAC" value={selectedMaxima.max_bac} onChange={(v) => setSelectedMaxima((p) => ({ ...p, max_bac: v }))} />
            </div>
            <button onClick={saveMaxima} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800"><Save size={17} /> Enregistrer les maxima</button>
          </div>
        </section>
      )}

      {user && canPublishRoles.has(user.role) && (
        <div className="app-card rounded-[1.8rem] p-6">
          <div className="mb-5 flex items-center gap-3"><BookOpen className="text-blue-700" /><h2 className="text-xl font-black text-slate-950">Publier un cours en ligne</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={classSubjectId} onChange={(e) => setClassSubjectId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du cours" className="rounded-xl border border-slate-200 px-3 py-2" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien vidéo/PDF optionnel" className="rounded-xl border border-slate-200 px-3 py-2" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 md:col-span-2" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu du cours / consignes" className="min-h-32 rounded-xl border border-slate-200 px-3 py-2 md:col-span-2" />
          </div>
          <button onClick={publishCourse} className="mt-4 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Publier le cours</button>
        </div>
      )}

      <section className="app-card rounded-[1.8rem] p-6">
        <div className="mb-5 flex items-center gap-3">
          <BookOpen className="text-blue-700" />
          <div>
            <p className="app-kicker">Programme des cours</p>
            <h2 className="text-xl font-black text-slate-950">Cours, classes, professeurs et heures</h2>
            <p className="text-sm text-slate-500">Les parents voient les cours de leurs enfants avec les contacts autorisés. Les élèves voient les cours et horaires sans numéro ni email des professeurs. Chaque professeur voit uniquement ses propres cours.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {program.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{item.class_name ?? 'Classe'} · {item.subject_name}</p>
              <h3 className="mt-2 font-black text-slate-950">{item.teacher_name ?? 'Professeur non assigné'}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Clock3 size={15} /> {item.schedule_label ?? 'Horaire à compléter'}</p>
                {user?.role !== 'ELEVE' && <p className="flex items-center gap-2"><Phone size={15} /> {item.teacher_phone ?? 'Numéro à compléter'}</p>}
              </div>
            </article>
          ))}
          {program.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucun cours visible pour ce profil.</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {resources.map((r) => (
          <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{r.title}</h2>
                <p className="text-sm text-slate-500">{r.class_name} — {r.subject_name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{user?.role === 'ELEVE' ? `Cours : ${r.teacher_name ?? r.created_by_name ?? 'école'} · ${r.schedule_label ?? 'horaire à compléter'}` : `Prof : ${r.teacher_name ?? r.created_by_name ?? 'école'} · ${r.teacher_phone ?? 'numéro à compléter'} · ${r.schedule_label ?? 'horaire à compléter'}`}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{r.resource_type}</span>
            </div>
            {r.description && <p className="mt-3 text-sm text-slate-700">{r.description}</p>}
            {r.content && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{r.content}</p>}
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">Ouvrir la ressource</a>}
            <p className="mt-3 text-xs text-slate-400">Publié par {r.created_by_name ?? 'école'} le {new Date(r.created_at).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
