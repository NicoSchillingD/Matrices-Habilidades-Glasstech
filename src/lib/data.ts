import { useCallback, useEffect, useState } from 'react'

/** Carga asíncrona con recarga manual. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fn()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

/** Lanza si Supabase devolvió error. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export interface GapRow {
  skillId: string
  required: number
  current: number
  gap: number
}

/** Brecha de un trabajador contra los requisitos de un rol. */
export function computeGaps(
  requirements: { skill_id: string; required_level: number }[],
  levels: Map<string, number>,
): GapRow[] {
  return requirements.map((r) => {
    const current = levels.get(r.skill_id) ?? 0
    return {
      skillId: r.skill_id,
      required: r.required_level,
      current,
      gap: Math.max(r.required_level - current, 0),
    }
  })
}

/** % de cumplimiento: suma del nivel alcanzado (tope = requerido) sobre suma de requeridos. */
export function compliance(rows: GapRow[]): number {
  const total = rows.reduce((a, r) => a + r.required, 0)
  if (total === 0) return 0
  const got = rows.reduce((a, r) => a + Math.min(r.current, r.required), 0)
  return Math.round((got / total) * 100)
}
