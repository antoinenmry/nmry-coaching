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
alter table public.chat_messages add column if not exists audio_path text;

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
-- WITH CHECK : l'utilisateur ne peut écrire que SA propre ligne (pas réassigner l'id).
-- Le changement de rôle reste bloqué par le trigger prevent_role_escalation (section 8).
-- Le coach/admin modifie le statut via service-role (contourne la RLS) → inchangé.
create policy profiles_self_update  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_coach_select on public.profiles for select using (public.is_coach());

-- 5) POLICIES — app_state
--    - chaque sportif gère SES données (user_id = auth.uid())
--    - un coach gère sa propre ligne + UNIQUEMENT ses sportifs affectés (coach_client)
--      → défense en profondeur : un bug côté coach ne peut plus écrire hors périmètre
--    - l'admin garde un accès complet (policy state_admin_all, section 9f)
drop policy if exists state_self_all  on public.app_state;
drop policy if exists state_coach_all on public.app_state;
create policy state_self_all  on public.app_state for all
  using (user_id = auth.uid())   with check (user_id = auth.uid());
create policy state_coach_all on public.app_state for all
  using (
    public.is_coach() and (
      user_id = auth.uid()
      or exists (
        select 1 from public.coach_client cc
        where cc.coach_id = auth.uid() and cc.client_id = app_state.user_id
      )
    )
  )
  with check (
    public.is_coach() and (
      user_id = auth.uid()
      or exists (
        select 1 from public.coach_client cc
        where cc.coach_id = auth.uid() and cc.client_id = app_state.user_id
      )
    )
  );

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
  -- Seul un admin peut changer un rôle (is_admin défini en 9b, résolu à l'exécution).
  if OLD.role != NEW.role and not public.is_admin() then
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
-- 9) MULTI-COACH + SUPER-ADMIN
-- =========================================================================

-- 9a) Rôle 'admin' autorisé dans profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client','coach','admin'));

-- 9b) Fonction is_admin()
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 9c) is_coach() inclut maintenant l'admin (accès équivalent)
create or replace function public.is_coach()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach','admin'));
$$;

-- 9d) (Le garde anti-élévation de rôle est défini en section 8, avec is_admin.)

-- 9e) Table d'affectation coach ↔ client
create table if not exists public.coach_client (
  coach_id    uuid references auth.users(id) on delete cascade,
  client_id   uuid references auth.users(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (coach_id, client_id)
);
alter table public.coach_client enable row level security;

drop policy if exists cc_read  on public.coach_client;
drop policy if exists cc_admin on public.coach_client;
-- Un coach voit ses propres affectations ; l'admin voit tout
create policy cc_read on public.coach_client for select
  using (coach_id = auth.uid() or public.is_admin());
-- Seul l'admin peut créer/modifier/supprimer les affectations
create policy cc_admin on public.coach_client for all
  using (public.is_admin()) with check (public.is_admin());

-- 9f) Policies admin sur profiles et app_state
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists state_admin_all on public.app_state;
create policy state_admin_all on public.app_state for all
  using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- 10) CHAT — table dédiée par conversation coach ↔ sportif
--     Remplace le stockage des messages dans app_state.data.messages.
--     Chaque message appartient à un couple (coach_id, client_id) → isolation
--     stricte des conversations, impossible de les mélanger.
-- =========================================================================

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  client_id   uuid not null references auth.users(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  sender_name text,
  body        text not null default '',
  audio_url   text,                       -- data URL base64 pour les vocaux
  is_voice    boolean not null default false,
  is_urgent   boolean not null default false,
  type        text,                       -- null=normal, 'broadcast', 'plan_update'
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  edited_at       timestamptz,
  attachment_url  text,           -- Supabase Storage public URL (image/vidéo)
  attachment_type text,           -- 'image' | 'video'
  attachment_path text,           -- chemin Storage pour la suppression serveur
  audio_path      text            -- chemin Storage pour les vocaux (post-migration base64)
);

create index if not exists chat_messages_client_idx on public.chat_messages (client_id, created_at);
create index if not exists chat_messages_coach_idx  on public.chat_messages (coach_id, created_at);

-- ── Storage bucket chat-attachments ──────────────────────────────────────────
-- Bucket public en lecture (URLs lisibles sans auth, chemins non devinables).
-- Limite à 50 Mo par fichier (défense côté serveur, en plus du garde-fou client).
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', true, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = excluded.public;

