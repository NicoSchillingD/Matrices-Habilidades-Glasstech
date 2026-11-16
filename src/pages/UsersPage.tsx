import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { unwrap, useQuery } from '../lib/data'
import { ROLE_LABEL, type AppRole, type Profile } from '../lib/types'
import { Alert, Loading, PageHead } from '../components/ui'

export default function UsersPage() {
  const { profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', app_role: 'trabajador' as AppRole, password: '' })
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const users = useQuery(
    async () => unwrap(await supabase.from('profiles').select('id,email,full_name,app_role').order('email')) as Profile[],
    [],
  )

  function generatePassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.getRandomValues(new Uint32Array(14))
    setForm((f) => ({ ...f, password: Array.from(bytes, (b) => chars[b % chars.length]).join('') }))
  }

  async function createUser(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setCreated(null)
    const { error: fnError } = await supabase.functions.invoke('admin-create-user', { body: form })
    if (fnError) {
      let msg = fnError.message
      const ctx = (fnError as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try {
          msg = ((await ctx.json()) as { error?: string }).error ?? msg
        } catch {
          /* se mantiene el mensaje genérico */
        }
      }
      setError(msg)
    } else {
      setCreated({ email: form.email.trim().toLowerCase(), password: form.password })
      setForm({ full_name: '', email: '', app_role: 'trabajador', password: '' })
      users.reload()
    }
    setBusy(false)
  }

  async function setRole(id: string, role: AppRole) {
    setError(null)
    try {
      unwrap(await supabase.from('profiles').update({ app_role: role }).eq('id', id).select())
      users.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <PageHead tag="Administración" title="Usuarios y perfiles">
        Crea cuentas con su perfil y contraseña inicial, o cambia el perfil de quien ya se registró (queda como Trabajador hasta que lo cambies aquí).
      </PageHead>
      {error && <Alert>{error}</Alert>}
      {created && (
        <Alert kind="ok">
          Usuario creado: <b>{created.email}</b> · contraseña inicial: <b style={{ userSelect: 'all' }}>{created.password}</b>.
          Entrégasela por un canal seguro; no se vuelve a mostrar.
        </Alert>
      )}
      <form className="card row" onSubmit={createUser} style={{ alignItems: 'flex-end', margin: '16px 0' }}>
        <label className="field" style={{ flex: 2, minWidth: 180 }}>Nombre completo
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </label>
        <label className="field" style={{ flex: 2, minWidth: 200 }}>Correo
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label className="field" style={{ minWidth: 140 }}>Perfil
          <select value={form.app_role} onChange={(e) => setForm({ ...form, app_role: e.target.value as AppRole })}>
            {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>Contraseña inicial
          <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input style={{ flex: 1 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="off" />
            <button type="button" className="btn secondary sm" onClick={generatePassword}>Generar</button>
          </span>
        </label>
        <button className="btn accent" disabled={busy}>Crear usuario</button>
      </form>
      {users.loading ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Perfil</th></tr></thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td><b>{u.full_name || '—'}</b></td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.app_role} disabled={u.id === profile?.id} aria-label={`Perfil de ${u.email}`}
                      onChange={(e) => void setRole(u.id, e.target.value as AppRole)}>
                      {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    {u.id === profile?.id && <span className="muted"> (tú)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
