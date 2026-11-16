-- La política consultaba public.workers desde una función; en INSERT ... RETURNING esa
-- consulta no ve la fila recién insertada. Se evalúa directamente sobre las columnas.
drop policy workers_select on public.workers;
create policy workers_select on public.workers for select to authenticated
  using (
    supervisor_id = (select auth.uid())
    or user_id = (select auth.uid())
    or private.is_management()
  );
