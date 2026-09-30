-- 6. Notifications : destinataires selon le restaurant et les réglages, titres,
-- taches_quotidiennes() rejouable sans doublon, réservation delivered_at.
-- Le trigger pg_net met les appels en file dans la transaction : ROLLBACK, rien ne part.
begin;
\ir _fixture.sql
select * from no_plan();

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
create function tests.dest(p_type text, p_link text) returns setof uuid language sql as
  $$ select user_id from notifications where type::text = p_type and link = p_link $$;
create function tests.ids_de(p text[]) returns setof uuid language sql as
  $$ select tests.id(n) from unnest(p) n $$;

-- Panne normale déclarée par le lecteur lec1 sur E3 (R1)
select tests.se_connecter('lec1');
insert into ctx values ('A', declarer_panne(tests.id('E3'), 'normal', array['Bruit'], 'Vibre fort'));
select tests.se_deconnecter();
select set_eq($$ select * from tests.dest('panne', '/interventions/' || (select v from ctx where k = 'A')) $$,
              $$ select * from tests.ids_de(array['prop', 'prop1', 'ed1', 'com1']) $$,
              'panne R1 : propriétaires, éditeur et commentateur de R1 (pas com1b qui a coupé, pas le lecteur déclarant, pas R2)');
select is((select count(*)::int from notifications where link = '/interventions/' || (select v from ctx where k = 'A')), 4,
          'panne : une seule notification par destinataire');
select is((select distinct title || ' | ' || body from notifications where link = '/interventions/' || (select v from ctx where k = 'A')),
          'Panne : Hotte test, TSTA | Déclarée par Lea · Vibre fort', 'panne : titre et texte');

-- Urgence déclarée par le commentateur com1 sur E1, symptômes sans description
select tests.se_connecter('com1');
insert into ctx values ('B', declarer_panne(tests.id('E1'), 'urgence', array['Ne chauffe pas', 'Fumée']));
select tests.se_deconnecter();
select set_eq($$ select * from tests.dest('urgence', '/interventions/' || (select v from ctx where k = 'B')) $$,
              $$ select * from tests.ids_de(array['prop', 'prop1', 'ed1', 'com1b']) $$,
              'urgence R1 : sans le déclarant com1, avec com1b (seule l''alerte « panne » est coupée)');
select is((select distinct title || ' | ' || body from notifications where link = '/interventions/' || (select v from ctx where k = 'B')),
          'Urgence : Friteuse test, TSTA | Déclarée par Awa · Ne chauffe pas, Fumée', 'urgence : titre et texte (symptômes)');

-- Machine en texte libre, sans description ni symptôme
select tests.se_connecter('ed1');
insert into ctx values ('C', declarer_panne(null, 'normal', '{}', null, null, tests.id('R1'), 'Machine à glaçons'));
select tests.se_deconnecter();
select is((select distinct title || ' | ' || body from notifications where link = '/interventions/' || (select v from ctx where k = 'C')),
          'Panne : Machine à glaçons, TSTA | Déclarée par Eddy · à traiter', 'machine libre : titre et texte par défaut');

-- Panne sur R2 : seulement l'équipe de R2 et le propriétaire « tous restaurants »
select tests.se_connecter('lec2');
insert into ctx values ('D', declarer_panne(tests.id('E2')));
select tests.se_deconnecter();
select set_eq($$ select * from tests.dest('panne', '/interventions/' || (select v from ctx where k = 'D')) $$,
              $$ select * from tests.ids_de(array['prop', 'ed2', 'com2']) $$, 'panne R2 : prop, ed2, com2 uniquement');

-- Réparation : réglage coupé chez le déclarant => pas de notification
insert into notification_settings values (tests.id('lec2'), 'reparation', false);
select tests.se_connecter('com2');
select cloturer_intervention((select v from ctx where k = 'D'), 'Réparé', 'operationnel');
select tests.se_deconnecter();
select is((select count(*)::int from notifications where type = 'reparation' and user_id = tests.id('lec2')), 0,
          'réparation : déclarant ayant coupé l''alerte non notifié');
select tests.se_connecter('ed1');
select cloturer_intervention((select v from ctx where k = 'A'), 'Fixé', 'operationnel');
select tests.se_deconnecter();
select is((select title || ' | ' || body from notifications where type = 'reparation' and user_id = tests.id('lec1')),
          'Hotte test réparée, TSTA | Clôturée par Eddy · Fixé', 'réparation : titre et texte au déclarant');

-- Envoi : chaque notification est mise en file pg_net (annulée avec la transaction)
select has_trigger('public', 'notifications', 'trg_notifications_envoi', 'trigger d''envoi présent');
select is((select count(*)::int from net.http_request_queue q
           where (convert_from(q.body, 'UTF8')::jsonb ->> 'id')::uuid in (select id from notifications)),
          (select count(*)::int from notifications), 'une requête d''envoi par notification (en file, jamais validée ici)');

