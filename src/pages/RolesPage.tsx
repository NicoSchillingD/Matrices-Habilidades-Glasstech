import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { unwrap, useQuery } from '../lib/data'
import { LEVELS, type JobRole, type Level, type RoleSkill, type Skill } from '../lib/types'
import { Alert, Loading, PageHead } from '../components/ui'

export default function RolesPage() {
  const { profile } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newRole, setNewRole] = useState('')

  const roles = useQuery(
    async () => unwrap(await supabase.from('job_roles').select('*').order('name')) as JobRole[],
    [],
  )
  const skills = useQuery(
    async () => unwrap(await supabase.from('skills').select('*').order('name')) as Skill[],
    [],
  )
  const reqs = useQuery(
    async () =>
      selectedId
        ? (unwrap(
            await supabase.from('role_skills').select('*').eq('role_id', selectedId).order('position'),
          ) as RoleSkill[])
        : [],
    [selectedId],
  )

  if (!profile) return null
  const canCreate = profile.app_role === 'supervisor' || profile.app_role === 'gerencia'
  const selected = roles.data?.find((r) => r.id === selectedId) ?? null
  const canEdit =
    !!selected && (profile.app_role === 'gerencia' || (profile.app_role === 'supervisor' && selected.created_by === profile.id))
  const skillById = new Map((skills.data ?? []).map((s) => [s.id, s]))

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const addRole = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const row = unwrap(
        await supabase.from('job_roles').insert({ name: newRole.trim(), created_by: profile.id }).select().single(),
      ) as JobRole
      setNewRole('')
      roles.reload()
      setSelectedId(row.id)
    })
  }

  const deleteRole = () =>
    void run(async () => {
      if (!selected || !confirm(`¿Eliminar el rol "${selected.name}"? Los trabajadores quedarán sin rol.`)) return
      unwrap(await supabase.from('job_roles').delete().eq('id', selected.id).select())
      setSelectedId(null)
      roles.reload()
    })

  return (
    <>
      <PageHead tag="Catálogo" title="Roles y habilidades">
        Define para cada rol las habilidades necesarias y el nivel esperado (1 a 4). Las habilidades son un catálogo
        compartido: si ya existe, se reutiliza, y así puedes comparar a un trabajador contra cualquier rol.
      </PageHead>
      {error && <Alert>{error}</Alert>}
      <div className="grid-2" style={{ marginTop: error ? 16 : 0 }}>
        <div className="card stack">
          <h3>Roles</h3>
          {roles.loading ? <Loading /> : (
            <ul className="list">
              {(roles.data ?? []).map((r) => (
                <li key={r.id}>
                  <button className={r.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(r.id)}>{r.name}</button>
                </li>
              ))}
              {roles.data?.length === 0 && <li className="muted">Aún no hay roles.</li>}
            </ul>
          )}
          {canCreate && (
            <form className="row" onSubmit={addRole}>
              <input style={{ flex: 1 }} placeholder="Nuevo rol" value={newRole} onChange={(e) => setNewRole(e.target.value)} required aria-label="Nombre del nuevo rol" />
              <button className="btn sm accent">Crear</button>
            </form>
          )}
        </div>

        <div className="card stack">
          {!selected ? (
            <p className="muted" style={{ margin: 0 }}>Selecciona un rol para ver sus habilidades.</p>
          ) : (
            <>
              <div className="row">
                <h2>{selected.name}</h2>
                {!canEdit && <span className="badge outline">Solo lectura</span>}
                <span className="spacer" />
                {canEdit && <button className="btn danger sm" onClick={deleteRole}>Eliminar rol</button>}
              </div>
              {reqs.loading ? <Loading /> : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Habilidad</th><th>Categoría</th><th>Nivel requerido</th><th /></tr>
                    </thead>
                    <tbody>
                      {(reqs.data ?? []).map((rs) => {
                        const sk = skillById.get(rs.skill_id)
                        return (
                          <tr key={rs.skill_id}>
                            <td><b style={{ color: 'var(--azul)' }}>{sk?.name}</b>{sk?.description && <div className="muted">{sk.description}</div>}</td>
                            <td>{sk?.category ?? '—'}</td>
                            <td>
                              <select value={rs.required_level} disabled={!canEdit} aria-label={`Nivel requerido de ${sk?.name}`}
                                onChange={(e) => void run(async () => {
                                  unwrap(await supabase.from('role_skills').update({ required_level: Number(e.target.value) as Level })
                                    .eq('role_id', rs.role_id).eq('skill_id', rs.skill_id).select())
                                  reqs.reload()
                                })}>
                                {LEVELS.map((l) => <option key={l} value={l}>Nivel {l}</option>)}
                              </select>
                            </td>
                            <td className="row end">
                              {canEdit && (
                                <button className="btn danger sm" onClick={() => void run(async () => {
                                  unwrap(await supabase.from('role_skills').delete().eq('role_id', rs.role_id).eq('skill_id', rs.skill_id).select())
                                  reqs.reload()
                                })}>Quitar</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {reqs.data?.length === 0 && <tr><td colSpan={4} className="muted">Este rol aún no tiene habilidades.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {canEdit && (
                <AddSkill
                  roleId={selected.id}
                  userId={profile.id}
                  catalog={skills.data ?? []}
                  existing={new Set((reqs.data ?? []).map((r) => r.skill_id))}
                  nextPosition={(reqs.data?.length ?? 0) + 1}
                  onError={setError}
                  onAdded={() => { reqs.reload(); skills.reload() }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function AddSkill({ roleId, userId, catalog, existing, nextPosition, onAdded, onError }: {
  roleId: string
  userId: string
  catalog: Skill[]
  existing: Set<string>
  nextPosition: number
  onAdded: () => void
  onError: (m: string | null) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState<Level>(3)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    onError(null)
    try {
      const clean = name.trim()
      let skill = catalog.find((s) => s.name.toLowerCase() === clean.toLowerCase())
      if (!skill) {
        skill = unwrap(
          await supabase.from('skills').insert({ name: clean, category: category.trim() || null, created_by: userId }).select().single(),
        ) as Skill
      }
      if (existing.has(skill.id)) throw new Error('Esa habilidad ya está en el rol.')
      unwrap(await supabase.from('role_skills').insert({ role_id: roleId, skill_id: skill.id, required_level: level, position: nextPosition }).select())
      setName('')
      setCategory('')
      onAdded()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  return (
    <form className="row" onSubmit={submit} style={{ alignItems: 'flex-end' }}>
      <label className="field" style={{ flex: 2, minWidth: 200 }}>Habilidad (escribe una nueva o elige del catálogo)
        <input list="skill-catalog" value={name} onChange={(e) => setName(e.target.value)} required />
        <datalist id="skill-catalog">
          {catalog.filter((s) => !existing.has(s.id)).map((s) => <option key={s.id} value={s.name} />)}
        </datalist>
      </label>
      <label className="field" style={{ flex: 1, minWidth: 140 }}>Categoría (si es nueva)
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <label className="field">Nivel requerido
        <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level)}>
          {LEVELS.map((l) => <option key={l} value={l}>Nivel {l}</option>)}
        </select>
      </label>
      <button className="btn accent" disabled={busy}>Agregar</button>
    </form>
  )
}
