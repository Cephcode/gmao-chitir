-- 1. Stock : livraison, corrections, jamais négatif, stock initial = somme des mouvements,
-- alerte de seuil au franchissement seulement, droits sur le stock.
-- (Décrément à la clôture : 02_cloture.sql ; clôtures simultanées : concurrence.sh)
begin;
\ir _fixture.sql
select * from no_plan();

create function tests.qte(p text) returns int language sql as
  $$ select quantity from parts where id = tests.id(p) $$;
create function tests.somme_mvts(p text) returns int language sql as
  $$ select coalesce(sum(delta), 0)::int from stock_movements where part_id = tests.id(p) $$;
create function tests.alertes(p text) returns int language sql as
  $$ select count(*)::int from notifications where type = 'stock_bas' and link = '/stock/' || tests.id(p) $$;
grant execute on all functions in schema tests to authenticated;

-- Livraison et corrections (éditeur)
select tests.se_connecter('ed1');
select lives_ok($$ select mouvement_stock(tests.id('P1'), 5, 'livraison') $$, 'livraison +5 acceptée');
select is(tests.qte('P1'), 15, 'livraison : 10 + 5 = 15');
select is((select count(*)::int from stock_movements
           where part_id = tests.id('P1') and reason = 'livraison' and delta = 5 and user_id = tests.id('ed1')),
          1, 'livraison tracée (motif, quantité, auteur)');
select lives_ok($$ select mouvement_stock(tests.id('P1'), -3) $$, 'correction -3 acceptée');
select is(tests.qte('P1'), 12, 'correction - : 15 - 3 = 12');
select lives_ok($$ select mouvement_stock(tests.id('P1'), 2) $$, 'correction +2 acceptée');
select is(tests.qte('P1'), 14, 'correction + : 12 + 2 = 14');
select is((select count(*)::int from stock_movements where part_id = tests.id('P1') and reason = 'ajustement'), 2,
          'corrections tracées en ajustement');

-- Jamais négatif
select throws_ok($$ select mouvement_stock(tests.id('P1'), -15) $$, '23514', null, 'retrait supérieur au stock refusé');
select is(tests.qte('P1'), 14, 'stock inchangé après retrait refusé');
select lives_ok($$ select mouvement_stock(tests.id('P1'), -14) $$, 'retrait exact jusqu''à 0 accepté');
select is(tests.qte('P1'), 0, 'stock à 0');
select throws_ok($$ select mouvement_stock(tests.id('P1'), -1) $$, '23514', null, 'retrait sur stock 0 refusé');
select throws_ok($$ select mouvement_stock(tests.id('P1'), 0) $$, '22023', null, 'mouvement nul refusé');
select throws_ok($$ select mouvement_stock(gen_random_uuid(), 1) $$, 'P0002', null, 'pièce inconnue refusée');
select tests.se_deconnecter();
select throws_ok($$ update parts set quantity = -1 where id = tests.id('P1') $$, '23514', null,
                 'contrainte : quantité négative impossible même en direct (postgres)');

-- Quantité = somme des mouvements (après toutes les opérations ci-dessus)
select is(tests.qte('P1'), tests.somme_mvts('P1'), 'P1 : quantité = somme des mouvements');

-- Pièce créée avec un stock initial, comme l'application (insert à 0 puis livraison)
select tests.se_connecter('ed1');
insert into parts (code, name, quantity, min_threshold) values ('TST-NEW-01', 'Pièce neuve', 0, 2);
select lives_ok($$ select mouvement_stock((select id from parts where code = 'TST-NEW-01'), 7, 'livraison') $$,
                'stock initial 7 enregistré comme livraison');
select is((select quantity from parts where code = 'TST-NEW-01'), 7, 'pièce neuve : quantité 7');
select is((select sum(delta)::int from stock_movements m join parts p on p.id = m.part_id where p.code = 'TST-NEW-01'),
          7, 'pièce neuve : quantité = somme des mouvements');

