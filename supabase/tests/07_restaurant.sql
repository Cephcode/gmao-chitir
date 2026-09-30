-- 7. Ajout d'un restaurant avec copie des équipements : codes régénérés, sans historique.
begin;
\ir _fixture.sql
select * from no_plan();

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

-- Historique sur R1 avant copie : intervention, entretien, fiche de vie
select tests.se_connecter('com1');
select noter_entretien_fait(tests.id('E1'), current_date - 3, 'Avant copie');
select tests.se_deconnecter();

select tests.se_connecter('prop');
select lives_ok($$ insert into ctx values ('N', ajouter_restaurant('  Test C  ', ' tstc ', ' Rue 12 ', tests.id('R1'))) $$,
                'propriétaire : ajout avec copie de R1 accepté');
select tests.se_deconnecter();
select is((select name || '|' || short_code || '|' || address from restaurants where id = (select v from ctx)), 'Test C|TSTC|Rue 12',
          'nom, code court en majuscules et adresse nettoyés');
select is((select count(*)::int from equipments where restaurant_id = (select v from ctx)),
          (select count(*)::int from equipments where restaurant_id = tests.id('R1')), 'autant de machines que dans R1');
select set_eq($$ select code from equipments where restaurant_id = (select v from ctx) $$,
              $$ values ('TSTC-FRI-01'), ('TSTC-HOT-01'), ('TSTC-FRG-01'), ('TSTC-VIEUX-CODE') $$,
              'codes régénérés : préfixe TSTA remplacé, préfixe ajouté aux codes sans préfixe');
select is((select count(*)::int from equipments where restaurant_id = (select v from ctx) and state <> 'operationnel'), 0,
          'copie : toutes les machines démarrent opérationnelles (source en panne / hors service)');
select is((select count(*)::int from equipments where restaurant_id = (select v from ctx)
           and (serial_number is not null or installed_at is not null)), 0, 'copie : pas de n° de série ni de date d''installation');
select is((select name || '|' || coalesce(model, '') from equipments where restaurant_id = (select v from ctx) and code = 'TSTC-FRI-01'),
          'Friteuse test|F2P', 'copie : nom et modèle repris');
select is((select frequency || '|' || task || '|' || coalesce(last_done_at::text, '-') || '|' || next_due_at
           from maintenance_plans p join equipments e on e.id = p.equipment_id where e.code = 'TSTC-FRI-01'),
          'mensuel|Vidanger l''huile|-|' || (current_date + interval '1 month')::date,
          'copie : plan repris (fréquence, tâche), sans dernier entretien, échéance = aujourd''hui + fréquence');
select is((select count(*)::int from maintenance_plans p join equipments e on e.id = p.equipment_id
           where e.restaurant_id = (select v from ctx)), 2, 'copie : plans seulement pour les machines qui en ont (E1, E4)');
select is((select count(*)::int from interventions where restaurant_id = (select v from ctx)), 0, 'copie : aucune intervention');
select is((select count(*)::int from maintenance_logs l join equipments e on e.id = l.equipment_id where e.restaurant_id = (select v from ctx)), 0,
          'copie : aucun entretien');
select is((select string_agg(distinct ev.type || ' ' || ev.summary, ';') from equipment_events ev join equipments e on e.id = ev.equipment_id
           where e.restaurant_id = (select v from ctx)), 'modification Équipement ajouté (copié depuis TSTA)',
          'copie : fiche de vie limitée à « Équipement ajouté (copié depuis TSTA) »');
select is((select count(*)::int from part_compatibilities pc join equipments e on e.id = pc.equipment_id where e.code = 'TSTC-FRI-01'), 1,
          'copie : pièces « va avec » reprises');
select is((select count(*)::int from equipments where restaurant_id = tests.id('R1')), 4, 'source R1 inchangée (E1, E3, E4, E5)');

-- Restaurant vide, créé par un propriétaire (prop1, tous restaurants depuis la recette S-M2)
select tests.se_connecter('prop1');
select lives_ok($$ insert into ctx values ('V', ajouter_restaurant('Test D', 'TSTD')) $$, 'propriétaire : ajout sans copie accepté');
select is((select count(*)::int from restaurants where id = (select v from ctx where k = 'V')), 1,
          'propriétaire : voit le restaurant qu''il vient de créer');
select tests.se_deconnecter();
select is((select count(*)::int from equipments where restaurant_id = (select v from ctx where k = 'V')), 0, 'sans copie : aucune machine');

-- Refus et validations
select tests.se_connecter('prop1');
select throws_ok($$ select ajouter_restaurant('Doublon', 'TSTA') $$, '23505', null, 'code court déjà pris refusé');
select throws_ok($$ select ajouter_restaurant('Court', 'T') $$, '22023', null, 'code court d''une lettre refusé');
select throws_ok($$ select ajouter_restaurant('Espace', 'TS T') $$, '22023', null, 'code court avec espace refusé');
select throws_ok($$ select ajouter_restaurant('Long', 'TSTLONG') $$, '22023', null, 'code court de 7 caractères refusé');
select throws_ok($$ select ajouter_restaurant('  ', 'TSTF') $$, '22023', null, 'nom vide refusé');
select tests.se_deconnecter();
-- Recette S-M2 : le propriétaire limité n'existe plus, la base le refuse (même en écriture privilégiée).
select throws_ok($$ update users set all_restaurants = false where id = tests.id('prop1') $$, '23514', null,
                 'propriétaire limité à certains restaurants : refusé par la base');
select is(tests.essai('ed1', $$ select 1 from (select ajouter_restaurant('Par éditeur', 'TSTG')) s $$), 'refusé', 'éditeur : ajout refusé');
select is(tests.essai('com1', $$ select 1 from (select ajouter_restaurant('Par technicien', 'TSTG')) s $$), 'refusé', 'commentateur : ajout refusé');
select is(tests.essai('lec1', $$ select 1 from (select ajouter_restaurant('Par lecteur', 'TSTG')) s $$), 'refusé', 'lecteur : ajout refusé');
select is(tests.essai('ed1', $$ with t as (insert into restaurants (name, short_code) values ('Direct', 'TSTH') returning 1) select count(*) from t $$),
          'refusé', 'éditeur : création directe d''un restaurant refusée');
select is(tests.essai('prop', $$ with t as (insert into restaurants (name, short_code) values ('Direct', 'TSTH') returning 1) select count(*) from t $$),
          'refusé', 'propriétaire : création directe refusée (passer par ajouter_restaurant)');

-- Atomicité : si un code copié existe déjà, rien n'est créé
insert into equipments (restaurant_id, code, name) values (tests.id('R2'), 'TSTK-FRI-01', 'Conflit');
select tests.se_connecter('prop');
select throws_ok($$ select ajouter_restaurant('Test K', 'TSTK', null, tests.id('R1')) $$, '23505', null,
                 'copie avec code déjà existant : erreur');
select tests.se_deconnecter();
select is((select count(*)::int from restaurants where short_code = 'TSTK'), 0, 'copie échouée : restaurant non créé (une seule transaction)');

select * from finish();
rollback;