-- Réservation delivered_at (instruction de l'Edge Function) : un seul envoi
select id as nid into temp reserv from notifications where user_id = tests.id('ed1') limit 1;
with t as (update notifications set delivered_at = now() where id = (select nid from reserv) and delivered_at is null returning 1)
  select is(count(*)::int, 1, 'réservation : premier appel réserve la notification') from t;
with t as (update notifications set delivered_at = now() where id = (select nid from reserv) and delivered_at is null returning 1)
  select is(count(*)::int, 0, 'réservation : second appel ne réserve rien (pas de double envoi)') from t;
with t as (update notifications set delivered_at = now() where id = gen_random_uuid() and delivered_at is null returning 1)
  select is(count(*)::int, 0, 'réservation : id inconnu, rien') from t;
grant select on reserv to authenticated;
select is(tests.essai('ed1', $$ with t as (update notifications set read_at = now() where id = (select nid from reserv) returning 1) select count(*) from t $$),
          'autorisé', 'destinataire : marquer sa notification comme lue');
select is(tests.essai('com1', $$ with t as (update notifications set read_at = now() where id = (select nid from reserv) returning 1) select count(*) from t $$),
          'refusé', 'autre utilisateur : marquer la notification d''un autre refusé');
select is(tests.essai('ed1', $$ with t as (update notifications set delivered_at = null where id = (select nid from reserv) returning 1) select count(*) from t $$),
          'refusé', 'destinataire : annuler la réservation delivered_at (renvoi possible) refusé');

-- Tâche quotidienne
delete from notifications;
update maintenance_plans set next_due_at = current_date + 3 where equipment_id = tests.id('E1');   -- à prévoir
update maintenance_plans set next_due_at = current_date - 1 where equipment_id = tests.id('E2');   -- en retard (R2)
-- E4 : hors service et en retard => pas de rappel
insert into maintenance_plans (equipment_id, frequency, next_due_at) values
  (tests.id('E3'), 'mensuel', current_date),        -- échéance aujourd'hui : ni « à prévoir » ni « en retard »
  (tests.id('E5'), 'mensuel', current_date + 2);    -- dans 2 jours : rien
insert into notification_settings values (tests.id('com1b'), 'entretien_prevu', false);

select lives_ok('select taches_quotidiennes()', 'tâche quotidienne : exécution (postgres, comme pg_cron)');
select set_eq($$ select * from tests.dest('entretien_prevu', '/equipements/' || tests.id('E1')) $$,
              $$ select * from tests.ids_de(array['prop', 'prop1', 'ed1', 'com1']) $$,
              'à prévoir (J-3) sur R1 : prop, prop1, ed1, com1 (pas les lecteurs, pas com1b qui a coupé)');
select set_eq($$ select * from tests.dest('entretien_retard', '/equipements/' || tests.id('E2')) $$,
              $$ select * from tests.ids_de(array['prop', 'ed2', 'com2']) $$, 'en retard sur R2 : prop, ed2, com2');
select is((select count(*)::int from notifications where link = '/equipements/' || tests.id('E4')), 0, 'machine hors service : pas de rappel');
select is((select count(*)::int from notifications where link = '/equipements/' || tests.id('E3')), 0, 'échéance aujourd''hui : pas de rappel');
select is((select count(*)::int from notifications where link = '/equipements/' || tests.id('E5')), 0, 'échéance dans 2 jours : pas de rappel');
select is((select distinct title || ' | ' || body from notifications where link = '/equipements/' || tests.id('E1')),
          'Entretien à prévoir : Friteuse test, TSTA | Prévu le ' || date_courte_fr(current_date + 3) || ' · Vidanger l''huile',
          'à prévoir : titre et texte');
select is((select distinct title from notifications where link = '/equipements/' || tests.id('E2')),
          'Entretien en retard : Friteuse B, TSTB', 'en retard : titre');
create temp table apres1 as select count(*) n from notifications;
select lives_ok('select taches_quotidiennes()', 'tâche quotidienne : relancée le même jour');
select lives_ok('select taches_quotidiennes()', 'tâche quotidienne : relancée une troisième fois');
select is((select count(*) from notifications), (select n from apres1), 'tâche rejouée le même jour : aucun doublon');
-- Le lendemain (simulé en reculant les notifications d'un jour) : le retard est rappelé à nouveau.
update notifications set created_at = created_at - interval '1 day';
select taches_quotidiennes();
select is((select count(*)::int from notifications where type = 'entretien_retard' and link = '/equipements/' || tests.id('E2')), 6,
          'retard rappelé chaque matin : 3 hier + 3 aujourd''hui');

-- Date courte
select is(date_courte_fr('2026-09-16'), '16 sept.', 'date courte : 16 sept.');
select is(date_courte_fr('2026-08-01'), '1 août', 'date courte : 1 août');
select is(date_courte_fr('2026-02-03'), '3 févr.', 'date courte : 3 févr.');

select * from finish();
rollback;
