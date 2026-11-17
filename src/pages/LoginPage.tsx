import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { Alert } from '../components/ui'

export default function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    if (mode === 'reset') {
      const err = await resetPassword(email.trim())
      if (err) setError(err)
      else setInfo('Si el correo está registrado, te enviamos un enlace para definir una nueva contraseña.')
    } else if (mode === 'in') {
      setError(await signIn(email, password))
    } else {
      const err = await signUp(email, password, fullName)
      if (err) setError(err)
      else setInfo('Te enviamos un correo de confirmación. Confírmalo para ingresar.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="logo-box"><img src="/brand/logo.jpg" alt="Glasstech" /></div>
        <span className="subtitle-tag" style={{ alignSelf: 'flex-start' }}>Gestión de personas</span>
        <h1>Matrices de habilidades</h1>
        <p>Define las habilidades de cada rol, califica a tu equipo y diseña planes de carrera con datos claros.</p>
      </section>
      <section className="auth-form">
        <form onSubmit={submit}>
          <h2>{mode === 'in' ? 'Ingresar' : mode === 'up' ? 'Crear cuenta' : 'Recuperar contraseña'}</h2>
          {mode === 'up' && (
            <label className="field">Nombre completo
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="field">Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {mode !== 'reset' && <label className="field">Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          </label>}
          {error && <Alert>{error}</Alert>}
          {info && <Alert kind="ok">{info}</Alert>}
          <button className="btn accent" disabled={busy}>{mode === 'in' ? 'Ingresar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}</button>
          <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'up' ? 'in' : mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null) }}>
            {mode === 'in' ? 'No tengo cuenta' : mode === 'up' ? 'Ya tengo cuenta' : 'Volver a ingresar'}
          </button>
          {mode === 'in' && (
            <button type="button" className="btn ghost" onClick={() => { setMode('reset'); setError(null); setInfo(null) }}>
              Olvidé mi contraseña
            </button>
          )}
          {mode === 'up' && <p className="muted" style={{ margin: 0 }}>Tu perfil inicial es Trabajador. Gerencia puede asignarte otro perfil.</p>}
        </form>
      </section>
    </div>
  )
}
