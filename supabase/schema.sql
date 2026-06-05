-- =========================================================================
-- NMRY Coaching — schéma Supabase
-- À coller dans : Supabase → SQL Editor → New query → Run
-- Ré-exécutable sans danger (drop ... if exists).
-- =========================================================================

-- 1) PROFILS : 1 ligne par utilisateur (créée automatiquement à l'inscription)
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  name       text default '',
  role       text not null default 'client' check (role in ('client','coach')),
  status     text not null default 'active'  check (status in ('active','inactive')),
  created_at timestamptz default now()
);
-- Migration : ajouter status si la table existe déjà
alter table public.profiles add column if not exists
  status text not null default 'active' check (status in ('active','inactive'));

-- 2) ÉTAT APPLICATIF : le "document" complet de chaque client (profil, planning,
--    objectifs, suivi) stocké en JSON. Simple à faire évoluer ; on pourra
--    normaliser en tables dédiées plus tard (suivi de records, stats...).
create table if not exists public.app_state (
  user_id              uuid primary key references auth.users on delete cascade,
  data                 jsonb not null default '{}'::jsonb,
  updated_at           timestamptz default now(),
  updated_by_coach_at  timestamptz,   -- dernière sauvegarde effectuée par le coach
  updated_by_client_at timestamptz    -- dernière sauvegarde effectuée par le sportif
);
-- Migrations : ajouter les colonnes si la table existe déjà
alter table public.app_state add column if not exists updated_by_coach_at  timestamptz;
alter table public.app_state add column if not exists updated_by_client_at timestamptz;

alter table public.profiles  enable row level security;
alter table public.app_state enable row level security;

-- 3) Fonction "est-ce un coach ?" en SECURITY DEFINER pour éviter la récursion RLS
create or replace function public.is_coach()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- 4) POLICIES — profiles
drop policy if exists profiles_self_select  on public.profiles;
drop policy if exists profiles_self_update  on public.profiles;
drop policy if exists profiles_coach_select on public.profiles;
create policy profiles_self_select  on public.profiles for select using (id = auth.uid());
create policy profiles_self_update  on public.profiles for update using (id = auth.uid());
create policy profiles_coach_select on public.profiles for select using (public.is_coach());

-- 5) POLICIES — app_state (chaque client gère ses données ; le coach gère tout)
drop policy if exists state_self_all  on public.app_state;
drop policy if exists state_coach_all on public.app_state;
create policy state_self_all  on public.app_state for all
  using (user_id = auth.uid())   with check (user_id = auth.uid());
create policy state_coach_all on public.app_state for all
  using (public.is_coach())      with check (public.is_coach());

-- 6) TRIGGER : créer profil + état vide à chaque inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name',''))
  on conflict (id) do nothing;
  insert into public.app_state (user_id, data)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 7) BIBLIOTHÈQUE PARTAGÉE — singleton lisible par tous, éditable par le coach
-- =========================================================================

create table if not exists public.library_state (
  id         int primary key default 1 check (id = 1), -- ligne unique
  data       jsonb not null default '{"categories":[],"exercises":[]}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.library_state enable row level security;

drop policy if exists library_read_all    on public.library_state;
drop policy if exists library_coach_write on public.library_state;
create policy library_read_all    on public.library_state for select using (auth.role() = 'authenticated');
create policy library_coach_write on public.library_state for all   using (public.is_coach()) with check (public.is_coach());

-- =========================================================================
-- 8) SÉCURITÉ — Empêcher l'auto-élévation de rôle
--    Sans ce trigger, un client pourrait se passer lui-même en 'coach' via
--    l'API (la policy profiles_self_update n'a pas de WITH CHECK sur role).
-- =========================================================================

create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if OLD.role != NEW.role and not public.is_coach() then
    raise exception 'Modification du rôle non autorisée';
  end if;
  return NEW;
end;
$$;

drop trigger if exists check_role_escalation on public.profiles;
create trigger check_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- =========================================================================
-- 8) ⚠️ TE DÉSIGNER COMME COACH
--    Inscris-toi d'abord dans l'app avec ton email, PUIS lance cette ligne
--    (remplace l'email) pour passer ton compte en coach :
--
--    update public.profiles set role = 'coach' where email = 'TON_EMAIL_ICI';
-- =========================================================================
