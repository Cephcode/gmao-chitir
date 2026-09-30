-- 2. Déclaration et clôture d'une intervention : dernier entretien, état de la machine,
-- pièces, fiche de vie, notification au déclarant, atomicité, refus.
begin;
\ir _fixture.sql
select * from no_plan();

-- Déclaration par un lecteur (tous les rôles peuvent déclarer)
select tests.se_connecter('lec1');
create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
insert into ctx values ('I3', declarer_panne(tests.id('E3'), 'normal', array['Bruit'], 'Vibre fort'));
select tests.se_deconnecter();
select is((select state::text from equipments where id = tests.id('E3')), 'en_panne', 'déclaration : machine en panne');
select is((select status::text || ' ' || type || ' ' || kind || ' ' || (reported_by = tests.id('lec1'))
           from interventions where id = (select v from ctx where k = 'I3')),
          'a_planifier normal correctif true', 'déclaration par un lecteur : intervention « à planifier », déclarant enregistré');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E3') and type = 'panne_declaree'
           and ref_id = (select v from ctx where k = 'I3')), 1, 'déclaration : fiche de vie « Panne déclarée »');
select tests.se_connecter('lec1');
select throws_ok($$ select declarer_panne(tests.id('E1'), 'alerte') $$, '22023', null, 'déclaration de type alerte refusée');
select throws_ok($$ select declarer_panne(null, 'normal', '{}', null, null, tests.id('R1'), null) $$, '22004', null,
                 'machine non identifiée sans texte libre refusée');
select lives_ok($$ insert into ctx values ('I4', declarer_panne(null, 'urgence', '{}', 'Odeur', null, tests.id('R1'), 'Machine à glaçons')) $$,
                'déclaration avec machine en texte libre acceptée');
select tests.se_deconnecter();

-- Clôture normale de I1 (E1, plan mensuel en retard) avec 2 filtres P1, par l'éditeur ed1,
-- technicien com1.
select tests.se_connecter('ed1');
select lives_ok($$ select cloturer_intervention(tests.id('I1'), 'Thermostat changé', 'operationnel', tests.id('com1'),
                   jsonb_build_array(jsonb_build_object('part_id', tests.id('P1'), 'quantity', 2))) $$,
                'clôture normale acceptée (éditeur)');
select tests.se_deconnecter();
select is((select status::text || ' ' || (closed_by = tests.id('ed1')) || ' ' || (closed_at is not null) || ' '
                  || state_after || ' ' || (assigned_to = tests.id('com1')) || ' ' || work_done
           from interventions where id = tests.id('I1')),
          'terminee true true operationnel true Thermostat changé', 'clôture : intervention terminée, auteur, date, technicien, travail');
select is((select state::text from equipments where id = tests.id('E1')), 'operationnel', 'clôture : état de la machine = état choisi');
select is((select last_done_at from maintenance_plans where equipment_id = tests.id('E1')), current_date,
          'clôture normale : dernier entretien = jour de clôture');
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')), (current_date + interval '1 month')::date,
          'clôture normale : prochaine échéance = clôture + 1 mois');
select is((select count(*)::int from maintenance_logs where equipment_id = tests.id('E1') and done_at = current_date
           and done_by = tests.id('com1') and notes = 'Thermostat changé'), 1, 'clôture : journal d''entretien (technicien, travail)');
select is((select quantity from parts where id = tests.id('P1')), 8, 'clôture : stock P1 décrémenté de 2 (10 -> 8)');
select is((select quantity from intervention_parts where intervention_id = tests.id('I1') and part_id = tests.id('P1')), 2,
          'clôture : pièce utilisée enregistrée');
select is((select count(*)::int from stock_movements where part_id = tests.id('P1') and delta = -2 and reason = 'intervention'
           and intervention_id = tests.id('I1') and user_id = tests.id('ed1')), 1, 'clôture : mouvement de stock tracé');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E1') and type = 'reparation'
           and ref_id = tests.id('I1') and summary = 'Thermostat changé'), 1, 'clôture : fiche de vie « réparation »');
select is((select string_agg(user_id::text || '|' || title || '|' || body || '|' || link, ';') from notifications where type = 'reparation'),
          tests.id('lec1') || '|Friteuse test réparée, TSTA|Clôturée par Awa · Thermostat changé|/interventions/' || tests.id('I1'),
          'clôture : seul le déclarant est prévenu, titre et texte');
select is((select count(*)::int from notifications where type = 'stock_bas'), 0, 'clôture : 10 -> 8, seuil 5 non franchi, pas d''alerte');

-- Déjà clôturée
select tests.se_connecter('com1');
select throws_ok($$ select cloturer_intervention(tests.id('I1'), 'x', 'operationnel') $$, 'P0002', null, 'deuxième clôture refusée');

