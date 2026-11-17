-- Mise en pause d'un sportif (profiles.status = 'inactive') : plus aucun accès aux données,
-- même en appelant Supabase directement. Contient aussi la validation des inscriptions
-- (signup-validation.sql) : exécuter ce fichier suffit.
-- À exécuter une fois dans Supabase → SQL Editor (idempotent), et après chaque relance de schema.sql.

-- Sportif mis en pause par son coach
create or replace function public.is_paused()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'client' and status = 'inactive'
  );
$$;
revoke execute on function public.is_paused() from anon, public;
grant execute on function public.is_paused() to authenticated;

-- Compte validé : coach/admin, ou sportif affecté à un coach et pas en pause
create or replace function public.is_approved()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.is_coach()
      or (exists (select 1 from public.coach_client cc where cc.client_id = auth.uid())
          and not public.is_paused());
$$;
revoke execute on function public.is_approved() from anon, public;
grant execute on function public.is_approved() to authenticated;

-- Bibliothèque : comptes validés uniquement
drop policy if exists library_read_all on public.library_state;
drop policy if exists library_read_approved on public.library_state;
create policy library_read_approved on public.library_state
  for select using (public.is_approved());

-- Données du sportif (séances, objectifs…) : bloquées pendant la pause
drop policy if exists state_self_all on public.app_state;
create policy state_self_all on public.app_state for all
  using (user_id = auth.uid() and not public.is_paused())
  with check (user_id = auth.uid() and not public.is_paused());

-- Chat : bloqué pendant la pause (lecture, envoi, temps réel)
drop policy if exists chat_self on public.chat_messages;
create policy chat_self on public.chat_messages for all
  using (client_id = auth.uid() and not public.is_paused())
  with check (client_id = auth.uid() and sender_id = auth.uid() and not public.is_paused());

-- Un sportif ne peut pas changer lui-même son statut (se sortir de la pause).
-- Le serveur (service role, auth.uid() vide) et les coachs/admins le peuvent.
create or replace function public.prevent_status_self_change()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if OLD.status is distinct from NEW.status and auth.uid() is not null and not public.is_coach() then
    raise exception 'Modification du statut non autorisée';
  end if;
  return NEW;
end;
$$;
revoke execute on function public.prevent_status_self_change() from anon, public, authenticated;

drop trigger if exists check_status_change on public.profiles;
create trigger check_status_change
  before update on public.profiles
  for each row execute function public.prevent_status_self_change();
