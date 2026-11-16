-- Matrices Habilidades Glasstech — esquema inicial
-- Modelo: catálogo compartido de habilidades; los roles se componen de habilidades con un
-- nivel requerido (1-4). Las calificaciones son por (trabajador, habilidad), de modo que se
-- puede comparar a un trabajador contra CUALQUIER rol y obtener sus brechas.

-- ───────── Tipos ─────────
create type public.app_role as enum ('trabajador', 'supervisor', 'jefatura', 'gerencia');

-- ───────── Helpers (schema privado, no expuesto por la API) ─────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────── Perfiles ─────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  app_role public.app_role not null default 'trabajador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select app_role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_supervisor()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() = 'supervisor', false); $$;

-- Jefatura y Gerencia: lectura global
create or replace function private.is_management()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() in ('jefatura', 'gerencia'), false); $$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() = 'gerencia', false); $$;

-- ───────── Roles de cargo, habilidades y requisitos ─────────
create table public.job_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index job_roles_name_key on public.job_roles (lower(name));
create index job_roles_created_by_idx on public.job_roles (created_by);
create trigger job_roles_updated_at before update on public.job_roles
  for each row execute function private.set_updated_at();

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index skills_name_key on public.skills (lower(name));
create index skills_created_by_idx on public.skills (created_by);
create trigger skills_updated_at before update on public.skills
  for each row execute function private.set_updated_at();

-- Habilidades requeridas por rol, con nivel mínimo esperado (1-4)
create table public.role_skills (
  role_id uuid not null references public.job_roles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  required_level smallint not null default 3 check (required_level between 1 and 4),
  position integer not null default 0,
  primary key (role_id, skill_id)
);
create index role_skills_skill_id_idx on public.role_skills (skill_id);

-- ───────── Trabajadores ─────────
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  employee_code text,
  role_id uuid references public.job_roles (id) on delete set null,
  supervisor_id uuid not null default auth.uid() references public.profiles (id),
  user_id uuid unique references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workers_supervisor_id_idx on public.workers (supervisor_id);
create index workers_role_id_idx on public.workers (role_id);
create unique index workers_email_key on public.workers (lower(email)) where email is not null;
create trigger workers_updated_at before update on public.workers
  for each row execute function private.set_updated_at();

