import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Alert } from '../components/ui'

/** Se muestra al abrir el enlace de recuperación enviado por correo. */
export default function ResetPasswordPage() {
  const { session, finishRecovery, signOut } = useAuth()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (next !== confirm) return setError('La confirmación no coincide.')
    setBusy(true)
    const { error: upErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (upErr) {
      setError(/different from the old/i.test(upErr.message) ? 'La nueva contraseña debe ser distinta de la anterior.' : upErr.message)
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    finishRecovery()
  }

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="logo-box"><img src="/brand/logo.jpg" alt="Glasstech" /></div>
        <span className="subtitle-tag" style={{ alignSelf: 'flex-start' }}>Recuperar acceso</span>
        <h1>Define tu nueva contraseña</h1>
        <p>Elige una contraseña de al menos 8 caracteres. Al guardarla, entrarás directamente a la aplicación.</p>
      </section>
      <section className="auth-form">
        <form onSubmit={submit}>
          <h2>Nueva contraseña</h2>
          {!session && <Alert kind="info">Validando el enlace…</Alert>}
          <label className="field">Nueva contraseña
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <label className="field">Repetir contraseña
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          {error && <Alert>{error}</Alert>}
          <button className="btn accent" disabled={busy || !session}>Guardar y entrar</button>
          <button type="button" className="btn ghost" onClick={() => { finishRecovery(); void signOut() }}>Cancelar</button>
        </form>
      </section>
    </div>
  )
}
