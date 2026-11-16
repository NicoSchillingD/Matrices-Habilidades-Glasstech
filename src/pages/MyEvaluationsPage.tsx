import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { unwrap, useQuery } from '../lib/data'
import { Alert, Loading, PageHead } from '../components/ui'
import { WorkerView } from './WorkerPage'

export default function MyEvaluationsPage() {
  const { profile } = useAuth()
  const me = useQuery(
    async () =>
      unwrap(await supabase.from('workers').select('id').eq('user_id', profile?.id ?? '').maybeSingle()) as { id: string } | null,
    [profile?.id],
  )
  if (me.loading) return <Loading />
  if (!me.data) {
    return (
      <>
        <PageHead tag="Mis evaluaciones" title="Aún no tienes evaluaciones" />
        <Alert kind="info">
          Tu cuenta todavía no está vinculada a una ficha de trabajador. Pide a tu supervisor que registre tu correo
          ({profile?.email}) en la lista de trabajadores.
        </Alert>
      </>
    )
  }
  return <WorkerView workerId={me.data.id} self />
}
