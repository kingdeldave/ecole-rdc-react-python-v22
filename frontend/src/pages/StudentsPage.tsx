import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, Download, FileSpreadsheet, LockKeyhole, Pencil, Plus, RefreshCw, Search, Trash2, UnlockKeyhole, Upload, UserRoundPlus } from 'lucide-react'
import { api } from '../lib/api'
import type { ClassRoom, Student } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../providers/AuthProvider'

const managementRoles = new Set(['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'])
const financeRoles = new Set(['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'COMPTABLE'])

const emptyForm = {
  matricule: '',
  last_name: '',
  middle_name: '',
  first_name: '',
  sex: 'M' as 'M' | 'F',
  birth_date: '',
  birth_place: '',
  address: '',
}

type BulkStudentRow = {
  matricule: string
  last_name: string
  middle_name?: string
  first_name?: string
  sex: 'M' | 'F'
  birth_date?: string
  birth_place?: string
  address?: string
  observations?: string
}

const pasteExample = `matricule\tnom\tpost_nom\tprenom\tsexe\tdate_naissance\tlieu_naissance\tadresse
MAT-001\tKABONGO\tMULUMBA\tJean\tM\t2012-05-14\tKinshasa\tMatonge
MAT-002\tMBUYI\tKALALA\tSarah\tF\t2013-03-02\tKinshasa\tLingwala`

function paymentLabel(student: Student) {
  if (student.payment_status === 'EN_ORDRE') return 'En ordre'
  if (student.payment_status === 'PARTIEL') return 'Partiel'
  if (student.payment_status === 'EXEMPTION') return 'Exemption'
  return 'Non payé'
}

function paymentClasses(student: Student) {
  if (!student.payment_blocked) return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (student.payment_status === 'PARTIEL') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-red-50 text-red-700 ring-red-100'
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function normalizeSex(value?: string): 'M' | 'F' {
  const raw = (value ?? '').trim().toUpperCase()
  if (['F', 'FEMININ', 'FÉMININ', 'FILLE', 'FEMALE'].includes(raw)) return 'F'
  return 'M'
}

function clean(value?: string) {
  const text = (value ?? '').trim()
  return text || undefined
}

function parseExcelPaste(text: string): { rows: BulkStudentRow[]; errors: string[] } {
  const errors: string[] = []
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (rawLines.length === 0) return { rows: [], errors: ['Aucune ligne collée.'] }

  const splitLine = (line: string) => {
    if (line.includes('\t')) return line.split('\t')
    if (line.includes(';')) return line.split(';')
    return line.split(',')
  }

  const firstColumns = splitLine(rawLines[0]).map(normalizeHeader)
  const hasHeader = firstColumns.some((h) => ['matricule', 'mat', 'nom', 'post_nom', 'prenom', 'sexe', 'date_naissance'].includes(h))

  const aliases: Record<string, string[]> = {
    matricule: ['matricule', 'mat', 'code', 'id', 'numero_matricule'],
    nom: ['nom', 'last_name', 'nom_de_famille'],
    post_nom: ['post_nom', 'postnom', 'post', 'middle_name'],
    prenom: ['prenom', 'first_name'],
    sexe: ['sexe', 'sex', 'genre'],
    date_naissance: ['date_naissance', 'date_de_naissance', 'naissance'],
    lieu_naissance: ['lieu_naissance', 'lieu_de_naissance'],
    adresse: ['adresse', 'address'],
    observations: ['observations', 'observation', 'note'],
  }

  const findIndex = (name: string) => firstColumns.findIndex((header) => aliases[name].includes(header))

  const fallbackMap = {
    matricule: 0,
    nom: 1,
    post_nom: 2,
    prenom: 3,
    sexe: 4,
    date_naissance: 5,
    lieu_naissance: 6,
    adresse: 7,
    observations: 8,
  }

  const getIndex = (name: keyof typeof fallbackMap) => {
    if (!hasHeader) return fallbackMap[name]
    const found = findIndex(name)
    return found >= 0 ? found : -1
  }

  const start = hasHeader ? 1 : 0
  const seen = new Set<string>()
  const rows: BulkStudentRow[] = []

  for (let i = start; i < rawLines.length; i += 1) {
    const cols = splitLine(rawLines[i]).map((v) => v.trim())
    const at = (name: keyof typeof fallbackMap) => {
      const index = getIndex(name)
      return index >= 0 ? cols[index] : ''
    }

    const matricule = at('matricule')
    const lastName = at('nom')
    const lineNumber = i + 1

    if (!matricule || !lastName) {
      errors.push(`Ligne ${lineNumber}: matricule ou nom manquant.`)
      continue
    }

    if (seen.has(matricule)) {
      errors.push(`Ligne ${lineNumber}: matricule dupliqué dans le collage (${matricule}).`)
      continue
    }
    seen.add(matricule)

    rows.push({
      matricule,
      last_name: lastName,
      middle_name: clean(at('post_nom')),
      first_name: clean(at('prenom')),
      sex: normalizeSex(at('sexe')),
      birth_date: clean(at('date_naissance')),
      birth_place: clean(at('lieu_naissance')),
      address: clean(at('adresse')),
      observations: clean(at('observations')),
    })
  }

  return { rows, errors }
}

export function StudentsPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState<string>('')
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm, status: 'actif', photo_path: '' as string | null })
  const [searchTerm, setSearchTerm] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const canManage = !!user && managementRoles.has(user.role)
  const canFinance = !!user && financeRoles.has(user.role)

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId])
  const totalBlocked = students.filter((s) => s.payment_blocked).length
  const totalPaid = students.length - totalBlocked
  const parsedPaste = useMemo(() => parseExcelPaste(pasteText), [pasteText])
  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => [s.full_name, s.matricule, s.class_name, s.class_option ?? '', s.class_room ?? '', s.status, s.birth_place ?? '', s.address ?? ''].join(' ').toLowerCase().includes(q))
  }, [students, searchTerm])

  async function loadClasses() {
    const rows = await api.classes()
    setClasses(rows)
    if (!classId && rows[0]) setClassId(rows[0].id)
    return rows
  }

  async function loadStudents(targetClassId = classId) {
    const rows = await api.students(targetClassId || undefined)
    setStudents(rows)
  }

  useEffect(() => {
    loadClasses()
      .then((rows) => rows[0] ? loadStudents(rows[0].id) : undefined)
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!classId) return
    loadStudents(classId).catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  function setField(name: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function openEditStudent(student: Student) {
    const names = student.full_name.split(' ')
    setEditStudent(student)
    setEditForm({
      matricule: student.matricule,
      last_name: names[0] ?? '',
      middle_name: names.length > 2 ? names.slice(1, -1).join(' ') : '',
      first_name: names.length > 1 ? names[names.length - 1] : '',
      sex: student.sex === 'F' ? 'F' : 'M',
      birth_date: student.birth_date ?? '',
      birth_place: student.birth_place ?? '',
      address: student.address ?? '',
      status: student.status,
      photo_path: student.photo_path ?? '',
    })
  }

  function setEditField(name: keyof typeof editForm, value: string | null) {
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  function readImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Image illisible.'))
      reader.readAsDataURL(file)
    })
  }

  async function updateStudentIdentity(event: FormEvent) {
    event.preventDefault()
    if (!editStudent) return
    setError(null)
    setMessage(null)
    try {
      await api.updateStudent(editStudent.id, {
        matricule: editForm.matricule.trim(),
        last_name: editForm.last_name.trim(),
        middle_name: editForm.middle_name.trim() || undefined,
        first_name: editForm.first_name.trim() || undefined,
        sex: editForm.sex,
        birth_date: editForm.birth_date || undefined,
        birth_place: editForm.birth_place.trim() || undefined,
        address: editForm.address.trim() || undefined,
        status: editForm.status,
        photo_path: editForm.photo_path || null,
      })
      setEditStudent(null)
      await loadStudents(classId)
      setMessage('Identité de l’élève corrigée avec succès.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant la correction de l’élève')
    }
  }

  async function onStudentPhoto(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Le fichier choisi doit être une image.')
      return
    }
    if (file.size > 1_500_000) {
      setError('Image trop lourde. Utilise une image de moins de 1,5 Mo.')
      return
    }
    setEditField('photo_path', await readImageFile(file))
  }

  function exportStudentList() {
    const header = ['Matricule', 'Nom complet', 'Classe', 'Sexe', 'Naissance', 'Lieu', 'Adresse', 'Paiement', 'Payé', 'Dû', 'Statut']
    const rows = filteredStudents.map((s) => [s.matricule, s.full_name, s.class_name, s.sex, s.birth_date ?? '', s.birth_place ?? '', s.address ?? '', paymentLabel(s), String(s.total_paid), String(s.total_due), s.status])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `liste-eleves-${selectedClass?.name ?? 'classe'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function createStudent(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (!classId) {
      setError('Sélectionne une classe avant d’ajouter un élève.')
      return
    }
    try {
      await api.createStudent({
        class_id: classId,
        matricule: form.matricule.trim(),
        last_name: form.last_name.trim(),
        middle_name: form.middle_name.trim() || undefined,
        first_name: form.first_name.trim() || undefined,
        sex: form.sex,
        birth_date: form.birth_date || undefined,
        birth_place: form.birth_place.trim() || undefined,
        address: form.address.trim() || undefined,
      })
      setForm(emptyForm)
      setShowForm(false)
      await loadStudents(classId)
      await loadClasses()
      setMessage('Élève ajouté avec succès. Son accès aux résultats reste bloqué tant que le paiement n’est pas régularisé.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de création')
    }
  }

  async function importPastedStudents() {
    setError(null)
    setMessage(null)
    if (!classId) {
      setError('Sélectionne une classe avant l’import.')
      return
    }
    if (parsedPaste.rows.length === 0) {
      setError(parsedPaste.errors[0] ?? 'Aucune ligne valide à importer.')
      return
    }
    setIsImporting(true)
    try {
      const result = await api.bulkCreateStudents({ class_id: classId, rows: parsedPaste.rows })
      setPasteText('')
      await loadStudents(classId)
      await loadClasses()
      const errorInfo = result.errors.length ? ` ${result.errors.slice(0, 3).join(' ')}` : ''
      setMessage(`${result.created} élève(s) importé(s), ${result.skipped} ligne(s) ignorée(s).${errorInfo}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant l’import par collage')
    } finally {
      setIsImporting(false)
    }
  }

  async function importExcelFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setMessage(null)
    if (!classId) {
      setError('Sélectionne une classe avant l’import Excel.')
      return
    }
    setIsImporting(true)
    try {
      const result = await api.importStudentsExcel(classId, file)
      await loadStudents(classId)
      await loadClasses()
      const errorInfo = result.errors?.length ? ` ${result.errors.slice(0, 3).join(' ')}` : ''
      setMessage(`${result.created} élève(s) importé(s) depuis Excel, ${result.skipped} ligne(s) ignorée(s).${errorInfo}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant l’import Excel')
    } finally {
      setIsImporting(false)
    }
  }

  async function deleteStudent(student: Student) {
    const ok = window.confirm(`Supprimer définitivement ${student.full_name} ? Cette action efface aussi ses notes, bulletins, paiements et liens parent.`)
    if (!ok) return
    setError(null)
    setMessage(null)
    try {
      await api.deleteStudent(student.id)
      await loadStudents(classId)
      await loadClasses()
      setMessage('Élève supprimé.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de suppression')
    }
  }

  async function updatePayment(student: Student, mode: 'block' | 'unblock') {
    setError(null)
    setMessage(null)
    const totalDueText = window.prompt('Montant total à payer pour cet élève :', String(student.total_due || 300))
    if (totalDueText === null) return
    const totalDue = Number(totalDueText.replace(',', '.'))
    if (Number.isNaN(totalDue) || totalDue < 0) {
      setError('Montant total invalide.')
      return
    }
    let totalPaid = 0
    if (mode === 'unblock') {
      totalPaid = totalDue
    } else {
      const paidText = window.prompt('Montant déjà payé :', String(Math.min(student.total_paid || 0, totalDue)))
      if (paidText === null) return
      totalPaid = Number(paidText.replace(',', '.'))
    }
    if (Number.isNaN(totalPaid) || totalPaid < 0) {
      setError('Montant payé invalide.')
      return
    }
    try {
      await api.updateFeeStatus({ student_id: student.id, total_due: totalDue, total_paid: totalPaid, bulletin_access_override: false })
      await loadStudents(classId)
      setMessage(mode === 'block' ? 'Élève bloqué : ses points et bulletins ne sont plus visibles par le parent/élève.' : 'Élève débloqué : ses résultats sont accessibles.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de mise à jour du paiement')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="app-kicker">Gestion des élèves</p>
          <h1 className="mobile-page-title mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Élèves et paiements</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Ajout individuel, import depuis Excel, collage direct de lignes, suppression et blocage automatique des résultats en cas de frais non régularisés.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.option ? ` — ${c.option}` : ''} — {c.level}</option>)}
          </select>
          {canManage && (
            <button onClick={() => setShowImport((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 shadow-sm hover:bg-blue-100">
              <ClipboardPaste size={17} /> Importer une liste
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0b2a5b] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800">
              <Plus size={17} /> Ajouter un élève
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="app-card rounded-[1.6rem] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Classe sélectionnée</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{selectedClass?.name ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-500">{selectedClass?.level} · {selectedClass?.option || 'Aucune option'} · {selectedClass?.room || 'Salle non définie'}</p>
        </div>
        <div className="app-card rounded-[1.6rem] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Élèves en ordre</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{totalPaid}</p>
          <p className="mt-1 text-sm text-slate-500">Accès aux résultats autorisé.</p>
        </div>
        <div className="app-card rounded-[1.6rem] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Élèves bloqués</p>
          <p className="mt-2 text-2xl font-black text-red-700">{totalBlocked}</p>
          <p className="mt-1 text-sm text-slate-500">Points et bulletins masqués côté parent/élève.</p>
        </div>
      </div>

      {showImport && canManage && (
        <div className="app-card overflow-hidden rounded-[1.8rem] border border-blue-100">
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-blue-700 p-3 text-white"><FileSpreadsheet size={23} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Importer plusieurs élèves</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                    Copie les lignes dans Excel puis colle-les ici. La première ligne peut contenir les titres : matricule, nom, post_nom, prenom, sexe, date_naissance, lieu_naissance, adresse.
                  </p>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-800 ring-1 ring-blue-100 hover:bg-blue-50">
                <Upload size={17} /> Importer un fichier .xlsx
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importExcelFile} />
              </label>
            </div>
          </div>
          <div className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={pasteExample}
                className="min-h-[260px] w-full rounded-3xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button disabled={isImporting || parsedPaste.rows.length === 0} onClick={importPastedStudents} className="inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <ClipboardPaste size={17} /> Transformer en liste d’élèves
                </button>
                <button type="button" onClick={() => setPasteText(pasteExample)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Insérer un exemple</button>
                <button type="button" onClick={() => setPasteText('')} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Vider</button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Aperçu avant import</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{parsedPaste.rows.length}</p>
              <p className="mt-1 text-sm text-slate-500">ligne(s) valide(s) prêtes pour {selectedClass?.name ?? 'la classe sélectionnée'}.</p>
              {parsedPaste.errors.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                  {parsedPaste.errors.slice(0, 5).map((err) => <div key={err}>• {err}</div>)}
                  {parsedPaste.errors.length > 5 && <div>• {parsedPaste.errors.length - 5} autre(s) erreur(s)…</div>}
                </div>
              )}
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p><b>Règle :</b> le matricule et le nom sont obligatoires.</p>
                <p><b>Doublons :</b> les matricules déjà existants sont ignorés.</p>
                <p><b>Paiement :</b> chaque nouvel élève est bloqué par défaut tant que la comptabilité ne le débloque pas.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={createStudent} className="app-card rounded-[1.8rem] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><UserRoundPlus size={22} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Nouvel élève</h2>
              <p className="text-sm text-slate-500">L’élève est créé dans la classe sélectionnée : {selectedClass?.name ?? 'aucune'}.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <input required value={form.matricule} onChange={(e) => setField('matricule', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Matricule" />
            <input required value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Nom" />
            <input value={form.middle_name} onChange={(e) => setField('middle_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Post-nom" />
            <input value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Prénom" />
            <select value={form.sex} onChange={(e) => setField('sex', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500">
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
            <input type="date" value={form.birth_date} onChange={(e) => setField('birth_date', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
            <input value={form.birth_place} onChange={(e) => setField('birth_place', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Lieu de naissance" />
            <input value={form.address} onChange={(e) => setField('address', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Adresse" />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800"><Plus size={17} /> Enregistrer</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
          </div>
        </form>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}

      <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-black text-slate-950">Liste des élèves</h2>
            <p className="text-sm text-slate-500">Recherche, correction des noms mal écrits, export et statut financier.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Search size={16} />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher matricule, nom, classe, option..." className="min-w-[240px] bg-transparent outline-none" />
            </div>
            <button onClick={exportStudentList} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"><Download size={15} /> Sortir la liste</button>
            <button onClick={() => loadStudents(classId)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"><RefreshCw size={15} /> Actualiser</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-5 py-3">Photo</th>
                <th className="px-5 py-3">Matricule</th>
                <th className="px-5 py-3">Nom complet</th>
                <th className="px-5 py-3">Classe</th>
                <th className="px-5 py-3">Parents liés</th>
                <th className="px-5 py-3">Paiement</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">{s.photo_path ? <img src={s.photo_path} alt={s.full_name} className="h-full w-full object-cover" /> : null}</div></td>
                  <td className="px-5 py-4 font-black text-slate-950">{s.matricule}</td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-950">{s.full_name}</div>
                    <div className="text-xs text-slate-500">{s.sex} · {s.birth_place ?? 'Naissance non renseignée'}</div>
                  </td>
                  <td className="px-5 py-4">{s.class_name}</td>
                  <td className="px-5 py-4">{s.parent_count}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${paymentClasses(s)}`}>{paymentLabel(s)}</span>
                    <div className="mt-1 text-xs text-slate-500">{s.total_paid}/{s.total_due} $</div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canFinance && s.payment_blocked && <button onClick={() => updatePayment(s, 'unblock')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"><UnlockKeyhole size={14} /> Débloquer</button>}
                      {canFinance && !s.payment_blocked && <button onClick={() => updatePayment(s, 'block')} className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100"><LockKeyhole size={14} /> Bloquer</button>}
                      {canManage && <button onClick={() => openEditStudent(s)} className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"><Pencil size={14} /> Modifier</button>}
                      {canManage && <button onClick={() => deleteStudent(s)} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"><Trash2 size={14} /> Supprimer</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">Aucun élève ne correspond à la recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <form onSubmit={updateStudentIdentity} className="w-full max-w-4xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="app-kicker">Correction administrative</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Modifier l’identité de l’élève</h2>
                <p className="text-sm text-slate-500">Utilisé pour corriger un nom mal écrit, changer la classe ou ajouter la photo de l’élève.</p>
              </div>
              <button type="button" onClick={() => setEditStudent(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50">Fermer</button>
            </div>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="space-y-3">
                <div className="h-40 w-40 overflow-hidden rounded-[1.5rem] bg-slate-100 ring-1 ring-slate-200">
                  {editForm.photo_path ? <img src={editForm.photo_path} alt="Photo élève" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Photo</div>}
                </div>
                <label className="block cursor-pointer rounded-2xl bg-blue-50 px-4 py-3 text-center text-xs font-black text-blue-700 hover:bg-blue-100">
                  Changer photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onStudentPhoto(e.target.files?.[0])} />
                </label>
                {editForm.photo_path && <button type="button" onClick={() => setEditField('photo_path', null)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-50">Retirer</button>}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input required value={editForm.matricule} onChange={(e) => setEditField('matricule', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Matricule" />
                <input required value={editForm.last_name} onChange={(e) => setEditField('last_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Nom" />
                <input value={editForm.middle_name} onChange={(e) => setEditField('middle_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Post-nom" />
                <input value={editForm.first_name} onChange={(e) => setEditField('first_name', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Prénom" />
                <select value={editForm.sex} onChange={(e) => setEditField('sex', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"><option value="M">M</option><option value="F">F</option></select>
                <select value={editForm.status} onChange={(e) => setEditField('status', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"><option value="actif">Actif</option><option value="suspendu">Suspendu</option><option value="renvoyé">Renvoyé</option><option value="transféré">Transféré</option></select>
                <input type="date" value={editForm.birth_date} onChange={(e) => setEditField('birth_date', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
                <input value={editForm.birth_place} onChange={(e) => setEditField('birth_place', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Lieu de naissance" />
                <input value={editForm.address} onChange={(e) => setEditField('address', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" placeholder="Adresse" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-2xl bg-[#0b2a5b] px-5 py-3 text-sm font-black text-white hover:bg-blue-800">Enregistrer la correction</button>
              <button type="button" onClick={() => setEditStudent(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