-- ───────── Evaluaciones (nivel 1-4; sin fila = no evaluada) ─────────
create table public.evaluations (
  worker_id uuid not null references public.workers (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint not null check (level between 1 and 4),
  notes text,
  evaluated_by uuid not null default auth.uid() references public.profiles (id),
  evaluated_at timestamptz not null default now(),
  primary key (worker_id, skill_id)
);
create index evaluations_skill_id_idx on public.evaluations (skill_id);
create index evaluations_evaluated_by_idx on public.evaluations (evaluated_by);

-- Historial de cambios de nivel (base para los planes de carrera)
create table public.evaluation_history (
  id bigint generated always as identity primary key,
  worker_id uuid not null references public.workers (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint check (level between 1 and 4),
  evaluated_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);
create index evaluation_history_worker_idx on public.evaluation_history (worker_id, skill_id);
create index evaluation_history_skill_idx on public.evaluation_history (skill_id);
create index evaluation_history_evaluated_by_idx on public.evaluation_history (evaluated_by);

create or replace function private.log_evaluation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- En borrados en cascada (trabajador o habilidad eliminados) no hay a qué referenciar
    if exists (select 1 from public.workers where id = old.worker_id)
       and exists (select 1 from public.skills where id = old.skill_id) then
      insert into public.evaluation_history (worker_id, skill_id, level, evaluated_by)
      values (old.worker_id, old.skill_id, null, (select auth.uid()));
    end if;
    return old;
  end if;
  new.evaluated_at = now();
  insert into public.evaluation_history (worker_id, skill_id, level, evaluated_by)
  values (new.worker_id, new.skill_id, new.level, new.evaluated_by);
  return new;
end;
$$;
create trigger evaluations_log
  before insert or update of level or delete on public.evaluations
  for each row execute function private.log_evaluation();

-- ───────── Plan de carrera: roles objetivo de cada trabajador ─────────
create table public.career_targets (
  worker_id uuid not null references public.workers (id) on delete cascade,
  target_role_id uuid not null references public.job_roles (id) on delete cascade,
  target_date date,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (worker_id, target_role_id)
);
create index career_targets_target_role_idx on public.career_targets (target_role_id);
create index career_targets_created_by_idx on public.career_targets (created_by);

-- Brechas: para cada trabajador x cada rol, qué le falta por habilidad.
-- security_invoker: respeta el RLS de quien consulta.
create view public.worker_role_gaps
with (security_invoker = true) as
select
  w.id as worker_id,
  rs.role_id,
  rs.skill_id,
  rs.required_level,
  coalesce(e.level, 0)::smallint as current_level,
  greatest(rs.required_level - coalesce(e.level, 0), 0)::smallint as gap
from public.workers w
cross join public.role_skills rs
left join public.evaluations e
  on e.worker_id = w.id and e.skill_id = rs.skill_id;

-- ───────── Alta de usuarios: perfil + vínculo con trabajador por correo ─────────
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  -- Solo vincula si el correo ya fue confirmado por el proveedor de autenticación
  if new.email_confirmed_at is not null then
    update public.workers set user_id = new.id
    where lower(email) = lower(new.email) and user_id is null;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.workers set user_id = new.id
    where lower(email) = lower(new.email) and user_id is null;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_confirmed();

-- Si el trabajador se registra en la ficha después de que el usuario ya existe
create or replace function private.link_worker_on_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is null and new.email is not null then
    select p.id into new.user_id
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.email) = lower(new.email)
      and u.email_confirmed_at is not null
      and not exists (select 1 from public.workers w2 where w2.user_id = p.id and w2.id <> new.id)
    limit 1;
  end if;
  return new;
end;
$$;
create trigger workers_link_user
  before insert or update of email on public.workers
  for each row execute function private.link_worker_on_write();

-- ───────── Funciones de acceso por trabajador ─────────
create or replace function private.can_read_worker(w uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_management()
    or exists (
      select 1 from public.workers
      where id = w
        and (supervisor_id = (select auth.uid()) or user_id = (select auth.uid()))
    );
$$;

create or replace function private.can_write_worker(w uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workers
    where id = w and supervisor_id = (select auth.uid())
  ) and private.is_supervisor();
$$;

grant execute on all functions in schema private to authenticated;

-- ───────── RLS ─────────
alter table public.profiles enable row level security;
alter table public.job_roles enable row level security;
alter table public.skills enable row level security;
alter table public.role_skills enable row level security;
alter table public.workers enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_history enable row level security;
alter table public.career_targets enable row level security;

-- profiles: cada uno ve el suyo; jefatura/gerencia ven todos; solo gerencia cambia perfiles/roles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_management());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Catálogo: lectura para todos los autenticados; escritura por supervisores (dueño) y gerencia
create policy job_roles_select on public.job_roles for select to authenticated using (true);
create policy job_roles_insert on public.job_roles for insert to authenticated
  with check ((private.is_supervisor() or private.is_admin()) and created_by = (select auth.uid()));
create policy job_roles_update on public.job_roles for update to authenticated
  using (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin())
  with check (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin());
create policy job_roles_delete on public.job_roles for delete to authenticated
  using (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin());

create policy skills_select on public.skills for select to authenticated using (true);
create policy skills_insert on public.skills for insert to authenticated
  with check ((private.is_supervisor() or private.is_admin()) and created_by = (select auth.uid()));
create policy skills_update on public.skills for update to authenticated
  using (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin())
  with check (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin());
create policy skills_delete on public.skills for delete to authenticated
  using (created_by = (select auth.uid()) and private.is_supervisor() or private.is_admin());

create policy role_skills_select on public.role_skills for select to authenticated using (true);
create policy role_skills_insert on public.role_skills for insert to authenticated
  with check (
    private.is_admin()
    or (private.is_supervisor() and exists (
      select 1 from public.job_roles r where r.id = role_id and r.created_by = (select auth.uid())))
  );
create policy role_skills_update on public.role_skills for update to authenticated
  using (
    private.is_admin()
    or (private.is_supervisor() and exists (
      select 1 from public.job_roles r where r.id = role_id and r.created_by = (select auth.uid())))
  )
  with check (
    private.is_admin()
    or (private.is_supervisor() and exists (
      select 1 from public.job_roles r where r.id = role_id and r.created_by = (select auth.uid())))
  );
create policy role_skills_delete on public.role_skills for delete to authenticated
  using (
    private.is_admin()
    or (private.is_supervisor() and exists (
      select 1 from public.job_roles r where r.id = role_id and r.created_by = (select auth.uid())))
  );

-- workers
create policy workers_select on public.workers for select to authenticated
  using (private.can_read_worker(id));
create policy workers_insert on public.workers for insert to authenticated
  with check (private.is_supervisor() and supervisor_id = (select auth.uid()));
create policy workers_update on public.workers for update to authenticated
  using (private.can_write_worker(id))
  with check (private.is_supervisor() and supervisor_id = (select auth.uid()));
create policy workers_delete on public.workers for delete to authenticated
  using (private.can_write_worker(id));

-- evaluations: lectura (supervisor del trabajador, jefatura/gerencia, el propio trabajador); escritura solo supervisor
create policy evaluations_select on public.evaluations for select to authenticated
  using (private.can_read_worker(worker_id));
create policy evaluations_insert on public.evaluations for insert to authenticated
  with check (private.can_write_worker(worker_id) and evaluated_by = (select auth.uid()));
create policy evaluations_update on public.evaluations for update to authenticated
  using (private.can_write_worker(worker_id))
  with check (private.can_write_worker(worker_id) and evaluated_by = (select auth.uid()));
create policy evaluations_delete on public.evaluations for delete to authenticated
  using (private.can_write_worker(worker_id));

create policy evaluation_history_select on public.evaluation_history for select to authenticated
  using (private.can_read_worker(worker_id));

-- career_targets: mismas reglas que evaluations
create policy career_targets_select on public.career_targets for select to authenticated
  using (private.can_read_worker(worker_id));
create policy career_targets_insert on public.career_targets for insert to authenticated
  with check (private.can_write_worker(worker_id) and created_by = (select auth.uid()));
create policy career_targets_update on public.career_targets for update to authenticated
  using (private.can_write_worker(worker_id))
  with check (private.can_write_worker(worker_id) and created_by = (select auth.uid()));
create policy career_targets_delete on public.career_targets for delete to authenticated
  using (private.can_write_worker(worker_id));

-- ───────── Permisos de tabla ─────────
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.evaluation_history from authenticated;
-- profiles: creación solo por trigger; el UPDATE queda acotado por la política (solo gerencia)
revoke insert, delete on public.profiles from authenticated;
