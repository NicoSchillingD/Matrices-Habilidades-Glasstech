import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { unwrap, useQuery } from '../lib/data'
import type { JobRole, Profile, Worker } from '../lib/types'
import { Alert, Loading, PageHead } from '../components/ui'

export default function WorkersPage() {
  const { profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', employee_code: '', role_id: '' })

  const workers = useQuery(
    async () => unwrap(await supabase.from('workers').select('*').order('full_name')) as Worker[],
    [],
  )
  const roles = useQuery(
    async () => unwrap(await supabase.from('job_roles').select('*').order('name')) as JobRole[],
    [],
  )
  const supervisors = useQuery(
    async () => unwrap(await supabase.from('profiles').select('id,email,full_name,app_role')) as Profile[],
    [],
  )

  if (!profile) return null
  const isSupervisor = profile.app_role === 'supervisor'
  const roleName = new Map((roles.data ?? []).map((r) => [r.id, r.name]))
  const supName = new Map((supervisors.data ?? []).map((p) => [p.id, p.full_name || p.email]))

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      unwrap(
        await supabase.from('workers').insert({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          employee_code: form.employee_code.trim() || null,
          role_id: form.role_id || null,
          supervisor_id: profile.id,
        }).select(),
      )
      setForm({ full_name: '', email: '', employee_code: '', role_id: '' })
      workers.reload()
    })
  }

  return (
    <>
      <PageHead tag={isSupervisor ? 'Mi equipo' : 'Todos los equipos'} title="Trabajadores">
        {isSupervisor
          ? 'Registra a tu equipo y asigna el rol de cada persona (uno por trabajador). Si indicas su correo, podrá ver sus propias evaluaciones al ingresar.'
          : 'Vista de lectura de todos los trabajadores.'}
      </PageHead>
      {error && <Alert>{error}</Alert>}

      {isSupervisor && (
        <form className="card row" onSubmit={add} style={{ alignItems: 'flex-end', margin: '16px 0' }}>
          <label className="field" style={{ flex: 2, minWidth: 180 }}>Nombre completo
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </label>
          <label className="field" style={{ flex: 2, minWidth: 180 }}>Correo (opcional)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 120 }}>Código (opcional)
            <input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 160 }}>Rol
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
              <option value="">Sin rol</option>
              {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button className="btn accent">Agregar</button>
        </form>
      )}

      {workers.loading ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Rol</th>{!isSupervisor && <th>Supervisor</th>}<th>Correo</th><th>Cuenta</th><th />
              </tr>
            </thead>
            <tbody>
              {(workers.data ?? []).map((w) => (
                <tr key={w.id} style={{ opacity: w.active ? 1 : 0.55 }}>
                  <td><Link to={`/trabajadores/${w.id}`}><b>{w.full_name}</b></Link>{w.employee_code && <div className="muted">{w.employee_code}</div>}</td>
                  <td>
                    {isSupervisor ? (
                      <select value={w.role_id ?? ''} aria-label={`Rol de ${w.full_name}`} onChange={(e) => void run(async () => {
                        unwrap(await supabase.from('workers').update({ role_id: e.target.value || null }).eq('id', w.id).select())
                        workers.reload()
                      })}>
                        <option value="">Sin rol</option>
                        {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (roleName.get(w.role_id ?? '') ?? '—')}
                  </td>
                  {!isSupervisor && <td>{supName.get(w.supervisor_id) ?? '—'}</td>}
                  <td>{w.email ?? '—'}</td>
                  <td>{w.user_id ? <span className="badge">Vinculada</span> : <span className="badge outline">Sin cuenta</span>}</td>
                  <td className="row end">
                    {isSupervisor && (
                      <>
                        <button className="btn ghost sm" onClick={() => void run(async () => {
                          unwrap(await supabase.from('workers').update({ active: !w.active }).eq('id', w.id).select())
                          workers.reload()
                        })}>{w.active ? 'Desactivar' : 'Activar'}</button>
                        <button className="btn danger sm" onClick={() => void run(async () => {
                          if (!confirm(`¿Eliminar a ${w.full_name} y todas sus evaluaciones?`)) return
                          unwrap(await supabase.from('workers').delete().eq('id', w.id).select())
                          workers.reload()
                        })}>Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {workers.data?.length === 0 && <tr><td colSpan={6} className="muted">Aún no hay trabajadores.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
