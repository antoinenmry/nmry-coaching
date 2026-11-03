-- Validation des inscriptions : un sportif sans coach affecté ne peut plus lire la bibliothèque
-- (exercices, séances types, shop…) même en appelant Supabase directement.
-- À exécuter une fois dans Supabase → SQL Editor (idempotent).

create or replace function public.is_approved()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.is_coach()
      or exists (select 1 from public.coach_client cc where cc.client_id = auth.uid());
$$;
revoke execute on function public.is_approved() from anon, public;
grant execute on function public.is_approved() to authenticated;

drop policy if exists library_read_all on public.library_state;
drop policy if exists library_read_approved on public.library_state;
create policy library_read_approved on public.library_state
  for select using (public.is_approved());