-- Upload direct depuis le navigateur (utilisateur authentifié uniquement).
-- L'autorisation fine (qui peut écrire dans quelle conversation) est portée par
-- l'insertion du message dans chat_messages (RLS chat_self/chat_coach).
drop policy if exists chat_attach_insert on storage.objects;
create policy chat_attach_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments');

-- Lecture publique (bucket public) — explicite pour clarté.
drop policy if exists chat_attach_read on storage.objects;
create policy chat_attach_read on storage.objects for select
  using (bucket_id = 'chat-attachments');

-- Suppression depuis le navigateur (nettoyage des fichiers orphelins).
-- La suppression liée à un message passe, elle, par le service role (admin) côté serveur.
drop policy if exists chat_attach_delete on storage.objects;
create policy chat_attach_delete on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments');

-- ── Storage bucket avatars ────────────────────────────────────────────────────
-- Photos de profil (compressées à ~512px côté client). Bucket distinct du chat
-- pour ne PAS subir une éventuelle auto-suppression J+30 des médias de chat.
-- Limite à 5 Mo par fichier (largement suffisant après compression).
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = excluded.public;

-- Upload / remplacement / suppression depuis le navigateur (authentifié).
-- upsert = true côté client → on autorise insert ET update.
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');

alter table public.chat_messages enable row level security;

-- Le sportif accède à sa propre conversation
drop policy if exists chat_self  on public.chat_messages;
create policy chat_self on public.chat_messages for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and sender_id = auth.uid());

-- Le coach accède aux conversations de SES sportifs uniquement
drop policy if exists chat_coach on public.chat_messages;
create policy chat_coach on public.chat_messages for all
  using (
    public.is_coach() and exists (
      select 1 from public.coach_client cc
      where cc.coach_id = auth.uid() and cc.client_id = chat_messages.client_id
    )
  )
  with check (
    public.is_coach() and sender_id = auth.uid() and exists (
      select 1 from public.coach_client cc
      where cc.coach_id = auth.uid() and cc.client_id = chat_messages.client_id
    )
  );

-- L'admin accède à tout
drop policy if exists chat_admin on public.chat_messages;
create policy chat_admin on public.chat_messages for all
  using (public.is_admin()) with check (public.is_admin());

-- 10a-bis) REALTIME — diffuse les changements de chat_messages aux abonnés
--          (messages en direct côté front). La RLS ci-dessus borne ce que chaque
--          abonné reçoit (chat_self/chat_coach/chat_admin). Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- 10b) MIGRATION — recopie les messages existants depuis app_state vers la table.
--      Idempotent : ne s'exécute que si chat_messages est encore vide.
insert into public.chat_messages
  (coach_id, client_id, sender_id, sender_name, body, audio_url, is_voice, is_urgent, type, is_read, created_at, edited_at)
select
  cc.coach_id,
  a.user_id,
  coalesce((m->>'senderId')::uuid, cc.coach_id),
  m->>'senderName',
  coalesce(m->>'text', ''),
  m->>'audioUrl',
  coalesce((m->>'isVoice')::boolean, false),
  coalesce((m->>'isUrgent')::boolean, false),
  nullif(m->>'type', ''),
  coalesce((m->>'isRead')::boolean, false),
  coalesce((m->>'createdAt')::timestamptz, now()),
  nullif(m->>'editedAt', '')::timestamptz
from public.app_state a
join public.coach_client cc on cc.client_id = a.user_id
cross join lateral jsonb_array_elements(coalesce(a.data->'messages', '[]'::jsonb)) as m
where not exists (select 1 from public.chat_messages limit 1);

-- =========================================================================
-- ⚠️  INSTRUCTIONS DE DÉPLOIEMENT
-- 1) Lancer ce script complet dans Supabase → SQL Editor
-- 2) Te désigner admin (remplace l'email) :
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'TON_EMAIL_ICI';
--    (désactiver le trigger d'abord si nécessaire — voir README)
-- 3) Pour un coach :
--    UPDATE public.profiles SET role = 'coach' WHERE email = 'EMAIL_COACH';
-- 4) Pour affecter un client à un coach :
--    INSERT INTO public.coach_client (coach_id, client_id)
--    SELECT c.id, cl.id FROM profiles c, profiles cl
--    WHERE c.email='coach@email.com' AND cl.email='client@email.com';
-- =========================================================================