-- Invariant : les quantités ne bougent que par des mouvements (commentaire RLS, stock/actions.ts).
-- Un éditeur ne doit pas pouvoir créer une pièce avec une quantité non nulle sans mouvement,
-- ni changer la quantité en direct.
select is(tests.essai('ed1', $$ with t as (insert into parts (code, name, quantity) values ('TST-DIR-01', 'Directe', 50) returning 1) select count(*) from t $$),
          'refusé', 'éditeur : création directe d''une pièce avec quantité 50 sans mouvement refusée');
select is(tests.essai('ed1', $$ with t as (update parts set quantity = 999 where id = tests.id('P2') returning 1) select count(*) from t $$),
          'refusé', 'éditeur : modification directe de la quantité refusée');
select is(tests.essai('ed1', $$ with t as (insert into stock_movements (part_id, delta, reason) values (tests.id('P2'), 5, 'livraison') returning 1) select count(*) from t $$),
          'refusé', 'éditeur : insertion directe d''un mouvement refusée');
select tests.se_deconnecter();

-- Alerte de seuil (P2 remis à 10, seuil 5) : une seule fois au franchissement vers le bas.
update parts set quantity = 10, min_threshold = 5 where id = tests.id('P2');
insert into stock_movements (part_id, delta, reason) values (tests.id('P2'), 7, 'livraison');
select tests.se_connecter('ed1');
select mouvement_stock(tests.id('P2'), -4);  -- 10 -> 6
select is(tests.alertes('P2'), 0, 'seuil : 10 -> 6, pas d''alerte');
select mouvement_stock(tests.id('P2'), -1);  -- 6 -> 5 (= seuil, pas sous le seuil)
select is(tests.alertes('P2'), 0, 'seuil : 6 -> 5 (égal au seuil), pas d''alerte');
select mouvement_stock(tests.id('P2'), -1);  -- 5 -> 4 : franchissement
select tests.se_deconnecter();
select is(tests.alertes('P2'), 3, 'seuil : 5 -> 4, alerte envoyée à prop, prop1, ed1 (ed2 a coupé l''alerte)');
select set_eq($$ select user_id from notifications where type = 'stock_bas' and link = '/stock/' || tests.id('P2') $$,
              $$ select tests.id(n) from unnest(array['prop', 'prop1', 'ed1']) n $$,
              'seuil : destinataires = propriétaires et éditeurs ayant l''alerte active');
select is((select distinct title || ' | ' || body from notifications where type = 'stock_bas' and link = '/stock/' || tests.id('P2')),
          'Joint test sous le seuil | Il reste 4, seuil 5', 'seuil : titre et texte');
select tests.se_connecter('ed1');
select mouvement_stock(tests.id('P2'), -1);  -- 4 -> 3 : déjà sous le seuil
select mouvement_stock(tests.id('P2'), -3);  -- 3 -> 0
select tests.se_deconnecter();
select is(tests.alertes('P2'), 3, 'seuil : baisses suivantes sous le seuil, pas de nouvelle alerte');
select tests.se_connecter('ed1');
select mouvement_stock(tests.id('P2'), 10, 'livraison'); -- 0 -> 10, repasse au-dessus
select mouvement_stock(tests.id('P2'), -6);              -- 10 -> 4 : nouveau franchissement
select tests.se_deconnecter();
select is(tests.alertes('P2'), 6, 'seuil : après réassort puis nouvelle baisse, une nouvelle alerte');
select is(tests.qte('P2'), tests.somme_mvts('P2'), 'P2 : quantité = somme des mouvements');

-- Droits sur les mouvements de stock
select is(tests.essai('prop', $$ select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s $$), 'autorisé', 'propriétaire : mouvement de stock autorisé');
select is(tests.essai('ed2', $$ select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s $$), 'autorisé', 'éditeur d''un autre restaurant : stock global, autorisé');
select is(tests.essai('com1', $$ select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s $$), 'refusé', 'commentateur : mouvement de stock refusé');
select is(tests.essai('lec1', $$ select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s $$), 'refusé', 'lecteur : mouvement de stock refusé');
select is(tests.essai('anon', $$ select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s $$), 'refusé', 'anonyme : mouvement de stock refusé');

select * from finish();
rollback;
