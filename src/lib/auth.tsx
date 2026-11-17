import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovering: boolean
  finishRecovery: () => void
  refreshProfile: () => Promise<void>
  resetPassword: (email: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id,email,full_name,app_role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setProfile((data as Profile | null) ?? null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value: AuthState = {
    session,
    profile,
    loading,
    recovering,
    finishRecovery: () => setRecovering(false),
    refreshProfile: async () => {
      if (!userId) return
      const { data } = await supabase.from('profiles').select('id,email,full_name,app_role').eq('id', userId).single()
      if (data) setProfile(data as Profile)
    },
    resetPassword: async (email) => {
      // Mensaje siempre genérico en la UI: no revela si el correo existe
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      return error && /rate limit|too many/i.test(error.message)
        ? 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.'
        : null
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? traducir(error.message) : null
    },
    signUp: async (email, password, fullName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      })
      return error ? traducir(error.message) : null
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu correo antes de ingresar.'
  if (/already registered/i.test(msg)) return 'Ese correo ya está registrado.'
  if (/password should be at least/i.test(msg)) return 'La contraseña es demasiado corta.'
  return msg
}
