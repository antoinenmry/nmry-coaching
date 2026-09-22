-- =========================================================================
-- Règles d'accès Storage resserrées (audit sécurité 2026-09)
--
-- Avant : tout compte connecté pouvait écrire / remplacer / SUPPRIMER n'importe
-- quel fichier des buckets chat-attachments, avatars et badges.
-- Après : chacun n'agit que sur ses propres dossiers ; le coach sur ceux de SES
-- sportifs ; l'admin partout ; les badges sont réservés aux coachs/admins.
--
-- ✅ Ne supprime AUCUN fichier et ne touche pas aux données : seules les
--    permissions des actions FUTURES changent. La lecture reste identique.
-- ✅ Idempotent : peut être relancé sans risque.
--
-- Conventions de chemins utilisées par l'app :
--   chat-attachments : vocaux  → <uid de l'expéditeur>/…
--                      médias  → chat/<id du sportif>/…
--   avatars          : <id du sportif>/…   (le coach peut uploader pour son sportif)
--   badges           : <id du défi>-<ts>.jpg, card-icons/…  (coach/admin)
-- =========================================================================

-- Le coach connecté suit-il ce sportif ? (id reçu en texte depuis le chemin)
create or replace function public.coaches_client(client_text text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.coach_client cc
    where cc.coach_id = auth.uid() and cc.client_id::text = client_text
  );
$$;
revoke execute on function public.coaches_client(text) from anon, public;
grant execute on function public.coaches_client(text) to authenticated;

-- ── chat-attachments ─────────────────────────────────────────────────────
drop policy if exists chat_attach_insert on storage.objects;
create policy chat_attach_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'chat' and (
          (storage.foldername(name))[2] = auth.uid()::text
          or public.coaches_client((storage.foldername(name))[2])
        )
      )
      or public.is_admin()
    )
  );

drop policy if exists chat_attach_delete on storage.objects;
create policy chat_attach_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'chat' and (
          (storage.foldername(name))[2] = auth.uid()::text
          or public.coaches_client((storage.foldername(name))[2])
        )
      )
      or public.is_admin()
    )
  );

-- ── avatars ──────────────────────────────────────────────────────────────
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.coaches_client((storage.foldername(name))[1])
      or public.is_admin()
    )
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.coaches_client((storage.foldername(name))[1])
      or public.is_admin()
    )
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.coaches_client((storage.foldername(name))[1])
      or public.is_admin()
    )
  );

-- ── badges (coach / admin uniquement ; is_coach() inclut l'admin) ─────────
drop policy if exists badges_insert on storage.objects;
create policy badges_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'badges' and public.is_coach());

drop policy if exists badges_update on storage.objects;
create policy badges_update on storage.objects for update to authenticated
  using (bucket_id = 'badges' and public.is_coach());

drop policy if exists badges_delete on storage.objects;
create policy badges_delete on storage.objects for delete to authenticated
  using (bucket_id = 'badges' and public.is_coach());
