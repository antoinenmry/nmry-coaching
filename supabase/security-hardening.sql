-- Durcissement issu de l'audit sécurité / RGPD (novembre 2026).
-- Principe : toutes les écritures passent par les routes API du serveur (service role, autorisation
-- vérifiée en code). Le navigateur n'a plus que des droits de LECTURE, limités au strict nécessaire.
-- À exécuter dans Supabase → SQL Editor APRÈS athlete-pause.sql (idempotent : drop + create).
-- Supabase signale « opération destructive » : ce sont des remplacements de règles, aucune donnée n'est supprimée.

-- 1) Profils : un coach ne voit plus TOUS les comptes (emails compris), seulement lui-même et ses sportifs.
--    L'admin garde profiles_admin_all ; les demandes d'inscription passent par l'API.
drop policy if exists profiles_coach_select on public.profiles;
create policy profiles_coach_select on public.profiles for select using (
  public.is_coach() and (
    id = auth.uid()
    or exists (select 1 from public.coach_client cc where cc.coach_id = auth.uid() and cc.client_id = profiles.id)
  )
);

-- 2) Profils : l'email affiché aux coachs ne peut plus être réécrit depuis le navigateur.
create or replace function public.protect_profile_email()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if NEW.email is distinct from OLD.email and auth.uid() is not null and not public.is_admin() then
    raise exception 'Modification de l''email non autorisée';
  end if;
  return NEW;
end;
$$;
revoke execute on function public.protect_profile_email() from anon, public, authenticated;
drop trigger if exists check_profile_email on public.profiles;
create trigger check_profile_email
  before update on public.profiles
  for each row execute function public.protect_profile_email();

-- 3) Chat : lecture seule depuis le navigateur (messages en direct). Envoi, modification,
--    suppression et réactions passent par /api/chat. Empêche un sportif d'écrire à un autre coach,
--    de supprimer les messages de son coach ou de fabriquer une fausse « annonce ».
drop policy if exists chat_self on public.chat_messages;
create policy chat_self on public.chat_messages for select
  using (client_id = auth.uid() and not public.is_paused());

drop policy if exists chat_coach on public.chat_messages;
create policy chat_coach on public.chat_messages for select using (
  public.is_coach() and exists (
    select 1 from public.coach_client cc
    where cc.coach_id = auth.uid() and cc.client_id = chat_messages.client_id
  )
);

-- 4) Bibliothèque et modèles : écriture uniquement via /api/library et /api/templates
--    (qui vérifient qui modifie les annonces, applis, sports…). Un coach ne peut plus contourner
--    ces contrôles en écrivant directement dans la table.
drop policy if exists library_coach_write on public.library_state;
drop policy if exists template_coach_all on public.template_state;

-- 5) Annonces (broadcasts) : création via l'API ; lecture bloquée pour un sportif en pause.
drop policy if exists broadcast_coach on public.broadcasts;
create policy broadcast_coach on public.broadcasts for select using (coach_id = auth.uid());
drop policy if exists broadcast_client_read on public.broadcasts;
create policy broadcast_client_read on public.broadcasts for select using (
  not public.is_paused() and exists (
    select 1 from public.coach_client cc
    where cc.coach_id = broadcasts.coach_id and cc.client_id = auth.uid()
  )
);

-- 6) Vérification : coller le résultat à Claude.
select schemaname, tablename, policyname, cmd, coalesce(qual, with_check) as regle
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
