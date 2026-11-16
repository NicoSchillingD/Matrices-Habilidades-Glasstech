export type AppRole = 'trabajador' | 'supervisor' | 'jefatura' | 'gerencia'
export type Level = 1 | 2 | 3 | 4

export interface Profile {
  id: string
  email: string
  full_name: string
  app_role: AppRole
}
export interface JobRole {
  id: string
  name: string
  description: string | null
  created_by: string
}
export interface Skill {
  id: string
  name: string
  description: string | null
  category: string | null
  created_by: string
}
export interface RoleSkill {
  role_id: string
  skill_id: string
  required_level: Level
  position: number
}
export interface Worker {
  id: string
  full_name: string
  email: string | null
  employee_code: string | null
  role_id: string | null
  supervisor_id: string
  user_id: string | null
  active: boolean
}
export interface Evaluation {
  worker_id: string
  skill_id: string
  level: Level
  notes: string | null
  evaluated_at: string
}
export interface CareerTarget {
  worker_id: string
  target_role_id: string
  target_date: string | null
  notes: string | null
}

export const ROLE_LABEL: Record<AppRole, string> = {
  trabajador: 'Trabajador',
  supervisor: 'Supervisor',
  jefatura: 'Jefatura',
  gerencia: 'Gerencia',
}

export const LEVELS: Level[] = [1, 2, 3, 4]
