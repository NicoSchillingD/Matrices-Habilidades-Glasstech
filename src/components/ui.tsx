import type { ReactNode } from 'react'
import { LEVELS, type Level } from '../lib/types'

export function SubtitleTag({ children }: { children: ReactNode }) {
  return <span className="subtitle-tag">{children}</span>
}

export function PageHead({ tag, title, children }: { tag: string; title: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <SubtitleTag>{tag}</SubtitleTag>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function Loading() {
  return <div className="center">Cargando…</div>
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <span className={`bar${value >= 100 ? ' full' : ''}`} aria-hidden>
        <i style={{ width: `${Math.min(value, 100)}%` }} />
      </span>
      <b style={{ color: 'var(--azul)', fontSize: 13 }}>{value}%</b>
    </span>
  )
}

/** Selector de nivel: 0 = sin evaluar, 1–4. Borde naranjo inferior si no alcanza el requerido. */
export function LevelSelect({
  value,
  required,
  disabled,
  onChange,
  label,
}: {
  value: number
  required?: number
  disabled?: boolean
  onChange?: (v: number) => void
  label: string
}) {
  const short = required !== undefined && value < required
  return (
    <select
      className={`lvl l${value}${short ? ' short' : ''}`}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange?.(Number(e.target.value))}
    >
      <option value={0}>–</option>
      {LEVELS.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  )
}

export function LevelLegend() {
  return (
    <div className="legend" aria-label="Leyenda de niveles">
      <span><b className="lvl l0">–</b> Sin evaluar</span>
      {LEVELS.map((l: Level) => (
        <span key={l}><b className={`lvl l${l}`}>{l}</b> Nivel {l}</span>
      ))}
      <span><b className="lvl l1 short">1</b> Bajo el nivel requerido</span>
    </div>
  )
}
