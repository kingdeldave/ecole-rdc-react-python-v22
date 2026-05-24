import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { BookOpen, Camera, Clock3, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../providers/AuthProvider'
import type { ClassSubject } from '../types'

function roleLabel(role?: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_ECOLE: 'Secrétariat scolaire',
    PREFET: 'Préfet / Chef d’établissement',
    DIRECTEUR: 'Directeur des études',
    ENSEIGNANT: 'Professeur',
    COMPTABLE: 'Intendance / Comptabilité',
    PARENT: 'Parent',
    ELEVE: 'Élève',
  }
  return role ? map[role] ?? role : '—'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'))
    reader.readAsDataURL(file)
  })
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [preview, setPreview] = useState<string | null>(user?.photo_path ?? null)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [program, setProgram] = useState<ClassSubject[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const teacherCourses = useMemo(() => program.filter((row) => user?.role !== 'ENSEIGNANT' || row.teacher_id === user.id), [program, user])

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name)
    setPhone(user.phone ?? '')
    setPreview(user.photo_path ?? null)
    api.classSubjectProgram().then(setProgram).catch(() => setProgram([]))
  }, [user])

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image valide.')
      return
    }
    if (file.size > 1_500_000) {
      setError('Image trop lourde. Utilise une image de moins de 1,5 Mo.')
      return
    }
    setError(null)
    setPreview(await readFileAsDataUrl(file))
  }

  async function saveProfile() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await updateProfile({ full_name: fullName.trim(), phone: phone.trim(), photo_path: preview })
      setMessage('Profil mis à jour : nom, numéro et photo enregistrés.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur pendant la mise à jour.'
      setError(msg === 'Failed to fetch' ? 'Impossible de joindre le backend. Vérifie que FastAPI tourne sur http://localhost:8000.' : msg)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <p className="app-kicker">Profil connecté</p>
        <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Mon profil</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          Chaque utilisateur peut mettre sa photo, corriger son nom et ajouter son numéro. Pour les professeurs, les cours, classes et horaires sont affichés automatiquement.
        </p>
      </div>

      <section className="app-card overflow-hidden rounded-[2rem]">
        <div className="grid gap-0 lg:grid-cols-[390px_1fr]">
          <div className="bg-[#0b2a5b] p-8 text-white">
            <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-[2rem] bg-white/10 ring-1 ring-white/20">
              {preview ? <img src={preview} alt={user.full_name} className="h-full w-full object-cover" /> : <UserRound size={80} className="text-white/80" />}
            </div>
            <div className="mt-5 text-center">
              <p className="text-xl font-black">{fullName || user.full_name}</p>
              <p className="mt-1 text-sm text-blue-100">{roleLabel(user.role)}</p>
              {phone && <p className="mt-1 text-sm font-semibold text-blue-50">{phone}</p>}
            </div>
            <label className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#0b2a5b] hover:bg-blue-50">
              <Camera size={18} /> Choisir une photo
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            {preview && <button onClick={() => setPreview(null)} className="mt-3 w-full rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15">Retirer la photo</button>}
          </div>

          <div className="p-8">
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-emerald-600" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Compte sécurisé</p>
                  <h2 className="text-2xl font-black text-slate-950">{user.full_name}</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Nom affiché</p>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500" />
                </label>
                <label className="rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Numéro de téléphone</p>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+243..." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500" />
                </label>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Identifiant</p><p className="mt-2 flex items-center gap-2 font-mono text-sm text-slate-700"><Mail size={16} /> {user.email}</p></div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Rôle</p><p className="mt-2 font-black text-slate-900">{roleLabel(user.role)}</p></div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Statut</p><p className="mt-2 font-black text-emerald-700">{user.is_active ? 'Actif' : 'Désactivé'}</p></div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">École</p><p className="mt-2 font-black text-slate-900">Établissement rattaché</p></div>
              </div>
              <button onClick={saveProfile} disabled={saving} className="mt-6 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer mon profil'}
              </button>
            </div>
            {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
            {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}
          </div>
        </div>
      </section>

      <section className="app-card rounded-[1.8rem] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><BookOpen size={22} /></div>
          <div>
            <p className="app-kicker">Programme visible</p>
            <h2 className="text-2xl font-black text-slate-950">Cours, professeurs et horaires</h2>
            <p className="text-sm text-slate-500">
              {user.role === 'ENSEIGNANT' ? 'Voici les cours que tu donnes dans chaque classe.' : user.role === 'ELEVE' ? 'Voici tes cours et horaires. Les coordonnées des professeurs ne sont pas affichées dans l’espace élève.' : 'Voici les cours accessibles à ce profil avec le professeur et son numéro.'}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teacherCourses.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{item.class_name ?? 'Classe'} · {item.subject_name}</p>
              <h3 className="mt-2 font-black text-slate-950">{item.teacher_name ?? user.full_name}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Clock3 size={15} /> {item.schedule_label ?? 'Horaire à compléter'}</p>
                {user.role !== 'ELEVE' && <p className="flex items-center gap-2"><Phone size={15} /> {item.teacher_phone ?? phone ?? 'Numéro à compléter'}</p>}
              </div>
            </article>
          ))}
          {teacherCourses.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucun cours rattaché à ce profil pour le moment.</p>}
        </div>
      </section>
    </div>
  )
}
