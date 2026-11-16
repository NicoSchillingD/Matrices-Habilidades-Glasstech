import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { compliance, computeGaps, unwrap, useQuery } from '../lib/data'
import type { Evaluation, JobRole, RoleSkill, Skill, Worker } from '../lib/types'
import { Alert, Loading, LevelLegend, LevelSelect, PageHead, ProgressBar } from '../components/ui'

export default function MatrixPage() {
  const { profile } = useAuth()
  const [roleId, setRoleId] = useState<string>('')
  const [levels, setLevels] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const roles = useQuery(
    async () => unwrap(await supabase.from('job_roles').select('*').order('name')) as JobRole[],
    [],
  )
  const skills = useQuery(
    async () => unwrap(await supabase.from('skills').select('*')) as Skill[],
    [],
  )
  const workers = useQuery(
    async () => unwrap(await supabase.from('workers').select('*').eq('active', true).order('full_name')) as Worker[],
    [],
  )
  const reqs = useQuery(
    async () =>
      roleId
        ? (unwrap(await supabase.from('role_skills').select('*').eq('role_id', roleId).order('position')) as RoleSkill[])
        : [],
    [roleId],
  )

  const team = useMemo(() => (workers.data ?? []).filter((w) => w.role_id === roleId), [workers.data, roleId])
  const teamKey = team.map((w) => w.id).join(',')

  const evals = useQuery(
    async () =>
      team.length
        ? (unwrap(await supabase.from('evaluations').select('*').in('worker_id', team.map((w) => w.id))) as Evaluation[])
        : [],
    [teamKey],
  )

  useEffect(() => {
    setLevels(new Map((evals.data ?? []).map((e) => [`${e.worker_id}:${e.skill_id}`, e.level])))
  }, [evals.data])

  // Rol inicial: el primero que tenga trabajadores
  useEffect(() => {
    if (roleId || !roles.data || !workers.data) return
    const withPeople = roles.data.find((r) => workers.data!.some((w) => w.role_id === r.id))
    setRoleId((withPeople ?? roles.data[0])?.id ?? '')
  }, [roles.data, workers.data, roleId])

  if (!profile) return null
  const canEdit = profile.app_role === 'supervisor'
  const skillById = new Map((skills.data ?? []).map((s) => [s.id, s]))
  const requirements = reqs.data ?? []

  async function setLevel(workerId: string, skillId: string, value: number) {
    const key = `${workerId}:${skillId}`
    const prev = levels.get(key)
    setLevels((m) => {
      const n = new Map(m)
      if (value === 0) n.delete(key)
      else n.set(key, value)
      return n
    })
    setError(null)
    try {
      if (value === 0) {
        unwrap(await supabase.from('evaluations').delete().eq('worker_id', workerId).eq('skill_id', skillId).select())
      } else {
        unwrap(await supabase.from('evaluations').upsert(
          { worker_id: workerId, skill_id: skillId, level: value, evaluated_by: profile!.id },
          { onConflict: 'worker_id,skill_id' },
        ).select())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLevels((m) => {
        const n = new Map(m)
        if (prev === undefined) n.delete(key)
        else n.set(key, prev)
        return n
      })
    }
  }

  return (
    <>
      <PageHead tag={canEdit ? 'Mi equipo' : 'Todos los equipos'} title="Matriz de habilidades">
        {canEdit
          ? 'Califica a cada trabajador de 1 a 4 en las habilidades de su rol. El borde naranjo indica que aún no alcanza el nivel requerido.'
          : 'Vista de lectura de las matrices de todos los trabajadores.'}
      </PageHead>
      <div className="row" style={{ marginBottom: 16 }}>
        <label className="field" style={{ minWidth: 240 }}>Rol
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <span className="spacer" />
        <LevelLegend />
      </div>
      {error && <Alert>{error}</Alert>}
      {roles.loading || workers.loading || reqs.loading ? <Loading /> : !roleId ? (
        <Alert kind="info">Primero crea un rol en “Roles y habilidades”.</Alert>
      ) : requirements.length === 0 ? (
        <Alert kind="info">Este rol aún no tiene habilidades. Agrégalas en “Roles y habilidades”.</Alert>
      ) : team.length === 0 ? (
        <Alert kind="info">No hay trabajadores con este rol{canEdit ? '. Asígnalo en “Trabajadores”.' : '.'}</Alert>
      ) : (
        <div className="table-wrap" style={{ marginTop: error ? 16 : 0 }}>
          <table className="matrix">
            <thead>
              <tr>
                <th className="name">Trabajador</th>
                {requirements.map((r) => (
                  <th key={r.skill_id} className="skill">
                    {skillById.get(r.skill_id)?.name}
                    <span className="req">Requerido: {r.required_level}</span>
                  </th>
                ))}
                <th>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {team.map((w) => {
                const lv = new Map(requirements.map((r) => [r.skill_id, levels.get(`${w.id}:${r.skill_id}`) ?? 0]))
                return (
                  <tr key={w.id}>
                    <td className="name"><Link to={`/trabajadores/${w.id}`}><b>{w.full_name}</b></Link></td>
                    {requirements.map((r) => (
                      <td key={r.skill_id} className="cell">
                        <LevelSelect
                          value={lv.get(r.skill_id) ?? 0}
                          required={r.required_level}
                          disabled={!canEdit}
                          label={`${w.full_name}: ${skillById.get(r.skill_id)?.name}`}
                          onChange={(v) => void setLevel(w.id, r.skill_id, v)}
                        />
                      </td>
                    ))}
                    <td><ProgressBar value={compliance(computeGaps(requirements, lv))} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
