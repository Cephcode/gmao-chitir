-- 13. Consommables (stock des restaurants) : livraison, consommation, perte, inventaire,
-- transfert, seuil et alertes, suivi par restaurant, droits rôle × restaurant.
-- Migration : 20261009090000_consommables.sql. Plan : docs/plan-module-consommables.md.
begin;
\ir _fixture.sql
select * from no_plan();

-- Articles de test (créés en postgres : aucune ligne de stock, donc suivis nulle part).
insert into tests.ids (nom) values ('A1'), ('A2'), ('A3');
insert into articles (id, code, name, famille, unit, default_threshold) values
  (tests.id('A1'), 'TST-GOB-50', 'Gobelet test', 'jetable', 'carton', 5),
  (tests.id('A2'), 'TST-COLA', 'Cola test', 'boisson', 'casier', 0),
  (tests.id('A3'), 'TST-HUILE', 'Huile test', 'materiel', 'litre', 2);

create function tests.aq(a text, r text) returns int language sql as
  $$ select quantity from article_stocks where article_id = tests.id(a) and restaurant_id = tests.id(r) $$;
create function tests.aseuil(a text, r text) returns int language sql as
  $$ select min_threshold from article_stocks where article_id = tests.id(a) and restaurant_id = tests.id(r) $$;
create function tests.asomme(a text, r text) returns int language sql as
  $$ select coalesce(sum(delta), 0)::int from article_mouvements where article_id = tests.id(a) and restaurant_id = tests.id(r) $$;
create function tests.aalertes(a text) returns int language sql as
  $$ select count(*)::int from notifications where type = 'stock_bas' and link like '/consommables/' || tests.id(a) || '%' $$;
grant execute on all functions in schema tests to authenticated;

-- ------------------------------------------------------------
-- Livraison, consommation, perte (éditeur de R1)
-- ------------------------------------------------------------
select is(tests.aq('A1', 'R1'), null, 'article neuf : pas suivi dans R1');
select tests.se_connecter('ed1');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 1) $$, '23514', null,
                 'consommation d''un article jamais livré refusée');
select is(mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', 20, ' Fournisseur X '), 20, 'livraison 20 : renvoie 20');
select tests.se_deconnecter();
select is(tests.aq('A1', 'R1'), 20, 'livraison : quantité 20 dans R1');
select is(tests.aseuil('A1', 'R1'), 5, 'première livraison : seuil par défaut de l''article (5)');
select is(tests.aq('A1', 'R2'), null, 'livraison dans R1 : R2 toujours pas suivi');
select is((select note || '|' || raison || '|' || delta || '|' || (user_id = tests.id('ed1'))
           from article_mouvements where article_id = tests.id('A1') and raison = 'livraison'),
          'Fournisseur X|livraison|20|true', 'livraison tracée (remarque nettoyée, raison, quantité, auteur)');

select tests.se_connecter('ed1');
select is(mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 6), 14, 'consommation 6 : 20 - 6 = 14');
select is(mouvement_article(tests.id('A1'), tests.id('R1'), 'perte', 2, ''), 12, 'perte 2 : 14 - 2 = 12');
select is((select delta from article_mouvements where article_id = tests.id('A1') and raison = 'perte'), -2,
          'perte enregistrée en négatif');
select is((select note from article_mouvements where article_id = tests.id('A1') and raison = 'perte'), null,
          'remarque vide enregistrée comme absente');

-- Saisies refusées
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 13) $$, '23514', null,
                 'consommation supérieure au stock refusée');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', 0) $$, '22023', null, 'quantité 0 refusée');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', -3) $$, '22023', null, 'quantité négative refusée');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', null) $$, '22023', null, 'quantité absente refusée');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'inventaire', 3) $$, '22023', null,
                 'raison inventaire refusée ici (fonction dédiée)');
select throws_ok($$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'transfert', 3) $$, '22023', null,
                 'raison transfert refusée ici (fonction dédiée)');
select throws_ok($$ select mouvement_article(gen_random_uuid(), tests.id('R1'), 'livraison', 1) $$, 'P0002', null, 'article inconnu refusé');
select tests.se_deconnecter();
select tests.se_connecter('prop');
select throws_ok($$ select mouvement_article(tests.id('A1'), gen_random_uuid(), 'livraison', 1) $$, 'P0002', null,
                 'propriétaire : restaurant inexistant refusé (pas de ligne orpheline)');
