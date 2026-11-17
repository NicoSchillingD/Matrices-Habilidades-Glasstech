import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import type { AppRole } from './lib/types'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import AccountPage from './pages/AccountPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MatrixPage from './pages/MatrixPage'
import MyEvaluationsPage from './pages/MyEvaluationsPage'
import RolesPage from './pages/RolesPage'
import UsersPage from './pages/UsersPage'
import WorkerPage from './pages/WorkerPage'
import WorkersPage from './pages/WorkersPage'

const STAFF: AppRole[] = ['supervisor', 'jefatura', 'gerencia']

function Guard({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return null
  return roles.includes(profile.app_role) ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { session, profile, loading, recovering } = useAuth()
  if (recovering) return <ResetPasswordPage />
  if (loading) return <Loading />
  if (!session) return <LoginPage />
  if (!profile) return <div className="center">No se pudo cargar tu perfil. Cierra sesión e inténtalo de nuevo.</div>

  const home = profile.app_role === 'trabajador' ? '/mis-evaluaciones' : '/matriz'
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/matriz" element={<Guard roles={STAFF}><MatrixPage /></Guard>} />
        <Route path="/trabajadores" element={<Guard roles={STAFF}><WorkersPage /></Guard>} />
        <Route path="/trabajadores/:id" element={<Guard roles={STAFF}><WorkerPage /></Guard>} />
        <Route path="/roles" element={<Guard roles={STAFF}><RolesPage /></Guard>} />
        <Route path="/usuarios" element={<Guard roles={['gerencia']}><UsersPage /></Guard>} />
        <Route path="/mis-evaluaciones" element={<Guard roles={['trabajador']}><MyEvaluationsPage /></Guard>} />
        <Route path="/cuenta" element={<AccountPage />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}
