-- Cada usuario puede editar SU fila de profiles, pero un trigger impide que cambie su perfil (app_role),
-- su correo o su id. Solo Gerencia cambia perfiles. Las llamadas sin JWT de usuario (service_role,
-- Edge Functions, migraciones) no se restringen.
create or replace function private.guard_profile_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'No se puede modificar el id ni el correo del perfil';
    end if;
    if new.app_role is distinct from old.app_role and not private.is_admin() then
      raise exception 'Solo Gerencia puede cambiar el perfil de un usuario';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_update before update on public.profiles
  for each row execute function private.guard_profile_update();

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
