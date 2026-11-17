import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/types'
import { Alert, PageHead } from '../components/ui'

export default function AccountPage() {
  const { profile } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!profile) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.')
    if (next !== confirm) return setError('La confirmación no coincide con la nueva contraseña.')
    if (next === current) return setError('La nueva contraseña debe ser distinta de la actual.')
    setBusy(true)
    // Verifica la contraseña actual antes de cambiarla
    const check = await supabase.auth.signInWithPassword({ email: profile!.email, password: current })
    if (check.error) {
      setBusy(false)
      return setError('La contraseña actual es incorrecta.')
    }
    const { error: upErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (upErr) {
      setError(/different from the old/i.test(upErr.message) ? 'La nueva contraseña debe ser distinta de la actual.' : upErr.message)
      return
    }
    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
  }

  return (
    <>
      <PageHead tag="Mi cuenta" title="Cambiar contraseña">
        {profile.full_name || profile.email} · {ROLE_LABEL[profile.app_role]} · {profile.email}
      </PageHead>
      <form className="card stack" onSubmit={submit} style={{ maxWidth: 440 }}>
        <label className="field">Contraseña actual
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className="field">Nueva contraseña
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label className="field">Repetir nueva contraseña
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        {error && <Alert>{error}</Alert>}
        {done && <Alert kind="ok">Contraseña actualizada.</Alert>}
        <div className="row">
          <button className="btn accent" disabled={busy}>Guardar contraseña</button>
        </div>
      </form>
    </>
  )
}
