-- Notes privées du coach sur un sportif (bulle « Notes » dans Programmation).
-- Jamais visibles par le sportif : aucune règle d'accès pour le navigateur, tout passe par
-- /api/coach/notes (service role) qui vérifie que l'appelant coache ce sportif (ou est admin).
-- Idempotent. Les notes partent avec le compte du sportif (suppression en cascade).
create table if not exists public.coach_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references auth.users(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists coach_notes_client_idx on public.coach_notes (client_id, created_at desc);
alter table public.coach_notes enable row level security;
-- Volontairement AUCUNE policy : ni le sportif ni un autre compte ne peut lire la table directement.

-- Vérification : doit afficher « coach_notes | true ».
select relname, relrowsecurity from pg_class where relname = 'coach_notes';
