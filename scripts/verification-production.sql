-- Contrôle de santé de la base hébergée (LECTURE SEULE) : à coller dans le SQL Editor de
-- Supabase avant la remise au client, puis après chaque changement de configuration.
-- Aucune donnée personnelle n'est affichée : seulement des réglages et des compteurs.
-- Ce qu'il faut voir est indiqué au-dessus de chaque requête.

-- 1. Tâche du matin : une ligne « gmao-taches-quotidiennes », « 0 7 * * * », active = true.
select jobname, schedule, active from cron.job;

-- 2. Ses dernières exécutions : status « succeeded », dernière date = aujourd'hui ou hier.
select status, count(*), max(start_time) as derniere
from (select * from cron.job_run_details order by start_time desc limit 10) r
group by status;

-- 3. Bucket des photos : public = false, file_size_limit = 2097152 (2 Mo).
select id, public, file_size_limit from storage.buckets;

-- 4. Place prise par les photos (le plan gratuit donne 1 Go pour tout le Storage).
select count(*) as fichiers, round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1) as mo
from storage.objects where bucket_id = 'photos';

-- 5. Notifications remises : « non_remises » doit valoir 0. Sinon, l'Edge Function n'a pas
--    traité ces notifications (voir Edge Functions → envoyer-notification → Logs).
select count(*) as total,
       count(*) filter (where delivered_at is null and created_at < now() - interval '10 minutes') as non_remises,
       max(created_at) as derniere
from notifications;

-- 6. Réponses de l'Edge Function aux appels du trigger (7 derniers jours) : status_code 200.
--    Des 4xx/5xx ou des « error_msg » indiquent un problème d'adresse ou de fonction.
select status_code, error_msg, count(*)
from net._http_response
where created > now() - interval '7 days'
group by 1, 2;

-- 7. Appareils inscrits aux push : au moins un par personne qui doit recevoir les alertes.
select count(*) as appareils, count(distinct user_id) as personnes from push_tokens;

-- 8. Comptes par rôle : au moins un propriétaire. Comptes jamais connectés (mot de passe
--    temporaire pas encore changé) : à relancer ou à supprimer.
select role, count(*) as comptes, count(*) filter (where must_change_password) as jamais_connectes
from users group by role order by role;

-- 9. Adresse du projet dans le Vault (seulement après la tâche T2 de docs/taches-restantes.md) :
--    1 ligne attendue après T2, 0 avant.
select count(*) as project_url_present from vault.secrets where name = 'project_url';

-- Ne se vérifie PAS en SQL (console Supabase → Authentication) :
--   - Sign In / Providers : « Allow new users to sign up » désactivé ;
--   - Password : longueur minimale 8 ;
--   - URL Configuration : Site URL = adresse de production, Redirect URLs = production et prévisualisation.
