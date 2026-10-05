-- Messages pop-up ciblés par groupe de sport (ex. « Strongman »).
-- ✅ N'efface rien : ajoute seulement une colonne optionnelle. Idempotent.
-- Sans cette colonne, les messages « à tous » continuent de fonctionner ;
-- seul l'envoi à un groupe de sport est refusé.
alter table public.broadcasts add column if not exists target_sports text[];
