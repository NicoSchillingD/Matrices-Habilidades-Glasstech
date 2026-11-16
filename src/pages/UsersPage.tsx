import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { unwrap, useQuery } from '../lib/data'
import { ROLE_LABEL, type AppRole, type Profile } from '../lib/types'
import { Alert, Loading, PageHead } from '../components/ui'

export default function UsersPage() {
  const { profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const users = useQuery(
    async () => unwrap(await supabase.from('profiles').select('id,email,full_name,app_role').order('email')) as Profile[],
    [],
  )

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
        Asigna el perfil de cada persona. Quien se registra queda como Trabajador hasta que lo cambies aquí.
      </PageHead>
      {error && <Alert>{error}</Alert>}
      {users.loading ? <Loading /> : (
        <div className="table-wrap" style={{ marginTop: 16 }}>
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
