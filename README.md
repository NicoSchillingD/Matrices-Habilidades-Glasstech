# Matrices Habilidades Glasstech

Aplicación para que los supervisores armen matrices de habilidades por rol, califiquen a sus
trabajadores (niveles 1–4) y diseñen planes de carrera.

## Perfiles
| Perfil | Puede |
| --- | --- |
| Supervisor | Crear roles y habilidades, administrar sus trabajadores, calificarlos y definir roles objetivo (plan de carrera). |
| Jefatura / Gerencia | Ver las matrices de todos los trabajadores. Gerencia además asigna perfiles a los usuarios. |
| Trabajador | Ver solo sus propias evaluaciones y brechas. |

## Modelo de datos (`supabase/migrations/`)
- `skills`: catálogo compartido de habilidades. `job_roles`: roles de cargo.
- `role_skills`: habilidades de cada rol con nivel requerido (1–4).
- `workers`: cada trabajador tiene **un** rol. `evaluations`: nivel 1–4 por (trabajador, habilidad); sin fila = no evaluada.
- `career_targets`: roles a los que aspira cada trabajador. Vista `worker_role_gaps`: brechas contra **cualquier** rol.
- La seguridad es por RLS; los perfiles se crean al registrarse con perfil `trabajador` (Gerencia sube los privilegios).

## Diseño
Sistema de diseño Glasstech (Raleway/Montserrat; azul `#00324B`, celeste `#0096D2`, naranjo `#F7841C`, gris `#7E96A2`).

## Puesta en marcha
```bash
cp .env.example .env
npm install
npm run dev
```

### Primer usuario Gerencia (una sola vez)
Quien se registra queda como `trabajador`. Después de registrar y confirmar tu correo, asigna el primer perfil
Gerencia desde el SQL Editor de Supabase; luego Gerencia administra al resto desde la app (menú *Usuarios*):

```sql
update public.profiles set app_role = 'gerencia' where email = 'tu-correo@glasstech.cl';
```

### Autenticación en Supabase
Mantén activada la confirmación de correo (Authentication → Providers → Email). El vínculo trabajador ↔ cuenta
solo se hace con correos confirmados. En *URL Configuration* define la *Site URL* de producción.

## Despliegue en Vercel
1. En Vercel: *Add New → Project* e importa este repositorio (el preset *Vite* se detecta solo; `vercel.json` ya define la regla SPA).
2. En *Environment Variables* agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de `.env.example`.
3. Tras el primer deploy, copia la URL de producción a Supabase → Authentication → URL Configuration (*Site URL* y *Redirect URLs*).
