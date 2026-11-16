import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { compliance, computeGaps, unwrap, useQuery } from '../lib/data'
import type { CareerTarget, Evaluation, JobRole, RoleSkill, Skill, Worker } from '../lib/types'
import { Alert, LevelLegend, LevelSelect, Loading, PageHead, ProgressBar } from '../components/ui'

export default function WorkerPage() {
  const { id } = useParams()
  return id ? <WorkerView workerId={id} /> : null
}

export function WorkerView({ workerId, self }: { workerId: string; self?: boolean }) {
  const { profile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [compareId, setCompareId] = useState('')
  const [levels, setLevels] = useState<Map<string, number>>(new Map())
  const [target, setTarget] = useState({ role_id: '', date: '', notes: '' })

  const worker = useQuery(
    async () => unwrap(await supabase.from('workers').select('*').eq('id', workerId).maybeSingle()) as Worker | null,
    [workerId],
  )
  const roles = useQuery(async () => unwrap(await supabase.from('job_roles').select('*').order('name')) as JobRole[], [])
  const skills = useQuery(async () => unwrap(await supabase.from('skills').select('*')) as Skill[], [])
  const allReqs = useQuery(async () => unwrap(await supabase.from('role_skills').select('*').order('position')) as RoleSkill[], [])
  const evals = useQuery(
    async () => unwrap(await supabase.from('evaluations').select('*').eq('worker_id', workerId)) as Evaluation[],
    [workerId],
  )
  const targets = useQuery(
    async () => unwrap(await supabase.from('career_targets').select('*').eq('worker_id', workerId)) as CareerTarget[],
    [workerId],
  )

  useEffect(() => {
    setLevels(new Map((evals.data ?? []).map((e) => [e.skill_id, e.level])))
  }, [evals.data])

  const w = worker.data
  useEffect(() => {
    if (!compareId && w) setCompareId(targets.data?.[0]?.target_role_id ?? w.role_id ?? '')
  }, [w, targets.data, compareId])

  if (worker.loading || roles.loading || allReqs.loading) return <Loading />
  if (!w || !profile) return <Alert kind="info">No se encontró al trabajador o no tienes acceso.</Alert>

  const canEdit = !self && profile.app_role === 'supervisor' && w.supervisor_id === profile.id
  const roleById = new Map((roles.data ?? []).map((r) => [r.id, r]))
  const skillById = new Map((skills.data ?? []).map((s) => [s.id, s]))
  const reqsOf = (rid: string) => (allReqs.data ?? []).filter((r) => r.role_id === rid)
  const scoreOf = (rid: string) => compliance(computeGaps(reqsOf(rid), levels))

  async function setLevel(skillId: string, value: number) {
    const prev = levels.get(skillId)
    setLevels((m) => {
      const n = new Map(m)
      if (value === 0) n.delete(skillId)
      else n.set(skillId, value)
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
        if (prev === undefined) n.delete(skillId)
        else n.set(skillId, prev)
        return n
      })
    }
  }

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const addTarget = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      unwrap(await supabase.from('career_targets').insert({
        worker_id: workerId,
        target_role_id: target.role_id,
        target_date: target.date || null,
        notes: target.notes.trim() || null,
        created_by: profile.id,
      }).select())
      setTarget({ role_id: '', date: '', notes: '' })
      setCompareId(target.role_id)
      targets.reload()
    })
  }

  const compareRows = compareId ? computeGaps(reqsOf(compareId), levels) : []
  const missing = compareRows.filter((r) => r.gap > 0)

  return (
    <>
      <PageHead tag={self ? 'Mis evaluaciones' : 'Ficha del trabajador'} title={w.full_name}>
        {roleById.get(w.role_id ?? '')?.name ?? 'Sin rol asignado'}
        {w.email ? ` · ${w.email}` : ''}
      </PageHead>
      {!self && <p style={{ marginTop: -8 }}><Link to="/trabajadores">← Volver a trabajadores</Link></p>}
      {error && <Alert>{error}</Alert>}

      <div className="stack" style={{ marginTop: 16 }}>
        <section className="card stack">
          <div className="row">
            <h2>Brechas contra un rol</h2>
            <span className="spacer" />
            <label className="field" style={{ minWidth: 240 }}>Rol a evaluar
              <select value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                <option value="">Selecciona un rol…</option>
                {(roles.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.id === w.role_id ? ' (rol actual)' : ''}</option>
                ))}
              </select>
            </label>
          </div>
          {!compareId ? (
            <p className="muted" style={{ margin: 0 }}>Elige un rol para ver qué habilidades le faltan.</p>
          ) : compareRows.length === 0 ? (
            <Alert kind="info">Ese rol no tiene habilidades definidas.</Alert>
          ) : (
            <>
              <div className="row">
                <ProgressBar value={scoreOf(compareId)} />
                <span className="muted">
                  {missing.length === 0 ? 'Cumple todas las habilidades del rol.' : `Faltan ${missing.length} de ${compareRows.length} habilidades.`}
                </span>
                <span className="spacer" />
                <LevelLegend />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Habilidad</th><th>Requerido</th><th>Nivel actual</th><th>Brecha</th></tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r) => (
                      <tr key={r.skillId}>
                        <td><b style={{ color: 'var(--azul)' }}>{skillById.get(r.skillId)?.name}</b></td>
                        <td>{r.required}</td>
                        <td>
                          <LevelSelect
                            value={r.current}
                            required={r.required}
                            disabled={!canEdit}
                            label={`Nivel de ${skillById.get(r.skillId)?.name}`}
                            onChange={(v) => void setLevel(r.skillId, v)}
                          />
                        </td>
                        <td>{r.gap > 0 ? <span className="badge orange">Faltan {r.gap} nivel{r.gap > 1 ? 'es' : ''}</span> : <span className="badge">Cumple</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="card stack">
          <h2>Plan de carrera</h2>
          <p className="muted" style={{ margin: 0 }}>Roles a los que aspira o podría llegar el trabajador y su avance hacia cada uno.</p>
          {(targets.data ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>Aún no hay roles objetivo.</p>}
          {(targets.data ?? []).length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rol objetivo</th><th>Avance</th><th>Fecha objetivo</th><th>Notas</th><th /></tr></thead>
                <tbody>
                  {(targets.data ?? []).map((t) => (
                    <tr key={t.target_role_id}>
                      <td><b style={{ color: 'var(--azul)' }}>{roleById.get(t.target_role_id)?.name}</b></td>
                      <td><ProgressBar value={scoreOf(t.target_role_id)} /></td>
                      <td>{t.target_date ?? '—'}</td>
                      <td>{t.notes ?? '—'}</td>
                      <td className="row end">
                        <button className="btn ghost sm" onClick={() => setCompareId(t.target_role_id)}>Ver brechas</button>
                        {canEdit && (
                          <button className="btn danger sm" onClick={() => void run(async () => {
                            unwrap(await supabase.from('career_targets').delete().eq('worker_id', workerId).eq('target_role_id', t.target_role_id).select())
                            targets.reload()
                          })}>Quitar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && (
            <form className="row" onSubmit={addTarget} style={{ alignItems: 'flex-end' }}>
              <label className="field" style={{ minWidth: 200 }}>Rol objetivo
                <select value={target.role_id} onChange={(e) => setTarget({ ...target, role_id: e.target.value })} required>
                  <option value="">Selecciona…</option>
                  {(roles.data ?? [])
                    .filter((r) => !(targets.data ?? []).some((t) => t.target_role_id === r.id))
                    .map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="field">Fecha objetivo
                <input type="date" value={target.date} onChange={(e) => setTarget({ ...target, date: e.target.value })} />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>Notas
                <input value={target.notes} onChange={(e) => setTarget({ ...target, notes: e.target.value })} />
              </label>
              <button className="btn accent">Agregar</button>
            </form>
          )}
        </section>
      </div>
    </>
  )
}
