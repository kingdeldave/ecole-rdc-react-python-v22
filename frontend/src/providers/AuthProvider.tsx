import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setToken } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
  updateProfilePhoto: (photoPath: string | null) => Promise<void>
  updateProfile: (payload: Partial<{ full_name: string; phone: string; photo_path: string | null }>) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await api.login(email, password)
    setToken(data.access_token)
    setUser(data.user)
  }

  async function refreshUser() {
    const current = await api.me()
    setUser(current)
  }

  async function updateProfilePhoto(photoPath: string | null) {
    const updated = await api.updateMyPhoto(photoPath)
    setUser(updated)
  }

  async function updateProfile(payload: Partial<{ full_name: string; phone: string; photo_path: string | null }>) {
    const updated = await api.updateMyProfile(payload)
    setUser(updated)
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, refreshUser, updateProfilePhoto, updateProfile, logout }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