-- Urgence (I4, texte libre) : pas de machine, rien à mettre à jour, clôture possible
select lives_ok($$ select cloturer_intervention((select v from ctx where k = 'I4'), 'Réglé', 'operationnel') $$,
                'clôture d''une urgence en texte libre acceptée');
select tests.se_deconnecter();
select is((select count(*)::int from maintenance_logs where notes = 'Réglé'), 0, 'urgence sans machine : pas de journal d''entretien');

-- Urgence sur une machine avec plan : dernier entretien mis à jour
update maintenance_plans set last_done_at = current_date - 100, next_due_at = current_date - 70 where equipment_id = tests.id('E1');
insert into interventions (id, equipment_id, restaurant_id, type, reported_by)
  values (gen_random_uuid(), tests.id('E1'), tests.id('R1'), 'urgence', tests.id('com1'));
select tests.se_connecter('com1');
select lives_ok($$ select cloturer_intervention((select id from interventions where equipment_id = tests.id('E1') and type = 'urgence'),
                   'Urgence traitée', 'en_maintenance') $$, 'clôture urgence acceptée (commentateur)');
select tests.se_deconnecter();
select is((select last_done_at from maintenance_plans where equipment_id = tests.id('E1')), current_date,
          'clôture urgence : dernier entretien = jour de clôture');
select is((select state::text from equipments where id = tests.id('E1')), 'en_maintenance', 'clôture : état « en maintenance » appliqué');
select is((select count(*)::int from notifications where type = 'reparation' and user_id = tests.id('com1')), 0,
          'clôture par le déclarant lui-même : pas de notification');

-- Alerte : dernier entretien inchangé, pas de journal d'entretien
update maintenance_plans set last_done_at = current_date - 20, next_due_at = current_date + 10 where equipment_id = tests.id('E1');
insert into interventions (id, equipment_id, restaurant_id, type, reported_by)
  values (gen_random_uuid(), tests.id('E1'), tests.id('R1'), 'alerte', tests.id('lec1'));
select tests.se_connecter('ed1');
select lives_ok($$ select cloturer_intervention((select id from interventions where equipment_id = tests.id('E1') and type = 'alerte'),
                   'Alerte vérifiée', 'hors_service') $$, 'clôture d''une alerte acceptée');
select tests.se_deconnecter();
select is((select last_done_at from maintenance_plans where equipment_id = tests.id('E1')), current_date - 20,
          'clôture alerte : dernier entretien inchangé');
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')), current_date + 10,
          'clôture alerte : échéance inchangée');
select is((select count(*)::int from maintenance_logs where notes = 'Alerte vérifiée'), 0, 'clôture alerte : pas de journal d''entretien');
select is((select state::text from equipments where id = tests.id('E1')), 'hors_service', 'clôture alerte : état de la machine mis à jour');

-- Machine sans plan (I3 sur E3) : journal sans plan, aucun plan créé
select tests.se_connecter('com1');
select lives_ok($$ select cloturer_intervention((select v from ctx where k = 'I3'), 'Roulement graissé', 'operationnel') $$,
                'clôture sur machine sans plan acceptée');
select tests.se_deconnecter();
select is((select count(*)::int from maintenance_plans where equipment_id = tests.id('E3')), 0, 'machine sans plan : aucun plan créé');
select is((select count(*)::int from maintenance_logs where equipment_id = tests.id('E3') and plan_id is null and done_at = current_date), 1,
          'machine sans plan : entretien journalisé sans plan');

-- Atomicité : stock insuffisant sur la 2e pièce => rien n'est écrit
update equipments set state = 'en_panne' where id = tests.id('E1');
insert into interventions (id, equipment_id, restaurant_id, type, reported_by, description)
  values (gen_random_uuid(), tests.id('E1'), tests.id('R1'), 'normal', tests.id('lec1'), 'atomicite');
create temp table avant as
  select (select quantity from parts where id = tests.id('P1')) q1, (select quantity from parts where id = tests.id('P2')) q2,
         (select last_done_at from maintenance_plans where equipment_id = tests.id('E1')) ld,
         (select count(*) from stock_movements) nm, (select count(*) from maintenance_logs) nl,
         (select count(*) from equipment_events) ne, (select count(*) from notifications) nn;
select tests.se_connecter('ed1');
select throws_ok($$ select cloturer_intervention((select id from interventions where description = 'atomicite'), 'x', 'operationnel', null,
                   jsonb_build_array(jsonb_build_object('part_id', tests.id('P1'), 'quantity', 1),
                                     jsonb_build_object('part_id', tests.id('P2'), 'quantity', 99))) $$,
                 '23514', null, 'clôture avec stock insuffisant refusée');
select throws_ok($$ select cloturer_intervention((select id from interventions where description = 'atomicite'), 'x', 'operationnel', null,
                   jsonb_build_array(jsonb_build_object('part_id', tests.id('P1'), 'quantity', 0))) $$,
                 '22023', null, 'clôture avec quantité 0 refusée');
