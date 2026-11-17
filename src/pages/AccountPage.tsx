import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/types'
import { Alert, PageHead } from '../components/ui'

export default function AccountPage() {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!profile) return null

  async function saveName(e: FormEvent) {
    e.preventDefault()
    const value = (name ?? profile!.full_name).trim()
    if (!value) return setNameMsg({ ok: false, text: 'El nombre no puede quedar vacío.' })
    setNameBusy(true)
    setNameMsg(null)
    const { data, error: err } = await supabase.from('profiles').update({ full_name: value }).eq('id', profile!.id).select()
    if (err || !data?.length) {
      setNameMsg({ ok: false, text: err?.message ?? 'No se pudo guardar el nombre.' })
    } else {
      await refreshProfile()
      setName(null)
      setNameMsg({ ok: true, text: 'Nombre actualizado.' })
    }
    setNameBusy(false)
  }

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
      <PageHead tag="Mi cuenta" title="Mis datos">
        {ROLE_LABEL[profile.app_role]} · {profile.email}
      </PageHead>
      <div className="stack" style={{ maxWidth: 440 }}>
      <form className="card stack" onSubmit={saveName}>
        <h2>Nombre</h2>
        <label className="field">Nombre completo
          <input value={name ?? profile.full_name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
        {nameMsg && <Alert kind={nameMsg.ok ? 'ok' : 'error'}>{nameMsg.text}</Alert>}
        <div className="row"><button className="btn accent" disabled={nameBusy}>Guardar nombre</button></div>
      </form>
      <form className="card stack" onSubmit={submit}>
        <h2>Cambiar contraseña</h2>
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
      </div>
    </>
  )
}
