-- 12. Retours de la présentation client (2026-10-06) : créer une intervention de tout
-- type, noms de machine uniques par restaurant, date d'installation par défaut.
begin;
\ir _fixture.sql
select * from no_plan();

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

-- ============================================================
-- creer_intervention
-- ============================================================

-- Entretien préventif par un commentateur, technicien choisi : la machine garde son état.
select tests.se_connecter('com1');
insert into ctx values ('P', creer_intervention('preventif', 'Nettoyer les filtres', tests.id('E3'),
                                                p_assigned_to => tests.id('com1b')));
select tests.se_deconnecter();
select is((select kind::text || ' ' || type::text || ' ' || status::text from interventions where id = (select v from ctx where k = 'P')),
          'preventif normal a_planifier', 'préventif : type, priorité et statut par défaut');
select is((select state::text from equipments where id = tests.id('E3')), 'operationnel',
          'préventif : la machine reste opérationnelle');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E3')
           and ref_id = (select v from ctx where k = 'P') and summary = 'Intervention créée : Entretien préventif'), 1,
          'préventif : ligne dans la fiche de vie');
select is((select count(*)::int from notifications where user_id = tests.id('com1b') and type = 'attribution'
           and link = '/interventions/' || (select v from ctx where k = 'P')), 1,
          'préventif : le technicien choisi est prévenu (attribution)');
select is((select count(*)::int from notifications where type in ('panne', 'urgence')
           and link = '/interventions/' || (select v from ctx where k = 'P')), 0,
          'préventif : pas d''alerte de panne à l''équipe');

-- Réparation (correctif) urgente par un éditeur : comme une panne déclarée.
select tests.se_connecter('ed1');
insert into ctx values ('C', creer_intervention('correctif', 'Ne démarre plus', tests.id('E5'),
                                                p_type => 'urgence', p_status => 'en_cours'));
select tests.se_deconnecter();
select is((select state::text from equipments where id = tests.id('E5')), 'en_panne', 'réparation : la machine passe en panne');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E5') and type = 'panne_declaree'), 1,
          'réparation : fiche de vie « Urgence déclarée »');
select ok((select count(*) > 0 from notifications where type = 'urgence'
           and link = '/interventions/' || (select v from ctx where k = 'C')), 'réparation urgente : l''équipe est prévenue');

-- Machine hors liste
select tests.se_connecter('com1');
insert into ctx values ('L', creer_intervention('controle', 'Vérifier la prise', null, tests.id('R1'), 'Prise du comptoir'));
select tests.se_deconnecter();
select is((select equipment_free_text || ' ' || kind::text from interventions where id = (select v from ctx where k = 'L')),
          'Prise du comptoir controle', 'contrôle sur une machine hors liste');

-- Refus
select tests.se_connecter('lec1');
select throws_ok($$ select creer_intervention('preventif', 'x', tests.id('E3')) $$, '42501', null,
                 'lecteur : création refusée (il garde « Déclarer une panne »)');
select tests.se_connecter('ed1');
select throws_ok($$ select creer_intervention('preventif', 'x', tests.id('E2')) $$, '42501', null,
                 'machine d''un autre restaurant : refusé');
select throws_ok($$ select creer_intervention('preventif', 'x', tests.id('E3'), p_assigned_to => tests.id('com2')) $$, '42501', null,
                 'technicien sans accès au restaurant : refusé');
select throws_ok($$ select creer_intervention(null, 'x', tests.id('E3')) $$, '22004', null, 'type obligatoire');
select throws_ok($$ select creer_intervention('preventif', '  ', tests.id('E3')) $$, '22004', null, 'description obligatoire');
select throws_ok($$ select creer_intervention('preventif', 'x', tests.id('E3'), p_status => 'terminee') $$, '22023', null,
                 'création déjà terminée refusée');
select throws_ok($$ select creer_intervention('preventif', 'x', tests.id('E3'), p_type => 'alerte') $$, '22023', null,
                 'priorité « alerte » refusée');
select throws_ok($$ select creer_intervention('preventif', 'x', null, tests.id('R1'), '  ') $$, '22004', null,
                 'machine hors liste sans description refusée');
select tests.se_deconnecter();

-- Clôturer un entretien préventif recale le plan d'entretien (E1, mensuel en retard).
select tests.se_connecter('com1');
insert into ctx values ('E', creer_intervention('preventif', 'Vidange', tests.id('E1')));
select cloturer_intervention((select v from ctx where k = 'E'), 'Vidange faite', 'operationnel');
select tests.se_deconnecter();
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')),
          (current_date + interval '1 month')::date, 'préventif clôturé : prochaine échéance recalculée');

-- ============================================================
-- Attribution : le technicien est prévenu (application, push, e-mail)
-- ============================================================
-- Réparation attribuée : le technicien reçoit « attribution », pas en plus l'alerte « panne ».
select tests.se_connecter('ed1');
insert into ctx values ('A', creer_intervention('correctif', 'Fuite', tests.id('E3'), p_assigned_to => tests.id('com1')));
select tests.se_deconnecter();
select is((select string_agg(type::text, ',') from notifications where user_id = tests.id('com1')
           and link = '/interventions/' || (select v from ctx where k = 'A')), 'attribution',
          'réparation attribuée : une seule notification pour le technicien (attribution)');