select throws_ok($$ select cloturer_intervention((select id from interventions where description = 'atomicite'), 'x', 'operationnel', null,
                   jsonb_build_array(jsonb_build_object('part_id', gen_random_uuid(), 'quantity', 1))) $$,
                 'P0002', null, 'clôture avec pièce inconnue refusée');
select tests.se_deconnecter();
select is((select status::text from interventions where description = 'atomicite'), 'a_planifier', 'atomicité : intervention toujours ouverte');
select is((select row(q1, q2, ld, nm, nl, ne, nn)::text from avant),
          (select row((select quantity from parts where id = tests.id('P1')), (select quantity from parts where id = tests.id('P2')),
                      (select last_done_at from maintenance_plans where equipment_id = tests.id('E1')),
                      (select count(*) from stock_movements), (select count(*) from maintenance_logs),
                      (select count(*) from equipment_events), (select count(*) from notifications))::text),
          'atomicité : stock, entretien, journaux, fiche de vie et notifications inchangés');
select is((select state::text from equipments where id = tests.id('E1')), 'en_panne', 'atomicité : état de la machine inchangé');

-- Alerte de seuil à la clôture, une seule fois (P1 : 8, seuil 5)
select tests.se_connecter('ed1');
select cloturer_intervention((select id from interventions where description = 'atomicite'), 'Filtres', 'operationnel', null,
       jsonb_build_array(jsonb_build_object('part_id', tests.id('P1'), 'quantity', 4)));  -- 8 -> 4
select tests.se_deconnecter();
select is((select count(*)::int from notifications where type = 'stock_bas' and link = '/stock/' || tests.id('P1')), 3,
          'clôture : franchissement du seuil (8 -> 4), une alerte par destinataire (prop, prop1, ed1)');
insert into interventions (id, equipment_id, restaurant_id, type, reported_by, description)
  values (gen_random_uuid(), tests.id('E1'), tests.id('R1'), 'normal', tests.id('lec1'), 'encore');
select tests.se_connecter('ed1');
select cloturer_intervention((select id from interventions where description = 'encore'), 'Filtre', 'operationnel', null,
       jsonb_build_array(jsonb_build_object('part_id', tests.id('P1'), 'quantity', 1)));  -- 4 -> 3
select tests.se_deconnecter();
select is((select count(*)::int from notifications where type = 'stock_bas' and link = '/stock/' || tests.id('P1')), 3,
          'clôture : déjà sous le seuil, pas de nouvelle alerte');
select is((select quantity from parts where id = tests.id('P1')),
          (select sum(delta)::int from stock_movements where part_id = tests.id('P1')), 'P1 : quantité = somme des mouvements après clôtures');

-- Refus
select is(tests.essai('lec1', $$ select 1 from (select cloturer_intervention(tests.id('I2'), 'x', 'operationnel')) s $$), 'refusé',
          'lecteur : clôture refusée');
select is(tests.essai('com1', $$ select 1 from (select cloturer_intervention(tests.id('I2'), 'x', 'operationnel')) s $$), 'refusé',
          'commentateur de R1 : clôture d''une intervention de R2 refusée');
select is(tests.essai('com2', $$ with t as (update interventions set status = 'terminee' where id = tests.id('I2') returning 1) select count(*) from t $$),
          'refusé', 'clôture directe (update status) refusée, seule la fonction clôture');

-- Contrôles en base de l'assignation et du rattachement (la page les vérifie, pas la base)
insert into interventions (id, equipment_id, restaurant_id, type, reported_by, description)
  values (gen_random_uuid(), tests.id('E1'), tests.id('R1'), 'normal', tests.id('lec1'), 'assignation');
select is(tests.essai('com1', $$ select 1 from (select cloturer_intervention((select id from interventions where description = 'assignation'),
          'x', 'operationnel', tests.id('com2'))) s $$), 'refusé',
          'clôture : technicien d''un autre restaurant (com2) refusé comme intervenant');
select is(tests.essai('com1', $$ with t as (update interventions set equipment_id = tests.id('E2')
          where description = 'assignation' returning 1) select count(*) from t $$), 'refusé',
          'commentateur R1 : rattacher son intervention à une machine de R2 refusé');
-- Conséquence si le rattachement passe : la clôture modifie la machine de R2.
-- Le refus (42501) est attendu : on l'absorbe pour que la suite du fichier continue.
select tests.se_connecter('com1');
do $$ begin
  update interventions set equipment_id = tests.id('E2') where description = 'assignation';
  perform cloturer_intervention((select id from interventions where description = 'assignation'), 'x', 'hors_service');
exception when insufficient_privilege then null;
end $$;
select tests.se_deconnecter();
select is((select state::text from equipments where id = tests.id('E2')), 'en_panne',
          'machine de R2 non modifiable par un commentateur de R1 (via rattachement puis clôture)');

select * from finish();
rollback;
