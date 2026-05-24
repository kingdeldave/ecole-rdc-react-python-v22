import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'
import { SchoolLogoMark, SchoolMiniature, SchoolPhotoPanel } from '../components/SchoolIdentity'

const demoAccounts = [
  { label: 'Secrétariat scolaire', email: 'admin@matonge.cd' },
  { label: 'Directeur des études', email: 'directeur@matonge.cd' },
  { label: 'Professeur', email: 'enseignant@matonge.cd' },
  { label: 'Parent', email: 'parent@matonge.cd' },
  { label: 'Élève', email: 'eleve@matonge.cd' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(accountEmail: string) {
    setEmail(accountEmail)
    setPassword('Password123!')
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-3 sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 sm:rounded-[2rem] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden p-4 lg:block">
          <SchoolPhotoPanel />
        </section>

        <section className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <form onSubmit={handleSubmit} className="w-full max-w-[470px]">
            <div className="mb-5 block lg:hidden">
              <SchoolMiniature />
            </div>
            <div className="mb-6 sm:mb-8">
              <div className="mb-5 flex items-center gap-3 sm:mb-7">
                <SchoolLogoMark />
                <div>
                  <p className="app-kicker">Accès sécurisé</p>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">École RDC</h1>
                </div>
              </div>
              <h2 className="mobile-page-title text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Connexion au portail scolaire</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">Chaque utilisateur accède uniquement à son espace : élève, parent, professeur, comptabilité ou direction.</p>
            </div>

            {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

            <label className="text-sm font-black text-slate-700">Adresse email</label>
            <div className="app-field mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <Mail size={18} className="text-slate-400" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" type="email" autoComplete="email" placeholder="exemple@ecole.cd" />
            </div>

            <label className="mt-5 block text-sm font-black text-slate-700">Mot de passe</label>
            <div className="app-field mt-2 flex items-center gap-3 rounded-2xl px-4 py-3.5">
              <LockKeyhole size={18} className="text-slate-400" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Votre mot de passe" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-400 hover:text-slate-700" aria-label="Afficher ou masquer le mot de passe">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="mt-3 text-right">
              <Link to="/forgot-password" className="text-xs font-black text-blue-700 hover:text-blue-900">Mot de passe oublié ?</Link>
            </div>

            <button disabled={loading || !email || !password} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0b2a5b] px-4 py-4 font-black text-white shadow-lg shadow-blue-950/18 transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-55">
              {loading ? 'Connexion en cours...' : 'Se connecter'} <ArrowRight size={18} />
            </button>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck size={17} className="text-blue-700" /> Accès de démonstration</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {demoAccounts.map((account) => (
                  <button key={account.email} type="button" onClick={() => fillDemo(account.email)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800">
                    <span>{account.label}</span>
                    <CheckCircle2 size={15} />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Mot de passe de démonstration : <b>Password123!</b></p>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">Document scolaire confidentiel. Toute action sensible est journalisée.</p>
          </form>
        </section>
      </div>
    </main>
  )
}