select tests.se_deconnecter();
select is(tests.aq('A1', 'R1'), 12, 'stock inchangé après les saisies refusées');
select is(tests.aq('A1', 'R1'), tests.asomme('A1', 'R1'), 'A1/R1 : quantité = somme des mouvements');

-- ------------------------------------------------------------
-- Inventaire
-- ------------------------------------------------------------
select tests.se_connecter('ed1');
select is(inventaire_article(tests.id('A1'), tests.id('R1'), 15, 'Comptage du soir'), 3, 'inventaire 15 compté pour 12 : écart +3');
select is(inventaire_article(tests.id('A1'), tests.id('R1'), 10), -5, 'inventaire 10 compté pour 15 : écart -5');
select is(inventaire_article(tests.id('A1'), tests.id('R1'), 10), 0, 'inventaire identique : écart 0');
select throws_ok($$ select inventaire_article(tests.id('A1'), tests.id('R1'), -1) $$, '22023', null, 'quantité comptée négative refusée');
select tests.se_deconnecter();
select is((select count(*)::int from article_mouvements where article_id = tests.id('A1') and raison = 'inventaire'), 2,
          'écart nul : aucun mouvement enregistré');
select is(tests.aq('A1', 'R1'), 10, 'inventaire : quantité = quantité comptée');
select is(tests.aq('A1', 'R1'), tests.asomme('A1', 'R1'), 'A1/R1 : quantité = somme des mouvements après inventaires');

-- Premier inventaire dans un restaurant : l'article y devient suivi.
select tests.se_connecter('ed2');
select is(inventaire_article(tests.id('A2'), tests.id('R2'), 8), 8, 'premier inventaire A2/R2 : écart +8');
select tests.se_deconnecter();
select is(tests.aq('A2', 'R2'), 8, 'premier inventaire : A2 suivi dans R2 avec 8');

-- ------------------------------------------------------------
-- Transfert (propriétaire : accès aux deux restaurants)
-- ------------------------------------------------------------
select tests.se_connecter('prop');
select is(transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R2'), 4, 'Dépannage'), 6, 'transfert 4 de R1 vers R2 : reste 6 au départ');
select tests.se_deconnecter();
select is(tests.aq('A1', 'R1'), 6, 'transfert : R1 = 6');
select is(tests.aq('A1', 'R2'), 4, 'transfert : R2 = 4 (devenu suivi)');
select is(tests.aseuil('A1', 'R2'), 5, 'transfert : seuil par défaut à l''arrivée');
select is((select count(distinct transfert_id)::int || '/' || count(*)::int from article_mouvements
           where article_id = tests.id('A1') and raison = 'transfert'), '1/2', 'transfert : deux mouvements liés');
select is((select autre_restaurant_id from article_mouvements
           where article_id = tests.id('A1') and raison = 'transfert' and restaurant_id = tests.id('R2')),
          tests.id('R1'), 'transfert : l''entrée indique le restaurant de départ');
select tests.se_connecter('prop');
select throws_ok($$ select transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R2'), 7) $$, '23514', null,
                 'transfert supérieur au stock de départ refusé');
select throws_ok($$ select transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R1'), 1) $$, '22023', null,
                 'transfert vers le même restaurant refusé');
select throws_ok($$ select transferer_article(tests.id('A3'), tests.id('R1'), tests.id('R2'), 1) $$, '23514', null,
                 'transfert d''un article non suivi au départ refusé');
select throws_ok($$ select transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R2'), 0) $$, '22023', null,
                 'transfert de 0 refusé');
select tests.se_deconnecter();
select is(tests.aq('A3', 'R2'), null, 'transfert refusé (annulé) : pas de ligne créée à l''arrivée');
select is(tests.aq('A1', 'R1') + tests.aq('A1', 'R2'), 10, 'transferts : total de la chaîne inchangé');
select is(tests.aq('A1', 'R2'), tests.asomme('A1', 'R2'), 'A1/R2 : quantité = somme des mouvements');

-- Éditeur de R1 : pas d'accès à R2, ni au départ ni à l'arrivée.
select is(tests.essai('ed1', $$ select transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R2'), 1) $$),
          'refusé', 'éditeur de R1 : transfert vers R2 refusé');
select is(tests.essai('ed1', $$ select transferer_article(tests.id('A1'), tests.id('R2'), tests.id('R1'), 1) $$),
          'refusé', 'éditeur de R1 : transfert depuis R2 refusé');

-- ------------------------------------------------------------
-- Seuil et alertes
-- ------------------------------------------------------------
delete from notifications;
-- A1/R1 = 6, seuil 5.
select tests.se_connecter('ed1');
select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 1);  -- 6 -> 5 (= seuil)
select tests.se_deconnecter();
select is(tests.aalertes('A1'), 0, 'seuil : 6 -> 5 (égal au seuil), pas d''alerte');
select tests.se_connecter('ed1');
select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 1);  -- 5 -> 4 : franchissement
select tests.se_deconnecter();
select set_eq($$ select user_id from notifications where type = 'stock_bas' $$,
              $$ select tests.id(n) from unnest(array['prop', 'prop1', 'ed1']) n $$,
              'seuil : propriétaires et éditeur de R1 prévenus (pas ed2, autre restaurant ; pas les techniciens)');
