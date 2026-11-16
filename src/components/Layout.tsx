import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, type AppRole } from '../lib/types'

const NAV: { to: string; label: string; roles: AppRole[] }[] = [
  { to: '/matriz', label: 'Matriz', roles: ['supervisor', 'jefatura', 'gerencia'] },
  { to: '/trabajadores', label: 'Trabajadores', roles: ['supervisor', 'jefatura', 'gerencia'] },
  { to: '/roles', label: 'Roles y habilidades', roles: ['supervisor', 'jefatura', 'gerencia'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['gerencia'] },
  { to: '/mis-evaluaciones', label: 'Mis evaluaciones', roles: ['trabajador'] },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  if (!profile) return null
  return (
    <>
      <header className="app-header">
        <img className="logo" src="/brand/logo.jpg" alt="Glasstech" />
        <nav className="app-nav" aria-label="Principal">
          {NAV.filter((n) => n.roles.includes(profile.app_role)).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <div className="who">
            <b>{profile.full_name || profile.email}</b>
            {ROLE_LABEL[profile.app_role]}
          </div>
          <button className="btn secondary sm" onClick={signOut}>Salir</button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
