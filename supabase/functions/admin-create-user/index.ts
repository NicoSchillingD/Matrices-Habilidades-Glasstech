// Crea usuarios con contraseña inicial. Solo puede invocarla un usuario con perfil Gerencia.
// Usa la clave de servicio (disponible automáticamente en Edge Functions); nunca llega al navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ROLES = ['trabajador', 'supervisor', 'jefatura', 'gerencia']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Identificar a quien llama y exigir perfil Gerencia
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt)
  if (callerErr || !caller.user) return json({ error: 'Sesión no válida' }, 401)
  const { data: prof } = await admin.from('profiles').select('app_role').eq('id', caller.user.id).single()
  if (prof?.app_role !== 'gerencia') return json({ error: 'Solo Gerencia puede crear usuarios' }, 403)

  // 2) Validar datos
  let body: { email?: string; password?: string; full_name?: string; app_role?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = (body.full_name ?? '').trim()
  const role = body.app_role ?? 'trabajador'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Correo no válido' }, 400)
  if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
  if (!fullName) return json({ error: 'Falta el nombre' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Perfil no válido' }, 400)

  // 3) Crear usuario con correo ya confirmado (el trigger crea el perfil y vincula la ficha del trabajador)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) {
    const dup = /already|registered|exists/i.test(error?.message ?? '')
    return json({ error: dup ? 'Ese correo ya está registrado' : (error?.message ?? 'No se pudo crear el usuario') }, dup ? 409 : 400)
  }

  const { error: roleErr } = await admin.from('profiles').update({ app_role: role, full_name: fullName }).eq('id', data.user.id)
  if (roleErr) {
    await admin.auth.admin.deleteUser(data.user.id) // no dejar un usuario a medio crear
    return json({ error: 'No se pudo asignar el perfil: ' + roleErr.message }, 500)
  }
  return json({ id: data.user.id, email, app_role: role }, 201)
})