select is((select distinct title || ' | ' || body || ' | ' || link from notifications where type = 'stock_bas'),
          'Gobelet test sous le seuil · TSTA | Il reste 4, seuil 5 | /consommables/' || tests.id('A1') || '?restaurant=TSTA',
          'seuil : titre, texte et lien vers la fiche, restaurant choisi');
select tests.se_connecter('ed1');
select mouvement_article(tests.id('A1'), tests.id('R1'), 'perte', 1);  -- 4 -> 3 : déjà sous le seuil
select tests.se_deconnecter();
select is(tests.aalertes('A1'), 3, 'seuil : baisse suivante sous le seuil, pas de nouvelle alerte');

-- Inventaire et transfert déclenchent aussi l'alerte ; R2 : ed2 a coupé « stock_bas ».
delete from notifications;
update article_stocks set min_threshold = 4 where article_id = tests.id('A1') and restaurant_id = tests.id('R2');
select tests.se_connecter('prop');
select transferer_article(tests.id('A1'), tests.id('R2'), tests.id('R1'), 1);  -- R2 : 4 -> 3, seuil 4
select tests.se_deconnecter();
select set_eq($$ select user_id from notifications where type = 'stock_bas' $$,
              $$ select tests.id(n) from unnest(array['prop', 'prop1']) n $$,
              'transfert : alerte au départ ; ed2 (alerte coupée) non prévenu');
delete from notifications;
select tests.se_connecter('ed1');
select inventaire_article(tests.id('A1'), tests.id('R1'), 10);  -- remonte au-dessus
select inventaire_article(tests.id('A1'), tests.id('R1'), 2);   -- 10 -> 2 : franchissement
select tests.se_deconnecter();
select is(tests.aalertes('A1'), 3, 'inventaire : alerte au franchissement');

-- Réglage du seuil
select tests.se_connecter('ed1');
select lives_ok($$ select regler_seuil_article(tests.id('A1'), tests.id('R1'), 1) $$, 'éditeur : seuil réglé dans son restaurant');
select lives_ok($$ select regler_seuil_article(tests.id('A3'), tests.id('R1'), 4) $$, 'seuil réglé sur un article non suivi');
select throws_ok($$ select regler_seuil_article(tests.id('A1'), tests.id('R1'), -1) $$, '22023', null, 'seuil négatif refusé');
select tests.se_deconnecter();
select is(tests.aseuil('A1', 'R1'), 1, 'seuil A1/R1 = 1');
select is(tests.aq('A3', 'R1'), 0, 'réglage du seuil : A3 devient suivi dans R1, à 0');
select is(tests.aseuil('A1', 'R2'), 4, 'réglage du seuil dans R1 : R2 inchangé');
select is(tests.essai('ed1', $$ select 1 from (select regler_seuil_article(tests.id('A1'), tests.id('R2'), 0)) s $$),
          'refusé', 'éditeur de R1 : seuil de R2 refusé');

-- Ne plus suivre
select tests.se_connecter('ed1');
select throws_ok($$ select ne_plus_suivre_article(tests.id('A1'), tests.id('R1')) $$, '23514', null,
                 'ne plus suivre : refusé s''il reste du stock');
select lives_ok($$ select ne_plus_suivre_article(tests.id('A3'), tests.id('R1')) $$, 'ne plus suivre : accepté à 0');
select throws_ok($$ select ne_plus_suivre_article(tests.id('A3'), tests.id('R1')) $$, 'P0002', null,
                 'ne plus suivre : article déjà non suivi');
select tests.se_deconnecter();
select is(tests.aq('A3', 'R1'), null, 'ne plus suivre : ligne de stock retirée');

