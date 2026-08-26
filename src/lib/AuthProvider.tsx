import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocalStore } from './localStore'
import { isCloudConfigured, supabase } from './supabaseClient'
import { SupabaseStore } from './supabaseStore'
import type { DataStore } from './types'

interface AuthContextValue {
  isCloud: boolean
  loading: boolean
  userEmail: string | null
  store: DataStore
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isCloudConfigured)

  useEffect(() => {
    if (!isCloudConfigured || !supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const store = useMemo<DataStore>(() => {
    if (isCloudConfigured && supabase && session?.user) {
      return new SupabaseStore(supabase, session.user.id)
    }
    return new LocalStore()
  }, [session])

  const value: AuthContextValue = {
    isCloud: isCloudConfigured,
    loading,
    userEmail: session?.user.email ?? null,
    store,
    async signIn(email, password) {
      if (!supabase) return 'Supabase non configuré'
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    async signUp(email, password) {
      if (!supabase) return 'Supabase non configuré'
      const { error } = await supabase.auth.signUp({ email, password })
      return error?.message ?? null
    },
    async signOut() {
      if (!supabase) return
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
