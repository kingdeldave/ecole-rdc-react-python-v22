import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { Camera, KeyRound, Link2, Plus, RefreshCw, Search, ShieldCheck, UserCircle, UserCog } from 'lucide-react'
import { api } from '../lib/api'
import type { ParentChildrenLink, RoleCode, Student, UserAdmin } from '../types'

const roles: Array<{ value: RoleCode; label: string }> = [
  { value: 'ADMIN_ECOLE', label: 'Secrétariat scolaire' },
  { value: 'DIRECTEUR', label: 'Directeur des études' },
  { value: 'PREFET', label: 'Préfet / Chef d’établissement' },
  { value: 'ENSEIGNANT', label: 'Professeur' },
  { value: 'COMPTABLE', label: 'Intendance / Comptabilité' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'ELEVE', label: 'Élève' },
]

const emptyForm = {
  email: '',
  full_name: '',
  phone: '',
  role: 'ENSEIGNANT' as RoleCode,
  password: 'Password123!',
  is_active: true,
}

function roleLabel(role: RoleCode) {
  return roles.find((item) => item.value === role)?.label ?? role
}

function roleClass(role: RoleCode) {
  if (role === 'DIRECTEUR' || role === 'PREFET') return 'bg-slate-950 text-white'
  if (role === 'ADMIN_ECOLE') return 'bg-blue-700 text-white'
  if (role === 'ENSEIGNANT') return 'bg-cyan-50 text-cyan-800 ring-cyan-100'
  if (role === 'COMPTABLE') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (role === 'PARENT') return 'bg-purple-50 text-purple-800 ring-purple-100'
  if (role === 'ELEVE') return 'bg-amber-50 text-amber-800 ring-amber-100'
  return 'bg-slate-100 text-slate-700'
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Lecture de la photo impossible.'))
    reader.readAsDataURL(file)
  })
}