select is((select title from notifications where user_id = tests.id('com1') and type = 'attribution'
           and link = '/interventions/' || (select v from ctx where k = 'A')), 'Intervention attribuée : Hotte test, TSTA',
          'attribution : titre avec la machine et le restaurant');

-- Changement de technicien par « Enregistrer » (écriture directe) : le nouveau est prévenu.
select tests.se_connecter('ed1');
update interventions set assigned_to = tests.id('com1b') where id = tests.id('I1');
-- Même technicien réenregistré : pas de nouveau message.
update interventions set assigned_to = tests.id('com1b'), work_done = 'En cours' where id = tests.id('I1');
select tests.se_deconnecter();
select is((select count(*)::int from notifications where user_id = tests.id('com1b') and type = 'attribution'
           and link = '/interventions/' || tests.id('I1')), 1, 'réattribution : prévenu une seule fois');
select ok((select body like 'Par Eddy · Réparation · %' from notifications where user_id = tests.id('com1b')
           and type = 'attribution' and link = '/interventions/' || tests.id('I1')), 'attribution : qui attribue, et le type');

-- S'attribuer soi-même : pas de message.
select tests.se_connecter('com1');
update interventions set assigned_to = tests.id('com1') where id = tests.id('I1');
select tests.se_deconnecter();
select is((select count(*)::int from notifications where user_id = tests.id('com1') and type = 'attribution'
           and link = '/interventions/' || tests.id('I1')), 0, 's''attribuer soi-même : pas de notification');

-- Attribution à la clôture : rien (l'intervention est terminée).
select tests.se_connecter('ed2');
select cloturer_intervention(tests.id('I2'), 'Joint changé', 'operationnel', tests.id('com2'));
select tests.se_deconnecter();
select is((select count(*)::int from notifications where user_id = tests.id('com2') and type = 'attribution'), 0,
          'attribution à la clôture : pas de notification');

-- Réglage « Mes alertes » coupé : rien.
insert into notification_settings (user_id, type, enabled) values (tests.id('com1b'), 'attribution', false);
select tests.se_connecter('ed1');
select creer_intervention('controle', 'Vérifier', tests.id('E3'), p_assigned_to => tests.id('com1b'));
select tests.se_deconnecter();
select is((select count(*)::int from notifications where user_id = tests.id('com1b') and type = 'attribution'), 2,
          'alerte « attribution » coupée : pas de nouvelle notification');

-- Compte sans prénom : l'e-mail le remplace dans le message.
update users set first_name = null where id = tests.id('ed2');
select tests.se_connecter('ed2');
select creer_intervention('preventif', 'Graisser', tests.id('E2'), p_assigned_to => tests.id('com2'));
select tests.se_deconnecter();
select ok((select bool_and(body like 'Par ed2@test.local · %') from notifications where user_id = tests.id('com2') and type = 'attribution'),
          'sans prénom : l''e-mail de celui qui attribue');

-- ============================================================
-- Noms uniques par restaurant, date d'installation par défaut
-- ============================================================
select tests.se_connecter('ed1');
select throws_ok($$ select enregistrer_equipement(null, tests.id('R1'), '  friteuse   TÉST ', '', 'operationnel') $$,
                 '23505', null, 'même nom dans le même restaurant (casse, accents, espaces ignorés) : refusé');
insert into ctx values ('N', enregistrer_equipement(null, tests.id('R1'), 'Clim  7', '', 'operationnel'));
select is((select installed_at from equipments where id = (select v from ctx where k = 'N')), current_date,
          'sans date : installation = aujourd''hui');
select throws_ok($$ select enregistrer_equipement(tests.id('E3'), tests.id('R1'), 'clim 7', 'TSTA-HOT-01', 'operationnel') $$,
                 '23505', null, 'renommer une machine avec un nom déjà pris : refusé');
select lives_ok($$ select enregistrer_equipement((select v from ctx where k = 'N'), tests.id('R1'), 'Clim 7', '', 'en_panne') $$,
                'modifier une machine en gardant son nom : accepté');
insert into ctx values ('D', enregistrer_equipement(null, tests.id('R1'), 'Congélateur daté', '', 'operationnel',
                                                    p_installed_at => '2020-05-01'));
select tests.se_deconnecter();
select is((select name from equipments where id = (select v from ctx where k = 'N')), 'Clim 7', 'nom nettoyé (espaces en trop)');
select is((select installed_at from equipments where id = (select v from ctx where k = 'D')), '2020-05-01'::date,
          'date saisie conservée');

select tests.se_connecter('ed2');
select lives_ok($$ select enregistrer_equipement(null, tests.id('R2'), 'Clim 7', '', 'operationnel') $$,
                'même nom dans un autre restaurant : accepté');
select tests.se_deconnecter();

-- Écriture directe (hors fonction) : l'index unique garantit la règle.
select throws_ok($$ insert into equipments (restaurant_id, code, name) values (tests.id('R1'), 'TSTA-X-99', 'CLIM 7') $$,
                 '23505', null, 'garantie en base : doublon refusé même en écriture directe');

select * from finish();
rollback;
