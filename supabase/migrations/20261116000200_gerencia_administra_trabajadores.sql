-- Gerencia puede crear, editar (incluido reasignar supervisor) y eliminar trabajadores.
-- Las evaluaciones y planes de carrera siguen siendo exclusivos del supervisor del trabajador.
drop policy workers_insert on public.workers;
drop policy workers_update on public.workers;
drop policy workers_delete on public.workers;

create policy workers_insert on public.workers for insert to authenticated
  with check (
    (private.is_supervisor() and supervisor_id = (select auth.uid()))
    or (private.is_admin() and exists (
      select 1 from public.profiles p where p.id = supervisor_id and p.app_role = 'supervisor'))
  );
create policy workers_update on public.workers for update to authenticated
  using (private.can_write_worker(id) or private.is_admin())
  with check (
    (private.is_supervisor() and supervisor_id = (select auth.uid()))
    or (private.is_admin() and exists (
      select 1 from public.profiles p where p.id = supervisor_id and p.app_role = 'supervisor'))
  );
create policy workers_delete on public.workers for delete to authenticated
  using (private.can_write_worker(id) or private.is_admin());