export function UsersPage() {
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [parentLinks, setParentLinks] = useState<ParentChildrenLink[]>([])
  const [selectedParentId, setSelectedParentId] = useState('')
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [searchTerm, setSearchTerm] = useState('')
  const [childSearchTerm, setChildSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const parentUsers = useMemo(() => users.filter((user) => user.role === 'PARENT' && user.is_active), [users])

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) => [user.full_name, user.email, user.phone ?? '', roleLabel(user.role), user.role, user.is_active ? 'actif' : 'bloqué'].join(' ').toLowerCase().includes(q))
  }, [users, searchTerm])

  const filteredStudents = useMemo(() => {
    const q = childSearchTerm.trim().toLowerCase()
    if (!q) return students
    return students.filter((student) => [student.matricule, student.full_name, student.class_name, student.sex, student.birth_place ?? ''].join(' ').toLowerCase().includes(q))
  }, [students, childSearchTerm])

  const counts = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1
      return acc
    }, {})
  }, [users])

  async function loadUsers() {
    setError(null)
    const rows = await api.users()
    setUsers(rows)
    if (!selectedParentId) {
      const firstParent = rows.find((user) => user.role === 'PARENT')
      if (firstParent) setSelectedParentId(firstParent.id)
    }
  }

  async function loadParentAccess() {
    const [studentRows, linkRows] = await Promise.all([api.students(), api.parentChildrenLinks()])
    setStudents(studentRows)
    setParentLinks(linkRows)
  }

  async function loadAll() {
    await Promise.all([loadUsers(), loadParentAccess()])
  }

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const link = parentLinks.find((row) => row.parent_profile_id === selectedParentId)
    setSelectedChildIds(link?.children.map((child) => child.id) ?? [])
  }, [selectedParentId, parentLinks])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleChild(studentId: string) {
    setSelectedChildIds((prev) => prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId])
  }

  async function saveParentChildren() {
    if (!selectedParentId) return
    setError(null)
    setMessage(null)
    try {
      await api.linkParentChildren({ parent_profile_id: selectedParentId, student_ids: selectedChildIds, relationship_type: 'tuteur' })
      await loadParentAccess()
      setMessage('Enfants rattachés au parent. Le parent ne verra que ces élèves dans son espace.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant le rattachement parent/enfants')
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const created = await api.createUser(form)
      setForm(emptyForm)
      setShowForm(false)
      await loadAll()
      setMessage(`Compte créé : ${created.email}. Mot de passe initial : ${form.password}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de création du compte')
    }
  }

  async function toggleUser(user: UserAdmin) {
    setError(null)
    setMessage(null)
    try {
      await api.updateUser(user.id, { is_active: !user.is_active })
      await loadAll()
      setMessage(user.is_active ? 'Compte désactivé. La direction est alertée si l’action vient de l’administration.' : 'Compte activé. La direction est alertée si l’action vient de l’administration.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de modification')
    }
  }

  async function resetPassword(user: UserAdmin) {
    const password = window.prompt(`Nouveau mot de passe pour ${user.full_name}`, 'Password123!')
    if (!password) return
    setError(null)
    setMessage(null)
    try {
      await api.updateUser(user.id, { password })
      setMessage(`Mot de passe réinitialisé pour ${user.email}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de réinitialisation')
    }
  }

  async function updateUserPhoto(user: UserAdmin, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image valide.')
      return
    }
    if (file.size > 1_500_000) {
      setError('Photo trop lourde. Utilise une image de moins de 1,5 Mo.')
      return
    }
    setError(null)
    setMessage(null)
    try {
      const photo = await readFileAsDataUrl(file)
      await api.updateUser(user.id, { photo_path: photo })
      await loadUsers()
      setMessage(`Photo mise à jour pour ${user.full_name}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la mise à jour de la photo.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Identifiants et accès</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Utilisateurs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Créez plusieurs administrateurs, directeurs, professeurs, parents et élèves. Chaque compte peut avoir sa photo et son rôle d’accès.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800">
          <Plus size={17} /> Nouveau compte
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="app-card rounded-[1.6rem] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Direction / Préfecture</p><p className="mt-2 text-2xl font-black">{(counts.DIRECTEUR ?? 0) + (counts.PREFET ?? 0)}</p></div>
        <div className="app-card rounded-[1.6rem] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Secrétariat</p><p className="mt-2 text-2xl font-black">{counts.ADMIN_ECOLE ?? 0}</p></div>
        <div className="app-card rounded-[1.6rem] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Professeurs</p><p className="mt-2 text-2xl font-black">{counts.ENSEIGNANT ?? 0}</p></div>
        <div className="app-card rounded-[1.6rem] p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Parents / Élèves</p><p className="mt-2 text-2xl font-black">{(counts.PARENT ?? 0) + (counts.ELEVE ?? 0)}</p></div>
      </div>

      <section className="app-card rounded-[1.8rem] p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><Link2 size={22} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-950">Rattacher un parent à plusieurs élèves</h2>
            <p className="text-sm text-slate-500">Recherchez par matricule, nom, post-nom ou classe, puis cochez tous les enfants du parent.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Parent</label>
            <select value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500">
              <option value="">Choisir un parent</option>
              {parentUsers.map((parent) => <option key={parent.id} value={parent.id}>{parent.full_name} — {parent.email}</option>)}
            </select>
            <div className="rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">Sélection : {selectedChildIds.length} enfant(s). Un parent peut avoir 1, 2, 3, 4 enfants ou plus.</div>
            <button type="button" onClick={saveParentChildren} className="w-full rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800">Enregistrer les enfants du parent</button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Search size={16} />
              <input value={childSearchTerm} onChange={(e) => setChildSearchTerm(e.target.value)} placeholder="Rechercher matricule, nom, post-nom, classe..." className="w-full bg-transparent outline-none" />
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredStudents.map((student) => (
                  <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-100 hover:ring-blue-200">
                    <input type="checkbox" checked={selectedChildIds.includes(student.id)} onChange={() => toggleChild(student.id)} />
                    <span>
                      <span className="block font-black text-slate-900">{student.full_name}</span>
                      <span className="text-xs font-semibold text-slate-500">{student.matricule} · {student.class_name}</span>
                    </span>
                  </label>
                ))}
                {filteredStudents.length === 0 && <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">Aucun élève trouvé.</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-black text-slate-950">Comptes de l’établissement</h2>
            <p className="text-sm text-slate-500">Mot de passe commun de démonstration : <b>Password123!</b></p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Search size={16} />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher un utilisateur..." className="min-w-[240px] bg-transparent outline-none" />
            </div>
            <button onClick={() => loadAll()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"><RefreshCw size={15} /> Actualiser</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr><th className="px-5 py-3">Photo</th><th className="px-5 py-3">Nom</th><th className="px-5 py-3">Identifiant</th><th className="px-5 py-3">Téléphone</th><th className="px-5 py-3">Rôle</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Accès</th><th className="px-5 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                        {user.photo_path ? <img src={user.photo_path} alt={user.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><UserCircle size={22} className="text-slate-400" /></div>}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-100">
                        <Camera size={13} /> Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => updateUserPhoto(user, event)} />
                      </label>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-black text-slate-950">{user.full_name}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{user.email}</td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-600">{user.phone ?? '—'}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${roleClass(user.role)}`}>{roleLabel(user.role)}</span></td>
                  <td className="px-5 py-4"><span className={user.is_active ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{user.is_active ? 'Actif' : 'Bloqué'}</span></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><KeyRound size={14} /> Password123!</span></td>
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><button onClick={() => toggleUser(user)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">{user.is_active ? 'Désactiver' : 'Activer'}</button><button onClick={() => resetPassword(user)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">Mot de passe</button></div></td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">Aucun compte ne correspond à la recherche.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={createUser} className="w-full max-w-4xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><UserCog size={22} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Créer un identifiant</h2>
                  <p className="text-sm text-slate-500">Le compte créé apparaît immédiatement dans la liste et peut se connecter selon son rôle.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Fermer</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input required type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="email@ecole.cd" />
              <input required value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Nom complet" />
              <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Téléphone : +243..." />
              <select value={form.role} onChange={(e) => setField('role', e.target.value as RoleCode)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500">
                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <input required value={form.password} onChange={(e) => setField('password', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Mot de passe initial" />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800"><ShieldCheck size={17} /> Créer le compte</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