-- ------------------------------------------------------------
-- Droits : opérations par rôle et restaurant
-- ------------------------------------------------------------
select is(tests.essai('prop', $$ select mouvement_article(tests.id('A2'), tests.id('R1'), 'livraison', 1) $$), 'autorisé', 'propriétaire : livraison R1 autorisée');
select is(tests.essai('prop', $$ select mouvement_article(tests.id('A2'), tests.id('R2'), 'livraison', 1) $$), 'autorisé', 'propriétaire : livraison R2 autorisée');
select is(tests.essai('ed1', $$ select mouvement_article(tests.id('A2'), tests.id('R1'), 'livraison', 1) $$), 'autorisé', 'éditeur de R1 : livraison R1 autorisée');
select is(tests.essai('ed1', $$ select mouvement_article(tests.id('A2'), tests.id('R2'), 'livraison', 1) $$), 'refusé', 'éditeur de R1 : livraison R2 refusée');
select is(tests.essai('ed1', $$ select mouvement_article(tests.id('A2'), tests.id('R2'), 'consommation', 1) $$), 'refusé', 'éditeur de R1 : consommation R2 refusée');
select is(tests.essai('ed1', $$ select inventaire_article(tests.id('A2'), tests.id('R2'), 0) + 1 $$), 'refusé', 'éditeur de R1 : inventaire R2 refusé');
select is(tests.essai('ed2', $$ select mouvement_article(tests.id('A2'), tests.id('R2'), 'consommation', 1) + 1 $$), 'autorisé', 'éditeur de R2 : consommation R2 autorisée');
select is(tests.essai('com1', $$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', 1) $$), 'refusé', 'commentateur : livraison refusée');
select is(tests.essai('com1', $$ select inventaire_article(tests.id('A1'), tests.id('R1'), 9) + 1 $$), 'refusé', 'commentateur : inventaire refusé');
select is(tests.essai('lec1', $$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 1) + 1 $$), 'refusé', 'lecteur : consommation refusée');
select is(tests.essai('lec1', $$ select 1 from (select regler_seuil_article(tests.id('A1'), tests.id('R1'), 9)) s $$), 'refusé', 'lecteur : seuil refusé');
select is(tests.essai('anon', $$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'livraison', 1) $$), 'refusé', 'anonyme : livraison refusée');
select is(tests.essai('anon', $$ select 1 from (select transferer_article(tests.id('A1'), tests.id('R1'), tests.id('R2'), 1)) s $$), 'refusé', 'anonyme : transfert refusé');

-- Fonctions internes : non appelables directement.
select is(tests.essai('prop', $$ select 1 from (select alerte_article_bas(tests.id('A1'), tests.id('R1'), 5, 0, 5)) s $$),
          'refusé', 'propriétaire : fonction interne d''alerte non appelable (fausses alertes impossibles)');
select is(tests.essai('ed1', $$ select length(consommable_controle(tests.id('A1'), tests.id('R1'))) $$),
          'refusé', 'éditeur : fonction interne de contrôle non appelable');

-- ------------------------------------------------------------
-- Droits : lecture limitée aux restaurants accessibles
-- ------------------------------------------------------------
select is(tests.essai('ed1', $$ select count(*) from article_stocks where restaurant_id = tests.id('R1') $$), 'autorisé', 'éditeur de R1 : voit le stock de R1');
select is(tests.essai('ed1', $$ select count(*) from article_stocks where restaurant_id = tests.id('R2') $$), 'refusé', 'éditeur de R1 : ne voit pas le stock de R2');
select is(tests.essai('lec1', $$ select count(*) from article_stocks where restaurant_id = tests.id('R1') $$), 'autorisé', 'lecteur de R1 : voit le stock de R1');
select is(tests.essai('lec1', $$ select count(*) from article_mouvements where restaurant_id = tests.id('R2') $$), 'refusé', 'lecteur de R1 : ne voit pas l''historique de R2');
select is(tests.essai('com2', $$ select count(*) from article_mouvements where restaurant_id = tests.id('R2') $$), 'autorisé', 'commentateur de R2 : voit l''historique de R2');
select is(tests.essai('prop', $$ select count(*) from article_stocks where restaurant_id = tests.id('R2') $$), 'autorisé', 'propriétaire : voit tous les restaurants');
select is(tests.essai('lec2', $$ select count(*) from articles where code like 'TST-%' $$), 'autorisé', 'lecteur : voit le catalogue commun');
select is(tests.essai('anon', $$ select count(*) from articles $$), 'refusé', 'anonyme : aucun accès au catalogue');
select is(tests.essai('anon', $$ select count(*) from article_stocks $$), 'refusé', 'anonyme : aucun accès au stock');

