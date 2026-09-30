-- 8. Statuts d'intervention (phase 3) : statut choisi à la déclaration, changement de
-- statut par la fonction, notification du déclarant, clôture depuis tout statut ouvert.
begin;
\ir _fixture.sql
select * from no_plan();

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

-- Déclaration avec statut choisi
select tests.se_connecter('com1');
insert into ctx values ('D1', declarer_panne(tests.id('E3'), 'normal', '{}', 'Bruit', null, null, null, 'en_attente_piece'));
select throws_ok($$ select declarer_panne(tests.id('E3'), 'normal', '{}', 'x', null, null, null, 'terminee') $$, '22023', null,
                 'déclaration directement « terminée » refusée');
select tests.se_deconnecter();
select is((select status::text from interventions where id = (select v from ctx where k = 'D1')), 'en_attente_piece',
          'commentateur : statut de départ choisi (en attente de pièce)');
select tests.se_connecter('ed1');
insert into ctx values ('D2', declarer_panne(tests.id('E3'), 'urgence', '{}', 'Fumée', null, null, null, 'en_cours'));
select tests.se_deconnecter();
select is((select status::text from interventions where id = (select v from ctx where k = 'D2')), 'en_cours',
          'éditeur : statut de départ choisi (en cours)');
select tests.se_connecter('lec1');
insert into ctx values ('D3', declarer_panne(tests.id('E3'), 'normal', '{}', 'Lecteur', null, null, null, 'en_cours'));
insert into ctx values ('D4', declarer_panne(tests.id('E3'), 'normal', '{}', 'Lecteur 2', null, null, null, 'terminee'));
select tests.se_deconnecter();
select is((select string_agg(status::text, ' ' order by description) from interventions
           where id in ((select v from ctx where k = 'D3'), (select v from ctx where k = 'D4'))),
          'a_planifier a_planifier', 'lecteur : statut forcé à « à planifier » quel que soit le paramètre');
select is((select count(*)::int from pg_proc where proname = 'declarer_panne'), 1, 'declarer_panne : une seule version');

-- Changement de statut : droits (I1 sur R1, déclarée par lec1)
select is(tests.essai('lec1', $$ select 1 from (select changer_statut_intervention(tests.id('I1'), 'en_cours')) s $$),
          'refusé', 'lecteur : changement de statut refusé');
select is(tests.essai('com2', $$ select 1 from (select changer_statut_intervention(tests.id('I1'), 'en_cours')) s $$),
          'refusé', 'commentateur d''un autre restaurant : changement de statut refusé');
select is(tests.essai('ed2', $$ select 1 from (select changer_statut_intervention(tests.id('I1'), 'en_cours')) s $$),
          'refusé', 'éditeur d''un autre restaurant : changement de statut refusé');
select is(tests.essai('com1', $$ with t as (update interventions set status = 'a_planifier' where id = tests.id('I1') returning 1) select count(*) from t $$),
          'refusé', 'statut non modifiable en direct (update)');
select tests.se_connecter('com1');
select throws_ok($$ select changer_statut_intervention(tests.id('I1'), 'terminee') $$, '22023', null,
                 'passage à « terminée » par changement de statut refusé');
select tests.se_deconnecter();

-- Changement par chaque rôle autorisé, notification du déclarant (lec1)
select tests.se_connecter('com1');
select lives_ok($$ select changer_statut_intervention(tests.id('I1'), 'a_planifier') $$, 'commentateur : en cours -> à planifier');
select tests.se_deconnecter();
select tests.se_connecter('ed1');
select lives_ok($$ select changer_statut_intervention(tests.id('I1'), 'en_attente_piece') $$, 'éditeur : à planifier -> en attente de pièce');
select tests.se_deconnecter();
select tests.se_connecter('prop1');
select lives_ok($$ select changer_statut_intervention(tests.id('I1'), 'en_cours') $$, 'propriétaire : en attente de pièce -> en cours');
select lives_ok($$ select changer_statut_intervention(tests.id('I1'), 'en_cours') $$, 'même statut : sans effet, sans erreur');
select tests.se_deconnecter();
select is((select status::text from interventions where id = tests.id('I1')), 'en_cours', 'statut final en cours');
select is((select count(*)::int from notifications where user_id = tests.id('lec1') and type = 'statut_intervention'
           and link = '/interventions/' || tests.id('I1')), 3, 'déclarant prévenu à chaque changement (3, pas pour le même statut)');
select is((select title || ' | ' || body from notifications where user_id = tests.id('lec1') and type = 'statut_intervention'
           and body like 'Par Awa%'),
          'À planifier : Friteuse test, TSTA | Par Awa · Avant : En cours', 'notification : titre et texte');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E1') and type = 'modification'
           and ref_id = tests.id('I1') and summary like 'Statut : %'), 3, 'fiche de vie : une ligne par changement');
select is((select summary from equipment_events where equipment_id = tests.id('E1') and ref_id = tests.id('I1')
           and user_id = tests.id('ed1') and type = 'modification'),
          'Statut : À planifier → En attente de pièce', 'fiche de vie : ancien et nouveau statut');
select is((select state::text from equipments where id = tests.id('E1')), 'en_panne', 'machine toujours en panne');

-- Le déclarant ne se prévient pas lui-même ; réglage désactivé respecté
select tests.se_connecter('com1');
select changer_statut_intervention((select v from ctx where k = 'D1'), 'en_cours');
select tests.se_deconnecter();
select is((select count(*)::int from notifications where type = 'statut_intervention'
           and link = '/interventions/' || (select v from ctx where k = 'D1')), 0, 'déclarant qui change lui-même : pas de notification');
insert into notification_settings (user_id, type, enabled) values (tests.id('ed1'), 'statut_intervention', false);
select tests.se_connecter('com1');
select changer_statut_intervention((select v from ctx where k = 'D2'), 'a_planifier');
select tests.se_deconnecter();
select is((select count(*)::int from notifications where type = 'statut_intervention'
           and link = '/interventions/' || (select v from ctx where k = 'D2')), 0, 'réglage « statut » désactivé : pas de notification');

-- Clôture depuis « en attente de pièce », puis plus de changement possible
select tests.se_connecter('com1');
select changer_statut_intervention((select v from ctx where k = 'D1'), 'en_attente_piece');
select lives_ok($$ select cloturer_intervention((select v from ctx where k = 'D1'), 'Pièce posée', 'operationnel') $$,
                'clôture acceptée depuis « en attente de pièce »');
select throws_ok($$ select changer_statut_intervention((select v from ctx where k = 'D1'), 'en_cours') $$, '22023', null,
                 'intervention terminée : changement de statut refusé');
select tests.se_deconnecter();
select is((select status::text from interventions where id = (select v from ctx where k = 'D1')), 'terminee',
          'intervention clôturée : terminée');

-- Droits d'exécution
select is(has_function_privilege('anon', 'changer_statut_intervention(uuid, intervention_status)', 'execute'), false,
          'anon : changer_statut_intervention non exécutable');
select is(has_function_privilege('anon', 'declarer_panne(uuid, intervention_type, text[], text, text, uuid, text, intervention_status)', 'execute'), false,
          'anon : declarer_panne non exécutable');

select * from finish();
rollback;
