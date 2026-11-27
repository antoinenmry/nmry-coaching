-- Réponses dans le chat : un message peut citer un autre message de la même conversation.
-- Idempotent. Si le message cité est supprimé, la réponse reste (la citation affiche « Message supprimé »).
alter table public.chat_messages
  add column if not exists reply_to uuid references public.chat_messages(id) on delete set null;
create index if not exists chat_messages_reply_to_idx on public.chat_messages (reply_to) where reply_to is not null;

-- Vérification : doit afficher « reply_to | uuid ».
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'reply_to';
