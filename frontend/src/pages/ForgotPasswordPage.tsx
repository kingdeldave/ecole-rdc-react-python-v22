import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function requestReset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const res = await api.forgotPassword(email)
      setMessage(`${res.message}${res.dev_reset_token ? ` Jeton dev : ${res.dev_reset_token}` : ''}`)
      if (res.dev_reset_token) setToken(res.dev_reset_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const res = await api.resetPassword(token, password)
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-4">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
        <p className="app-kicker">Sécurité compte</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Mot de passe oublié</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">En production, le jeton sera envoyé par email. En démonstration, il s’affiche directement pour permettre le test.</p>
        {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>}
        {message && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{message}</div>}
        <form onSubmit={requestReset} className="mt-6 space-y-3">
          <label className="text-sm font-black text-slate-700">Email du compte</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="app-field w-full rounded-2xl px-4 py-3" type="email" placeholder="admin@matonge.cd" />
          <button className="w-full rounded-2xl bg-blue-700 px-4 py-3 font-black text-white">Générer le jeton</button>
        </form>
        <form onSubmit={reset} className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4">
          <label className="text-sm font-black text-slate-700">Jeton reçu</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <label className="text-sm font-black text-slate-700">Nouveau mot de passe</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" type="password" />
          <button className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">Réinitialiser</button>
        </form>
        <Link to="/login" className="mt-5 block text-center text-sm font-black text-blue-700">Retour à la connexion</Link>
      </div>
    </main>
  )
}
