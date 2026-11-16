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

## Configuración
Copia `.env.example` a `.env`.
