-- Nettoyage de la notification « Programme mis à jour » envoyée à tous par erreur
-- (coach sur SA propre programmation → ancienne route de diffusion).
-- À exécuter dans Supabase → SQL Editor, étape par étape.

-- 1) DIAGNOSTIC (lecture seule) : les envois en rafale, groupés à la minute.
--    Une diffusion à tous = une même minute avec N conversations différentes.
select date_trunc('minute', created_at) as minute,
       sender_name,
       count(*)                  as messages,
       count(distinct client_id) as sportifs
from public.chat_messages
where type = 'plan_update'
group by 1, 2
having count(distinct client_id) > 1
order by 1 desc;

-- 2) SUPPRESSION : remplace la minute ci-dessous par celle repérée à l'étape 1
--    (ou un intervalle), puis lance. Ne touche qu'aux messages « plan_update ».
-- delete from public.chat_messages
-- where type = 'plan_update'
--   and created_at >= '2026-10-05 00:00:00+00'   -- début de la rafale
--   and created_at <  '2026-10-05 23:59:59+00';  -- fin de la rafale

-- 3) COCHES VERTES « programme envoyé » du sélecteur de sportifs (côté coach) :
--    elles viennent de preferences.planNotifSentAt dans l'état du coach.
--    Remplace l'email puis lance pour tout remettre à zéro.
-- update public.app_state
-- set data = jsonb_set(data, '{preferences,planNotifSentAt}', '{}'::jsonb, true)
-- where user_id = (select id from public.profiles where email = 'simon.nemery@gmail.com');