-- ------------------------------------------------------------
-- Droits : aucune écriture directe des quantités ni de l'historique
-- ------------------------------------------------------------
select is(tests.essai('prop', $$ with t as (update article_stocks set quantity = 999 returning 1) select count(*) from t $$),
          'refusé', 'propriétaire : modification directe d''une quantité refusée');
select is(tests.essai('prop', $$ with t as (insert into article_stocks (article_id, restaurant_id, quantity) values (tests.id('A3'), tests.id('R2'), 50) returning 1) select count(*) from t $$),
          'refusé', 'propriétaire : création directe d''une ligne de stock refusée');
select is(tests.essai('prop', $$ with t as (insert into article_mouvements (article_id, restaurant_id, delta, raison) values (tests.id('A1'), tests.id('R1'), 5, 'livraison') returning 1) select count(*) from t $$),
          'refusé', 'propriétaire : insertion directe d''un mouvement refusée');
select is(tests.essai('ed1', $$ with t as (delete from article_mouvements returning 1) select count(*) from t $$),
          'refusé', 'éditeur : suppression de l''historique refusée');

-- ------------------------------------------------------------
-- Catalogue : création, modification, suppression
-- ------------------------------------------------------------
select is(tests.essai('ed1', $$ with t as (insert into articles (code, name, famille) values ('TST-NEW', 'Serviette test', 'jetable') returning 1) select count(*) from t $$),
          'autorisé', 'éditeur : création d''article autorisée');
select is(tests.essai('com1', $$ with t as (insert into articles (code, name, famille) values ('TST-NEW', 'Serviette test', 'jetable') returning 1) select count(*) from t $$),
          'refusé', 'commentateur : création d''article refusée');
select is(tests.essai('lec1', $$ with t as (update articles set name = 'X' where id = tests.id('A1') returning 1) select count(*) from t $$),
          'refusé', 'lecteur : modification d''article refusée');
select is(tests.essai('ed1', $$ with t as (update articles set default_threshold = 3 where id = tests.id('A1') returning 1) select count(*) from t $$),
          'autorisé', 'éditeur : modification d''article autorisée');
select is(tests.essai('ed1', $$ with t as (insert into articles (code, name, famille) values ('tst-min', 'Minuscules', 'jetable') returning 1) select count(*) from t $$),
          'erreur 23514 : new row for relation "articles" violates check constraint "articles_code_check"', 'code en minuscules refusé');
select is(tests.essai('ed1', $$ with t as (insert into articles (code, name, famille, unit) values ('TST-U', 'Unité test', 'jetable', 'tonne') returning 1) select count(*) from t $$),
          'erreur 23514 : new row for relation "articles" violates check constraint "articles_unit_check"', 'unité hors liste refusée');
select is(tests.essai('ed1', $$ with t as (insert into articles (code, name, famille) values ('TST-DBL', '  gobelet TEST ', 'jetable') returning 1) select count(*) from t $$),
          'erreur 23505 : duplicate key value violates unique constraint "articles_nom_unique"', 'désignation déjà prise (casse, espaces) refusée');
select is(tests.essai('ed1', $$ with t as (delete from articles where id = tests.id('A3') returning 1) select count(*) from t $$),
          'refusé', 'éditeur : suppression d''article refusée');
select matches(tests.essai('prop', $$ with t as (delete from articles where id = tests.id('A1') returning 1) select count(*) from t $$),
               '^erreur 23503', 'propriétaire : suppression d''un article qui a un historique refusée');
insert into articles (id, code, name, famille) values (gen_random_uuid(), 'TST-VIDE', 'Article sans historique', 'boisson');
select is(tests.essai('prop', $$ with t as (delete from articles where code = 'TST-VIDE' returning 1) select count(*) from t $$),
          'autorisé', 'propriétaire : suppression d''un article sans historique autorisée');

-- ------------------------------------------------------------
-- Invariant final : quantité = somme des mouvements, partout.
-- ------------------------------------------------------------
select is((select count(*)::int from article_stocks s
           where s.quantity <> (select coalesce(sum(m.delta), 0) from article_mouvements m
                                where m.article_id = s.article_id and m.restaurant_id = s.restaurant_id)),
          0, 'toutes les lignes : quantité = somme des mouvements');

select * from finish();
rollback;
