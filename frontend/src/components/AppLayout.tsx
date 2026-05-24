import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  CalendarDays,
  BookOpen,
  ClipboardList,
  FileText,
  Gavel,
  IdCard,
  KeyRound,
  LogOut,
  Menu,
  UserCircle,
  ScrollText,
  ShieldCheck,
  Users,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'
import type { RoleCode, User } from '../types'
import { SchoolLogoMark } from './SchoolIdentity'

const allItems = [
  { to: '/', label: 'Tableau de bord', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'COMPTABLE', 'PARENT', 'ELEVE'] },
  { to: '/students', label: 'Élèves', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'COMPTABLE'] },
  { to: '/classes-options', label: 'Classes / Options', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'] },
  { to: '/titular-classes', label: 'Mes classes titulaires', icon: UserRoundCheck, roles: ['ENSEIGNANT'] },
  { to: '/users', label: 'Utilisateurs', icon: KeyRound, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'] },
  { to: '/student-card', label: "Carte d’élève", icon: IdCard, roles: ['PARENT', 'ELEVE', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'] },
  { to: '/enrollments', label: 'Inscriptions', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'] },
  { to: '/attendance', label: 'Présences', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'PARENT', 'ELEVE'] },
  { to: '/exams', label: 'Examens', icon: CalendarDays, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'PARENT', 'ELEVE'] },
  { to: '/grades', label: 'Points', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT'] },
  { to: '/grade-import', label: 'Import points Excel', icon: ClipboardList, roles: ['SUPER_ADMIN', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT'] },
  { to: '/jury-points', label: 'Points jury', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT'] },
  { to: '/report-cards', label: 'Bulletins', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'COMPTABLE', 'PARENT', 'ELEVE'] },
  { to: '/school-years', label: 'Années / Périodes', icon: CalendarDays, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR'] },
  { to: '/schedules', label: 'Horaires', icon: CalendarDays, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'PARENT', 'ELEVE'] },
  { to: '/courses', label: 'Cours / Matières', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT'] },
  { to: '/teachers', label: 'Professeurs / horaires', icon: UserRoundCheck, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'COMPTABLE'] },
  { to: '/documents', label: 'Documents officiels', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'PARENT', 'ELEVE'] },
  { to: '/library', label: 'Bibliothèque', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'PARENT', 'ELEVE'] },
  { to: '/discipline', label: 'Discipline', icon: Gavel, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'PARENT', 'ELEVE'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'COMPTABLE', 'PARENT', 'ELEVE'] },
  { to: '/profile', label: 'Profil connecté', icon: UserCircle, roles: ['SUPER_ADMIN', 'ADMIN_ECOLE', 'PREFET', 'DIRECTEUR', 'ENSEIGNANT', 'COMPTABLE', 'PARENT', 'ELEVE'] },
  { to: '/audit-logs', label: 'Audit', icon: ScrollText, roles: ['SUPER_ADMIN', 'DIRECTEUR', 'PREFET', 'ADMIN_ECOLE'] },
  { to: '/backups', label: 'Sauvegardes', icon: ScrollText, roles: ['SUPER_ADMIN', 'DIRECTEUR', 'PREFET'] },
] as const

const roleMeta: Record<RoleCode, { label: string; subtitle: string; tone: string }> = {
  SUPER_ADMIN: { label: 'Super Admin technique', subtitle: 'Maintenance et sécurité système', tone: 'bg-slate-950 text-white' },
  ADMIN_ECOLE: { label: 'Secrétariat scolaire', subtitle: 'Dossiers, inscriptions et cartes', tone: 'bg-blue-700 text-white' },
  PREFET: { label: 'Préfet / Chef d’établissement', subtitle: 'Autorité officielle et validation finale', tone: 'bg-indigo-700 text-white' },
  DIRECTEUR: { label: 'Directeur des études', subtitle: 'Suivi pédagogique et contrôle des points', tone: 'bg-slate-950 text-white' },
  ENSEIGNANT: { label: 'Professeur', subtitle: 'Cours et points verrouillés', tone: 'bg-cyan-700 text-white' },
  COMPTABLE: { label: 'Intendance / Comptabilité', subtitle: 'Paiements, frais et blocages financiers', tone: 'bg-emerald-700 text-white' },
  PARENT: { label: 'Parent', subtitle: 'Suivi des enfants', tone: 'bg-blue-700 text-white' },
  ELEVE: { label: 'Élève', subtitle: 'Cours, bulletin et carte', tone: 'bg-blue-700 text-white' },
}

function ProfileBlock({ user, meta }: { user: User | null; meta: (typeof roleMeta)[RoleCode] | null }) {
  return (
    <div className={`rounded-[1.35rem] p-4 ${meta?.tone ?? 'bg-blue-700 text-white'}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">Profil connecté</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white/15 ring-2 ring-white/25">
          {user?.photo_path ? (
            <img src={user.photo_path} alt={user.full_name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><UserCircle size={28} className="opacity-80" /></div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black tracking-tight">{meta?.label}</p>
          <p className="mt-0.5 truncate text-sm font-bold opacity-90">{user?.full_name}</p>
        </div>
      </div>
      <p className="mt-3 text-sm opacity-80">{meta?.subtitle}</p>
    </div>
  )
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const meta = user ? roleMeta[user.role] : null
  const items = allItems.filter((item) => user && (item.roles as readonly string[]).includes(user.role))

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[292px] border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <SchoolLogoMark compact />
            <div>
              <p className="text-base font-black leading-tight text-slate-950">École RDC</p>
              <p className="text-xs font-semibold text-slate-500">Gestion scolaire officielle</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <ProfileBlock user={user} meta={meta} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2.25} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck size={17} className="text-emerald-600" /> Système sécurisé</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Accès par rôle, audit, bulletins verrouillés et vérification QR.</p>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={closeMobileMenu}
          />
          <aside className="relative flex h-full w-[86vw] max-w-[360px] flex-col border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <SchoolLogoMark compact />
                <div>
                  <p className="text-base font-black leading-tight text-slate-950">École RDC</p>
                  <p className="text-xs font-semibold text-slate-500">Menu mobile</p>
                </div>
              </div>
              <button type="button" onClick={closeMobileMenu} className="rounded-2xl bg-slate-100 p-2 text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <ProfileBlock user={user} meta={meta} />
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition ${
                      isActive
                        ? 'bg-blue-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`
                  }
                >
                  <item.icon size={18} strokeWidth={2.25} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <button onClick={() => { closeMobileMenu(); logout() }} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                <LogOut size={17} /> Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="lg:pl-[292px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/94 px-4 py-3 backdrop-blur-xl lg:px-8 lg:py-3">
          <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 sm:flex">
                {user?.photo_path ? <img src={user.photo_path} alt={user.full_name} className="h-full w-full object-cover" /> : <UserCircle size={24} className="text-slate-500" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">Session active</p>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                  <p className="max-w-[190px] truncate text-base font-black text-slate-950 sm:max-w-none">{user?.full_name}</p>
                  {meta && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{meta.label}</span>}
                </div>
              </div>
            </div>
            <button onClick={logout} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:w-auto sm:gap-2 sm:px-3.5">
              <LogOut size={17} /> <span className="hidden sm:inline text-sm font-bold">Déconnexion</span>
            </button>
          </div>
        </header>

        <div className="mobile-safe-bottom mx-auto max-w-[1520px] p-4 sm:p-5 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
