# Matrices Habilidades Glasstech

App para que supervisores armen matrices de habilidades por rol, califiquen trabajadores (niveles 1–4) y
diseñen planes de carrera. UI en español (Chile), diseño según el sistema de diseño Glasstech.

## Comandos
- `npm install` · `npm run dev` · `npm run build` (tsc + vite) · `npm run typecheck`
- Copiar `.env.example` a `.env`. **Ojo:** una variable `VITE_SUPABASE_URL` ya definida en el shell pisa al `.env`.

## Stack
React 18 + Vite + TypeScript, `react-router-dom`, `@supabase/supabase-js`. Sin librería de UI: estilos propios en
`src/styles/app.css` sobre los tokens de `src/styles/tokens.css` (copia del sistema de diseño Glasstech).

## Backend (Supabase, proyecto `gzjsbwcuweuqxnuosbir`, sa-east-1)
- El esquema vive en `supabase/migrations/` y es la fuente de verdad. Cada cambio = migración nueva (no editar las aplicadas).
- Toda la seguridad es RLS; el cliente usa solo la clave publicable. Funciones de ayuda en el schema `private`.
- Tras cambios de DDL correr los advisors de seguridad de Supabase.
- Gotcha RLS: una política de `SELECT` que consulte su propia tabla desde una función no ve la fila de un
  `INSERT ... RETURNING`. Evaluar columnas directamente (ver `20261116000100_fix_workers_select_policy.sql`).

## Modelo
- `skills` = catálogo compartido; `role_skills` = habilidades de un rol con `required_level` (1–4).
- `evaluations` = nivel por (trabajador, habilidad); sin fila = sin evaluar. Un trabajador tiene UN rol (`workers.role_id`).
- Brechas contra cualquier rol: se calculan comparando `evaluations` con `role_skills` del rol elegido
  (`computeGaps` en `src/lib/data.ts`; también existe la vista `worker_role_gaps`).
- Perfiles (`profiles.app_role`): `trabajador` (solo lo suyo), `supervisor` (escribe sobre sus trabajadores),
  `jefatura`/`gerencia` (lectura global; solo gerencia cambia perfiles).

## Convenciones de diseño
Títulos Raleway Bold con tracking -0.02em; subtítulos con rectángulo naranjo cuadrado (`.subtitle-tag`);
texto Montserrat. Naranjo solo para la acción principal. Sin emojis.
