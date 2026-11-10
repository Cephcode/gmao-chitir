-- 14. Suppression des notifications (chacun les siennes), nettoyage hebdomadaire des lues
-- (réglé par le propriétaire seulement), renommage d'un restaurant (nom seulement).
begin;
\ir _fixture.sql
select * from no_plan();

-- Notifications de test : com1 (une lue il y a 10 jours, une lue hier, une non lue), ed1 (une).
insert into notifications (id, user_id, type, title, read_at) values
  ('00000000-0000-0000-0000-0000000000a1', tests.id('com1'), 'panne', 'vieille lue', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000a2', tests.id('com1'), 'panne', 'lue hier', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3', tests.id('com1'), 'panne', 'non lue', null),
  ('00000000-0000-0000-0000-0000000000b1', tests.id('ed1'), 'panne', 'à ed1', now() - interval '10 days');

-- Suppression : les siennes seulement
select is(tests.essai('com1', $$ with d as (delete from notifications where id = '00000000-0000-0000-0000-0000000000a3' returning 1) select count(*) from d $$),
          'autorisé', 'un lecteur/commentateur supprime sa notification');
select is(tests.essai('com1', $$ with d as (delete from notifications where id = '00000000-0000-0000-0000-0000000000b1' returning 1) select count(*) from d $$),
          'refusé', 'pas la notification d''un autre compte');
select is(tests.essai('lec1', $$ with d as (delete from notifications where read_at is not null returning 1) select count(*) from d $$),
          'refusé', '« supprimer les lues » ne touche pas les notifications des autres');

-- Nettoyage : fonction appelée par pg_cron seulement
select is(tests.essai('prop', $$ select purger_notifications_lues() $$), 'refusé', 'purge : pas appelable par un compte');
select is(purger_notifications_lues(), 2, 'purge : supprime les lues depuis plus de 7 jours (tous comptes)');
select set_eq($$ select title from notifications where id::text like '00000000-0000-0000-0000-0000000000%' $$,
              array['lue hier', 'non lue'], 'purge : lues récentes et non lues gardées');

-- Activation / désactivation : propriétaire seulement
select is(tests.essai('ed1', $$ select regler_purge_notifications(true)::int $$), 'refusé', 'réglage refusé à l''éditeur');
select is(tests.essai('lec1', $$ select purge_notifications_active()::int $$), 'refusé', 'état refusé au lecteur');
select tests.se_connecter('prop');
select is(regler_purge_notifications(true), true, 'propriétaire : activation');
select is(purge_notifications_active(), true, 'tâche planifiée');
select is(regler_purge_notifications(true), true, 'activation rejouable');
select is(regler_purge_notifications(false), false, 'propriétaire : désactivation');
select is(purge_notifications_active(), false, 'tâche retirée');
select lives_ok($$ select regler_purge_notifications(false) $$, 'désactivation rejouable');
select tests.se_deconnecter();
select is((select schedule from cron.job where jobname = 'gmao-purge-notifications-lues'), null, 'aucune tâche restante');

-- Renommage d'un restaurant
select is(tests.essai('prop', $$ with u as (update restaurants set name = 'Nouveau nom' where id = tests.id('R1') returning 1) select count(*) from u $$),
          'autorisé', 'le propriétaire renomme un restaurant');
select is(tests.essai('ed1', $$ with u as (update restaurants set name = 'X' where id = tests.id('R1') returning 1) select count(*) from u $$),
          'refusé', 'l''éditeur ne renomme pas');
select is(tests.essai('prop', $$ with u as (update restaurants set short_code = 'ZZZ' where id = tests.id('R1') returning 1) select count(*) from u $$),
          'refusé', 'le code court reste figé');
select matches(tests.essai('prop', $$ with u as (update restaurants set name = '  ' where id = tests.id('R1') returning 1) select count(*) from u $$),
               '^erreur 23514', 'nom vide refusé');

select * from finish();
rollback;
