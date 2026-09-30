-- 4. Matrice des droits : chaque rôle contre chaque action, sur son restaurant (R1) et sur
-- un autre (R2), vérifiée en base (RLS et fonctions), en simulant l'utilisateur connecté
-- (role authenticated + request.jwt.claims). Chaque essai est annulé (sous-transaction).
-- Acteurs : prop1 (propriétaire, donc tous les restaurants depuis la recette S-M2), ed1, com1, lec1 (sur R1).
-- prop1 est donc autorisé aussi sur R2 pour les actions de son rôle.
-- Refus = erreur 42501 / P0002 ou 0 ligne visible / modifiée (filtrage RLS).
begin;
\ir _fixture.sql
select * from no_plan();

-- Une notification d'un autre utilisateur, pour vérifier qu'on ne la voit pas.
insert into notifications (user_id, type, title) values (tests.id('prop'), 'panne', 'Notification de prop');

-- Actions limitées à un restaurant. {E} machine sans historique (E3 / E2), {EP} machine avec
-- plan (E1 / E2), {I} intervention ouverte (I1 / I2), {R} restaurant (R1 / R2).
create temp table actions (ordre int, action text, sql text, roles_autorises text[]);
insert into actions values
 (1,  'voir une machine',                     $$select count(*) from equipments where id = {E}$$, '{prop1,ed1,com1,lec1}'),
 (2,  'voir une intervention',                $$select count(*) from interventions where id = {I}$$, '{prop1,ed1,com1,lec1}'),
 (3,  'voir la fiche de vie',                 $$select count(*) from maintenance_plans where equipment_id = {EP}$$, '{prop1,ed1,com1,lec1}'),
 (4,  'créer une machine (fonction)',         $$select 1 from (select enregistrer_equipement(null, {R}, 'Machine test', null, 'operationnel')) s$$, '{prop1,ed1}'),
 (5,  'créer une machine (insert direct)',    $$with t as (insert into equipments (restaurant_id, code, name) values ({R}, 'TST-DIRECT-01', 'Directe') returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (6,  'modifier une machine (fonction)',      $$select 1 from (select enregistrer_equipement({E}, {R}, 'Renommée', null, 'operationnel')) s$$, '{prop1,ed1}'),
 (7,  'modifier une machine (update direct)', $$with t as (update equipments set notes = 'x' where id = {E} returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (8,  'supprimer une machine',                $$with t as (delete from equipments where id = {E} returning 1) select count(*) from t$$, '{prop1}'),
 (9,  'modifier le plan d''entretien',        $$with t as (update maintenance_plans set task = 'x' where equipment_id = {EP} returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (10, 'lier une pièce à une machine',         $$with t as (insert into part_compatibilities (part_id, equipment_id) values (tests.id('P2'), {E}) returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (11, 'déclarer une panne',                   $$select 1 from (select declarer_panne({E})) s$$, '{prop1,ed1,com1,lec1}'),
 (12, 'déclarer une panne (machine libre)',   $$select 1 from (select declarer_panne(null, 'urgence', '{}', null, null, {R}, 'Machine libre')) s$$, '{prop1,ed1,com1,lec1}'),
 (13, 'modifier une intervention ouverte',    $$with t as (update interventions set work_done = 'x' where id = {I} returning 1) select count(*) from t$$, '{prop1,ed1,com1}'),
 (14, 'clôturer une intervention',            $$select 1 from (select cloturer_intervention({I}, 'ok', 'operationnel')) s$$, '{prop1,ed1,com1}'),
 (15, 'clôturer en direct (update status)',   $$with t as (update interventions set status = 'terminee' where id = {I} returning 1) select count(*) from t$$, '{}'),
 (16, 'noter un entretien',                   $$select 1 from (select noter_entretien_fait({EP})) s$$, '{prop1,ed1,com1}'),
 (17, 'modifier le restaurant',               $$with t as (update restaurants set address = 'x' where id = {R} returning 1) select count(*) from t$$, '{prop1}'),
 (18, 'ajouter un restaurant en copiant',     $$select 1 from (select ajouter_restaurant('Copie', 'TSTZ', null, {R})) s$$, '{prop1}'),
 (19, 'voir les comptes du restaurant',       $$select count(*) from users where id = (select user_id from user_restaurants where restaurant_id = {R} and user_id <> auth.uid() limit 1)$$, '{prop1,ed1,com1,lec1}'),
 (20, 'changer le statut (fonction)',         $$select 1 from (select changer_statut_intervention({I}, 'en_attente_piece')) s$$, '{prop1,ed1,com1}'),
 (21, 'changer le statut en direct',          $$with t as (update interventions set status = 'en_attente_piece' where id = {I} returning 1) select count(*) from t$$, '{}');

create temp table portees (portee text, e text, ep text, i text, r text);
insert into portees values ('son restaurant', 'E3', 'E1', 'I1', 'R1'), ('autre restaurant', 'E2', 'E2', 'I2', 'R2');

create temp table acteurs (ordre int, acteur text);
insert into acteurs values (1, 'prop1'), (2, 'ed1'), (3, 'com1'), (4, 'lec1');
grant select on actions, portees, acteurs to authenticated, anon;

select is(
  tests.essai(ac.acteur, replace(replace(replace(replace(a.sql,
      '{EP}', format('tests.id(%L)', p.ep)), '{E}', format('tests.id(%L)', p.e)),
      '{I}', format('tests.id(%L)', p.i)), '{R}', format('tests.id(%L)', p.r))),
  case when (p.portee = 'son restaurant' or ac.acteur = 'prop1') and ac.acteur = any(a.roles_autorises) then 'autorisé' else 'refusé' end,
  ac.acteur || ' | ' || a.action || ' | ' || p.portee)
from actions a cross join portees p cross join acteurs ac
order by a.ordre, p.portee desc, ac.ordre;

-- Actions globales (stock partagé, comptes, notifications, tâches)
create temp table actions_globales (ordre int, action text, sql text, roles_autorises text[]);
insert into actions_globales values
 (1,  'voir le stock',                        $$select count(*) from parts where id = tests.id('P1')$$, '{prop1,ed1,com1,lec1}'),
 (2,  'mouvement de stock',                   $$select 1 from (select mouvement_stock(tests.id('P1'), 1, 'livraison')) s$$, '{prop1,ed1}'),
 (3,  'créer une pièce (quantité 0)',         $$with t as (insert into parts (code, name) values ('TST-NEW-99', 'Neuve') returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (4,  'modifier une pièce (seuil)',           $$with t as (update parts set min_threshold = 2 where id = tests.id('P1') returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (5,  'supprimer une pièce',                  $$with t as (delete from parts where id = tests.id('P2') returning 1) select count(*) from t$$, '{prop1}'),
 (6,  'insérer un mouvement en direct',       $$with t as (insert into stock_movements (part_id, delta, reason) values (tests.id('P1'), 5, 'livraison') returning 1) select count(*) from t$$, '{}'),
 (7,  'créer une catégorie',                  $$with t as (insert into categories (name, code) values ('Cat test', 'ZZT') returning 1) select count(*) from t$$, '{prop1,ed1}'),
 (8,  'ajouter un restaurant (fonction)',     $$select 1 from (select ajouter_restaurant('Nouveau', 'TSTN')) s$$, '{prop1}'),
 (9,  'changer son propre rôle',              $$with t as (update users set role = 'proprietaire', all_restaurants = true where id = auth.uid() returning 1) select count(*) from t$$, '{}'),
 (10, 'modifier un autre compte',             $$with t as (update users set first_name = 'x' where id <> auth.uid() returning 1) select count(*) from t$$, '{}'),
 (11, 'créer un profil de compte',            $$with t as (insert into users (id, email, role) values (tests.id('R1'), 'x@test.local', 'proprietaire') returning 1) select count(*) from t$$, '{}'),
 (12, 's''ajouter un restaurant',             $$with t as (insert into user_restaurants (user_id, restaurant_id) values (auth.uid(), tests.id('R2')) returning 1) select count(*) from t$$, '{}'),
 (13, 'retirer l''accès d''un collègue',      $$with t as (delete from user_restaurants where user_id <> auth.uid() returning 1) select count(*) from t$$, '{}'),
 (14, 'voir un compte d''un autre restaurant',$$select count(*) from users where id = tests.id('lec2')$$, '{prop1}'),
 (15, 'créer une notification',               $$with t as (insert into notifications (user_id, type, title) values (auth.uid(), 'panne', 'x') returning 1) select count(*) from t$$, '{}'),
 (16, 'lire les notifications d''un autre',   $$select count(*) from notifications where user_id = tests.id('prop')$$, '{}'),
 (17, 'lancer la tâche quotidienne',          $$select 1 from (select taches_quotidiennes()) s$$, '{}'),
 (18, 'écrire le journal d''entretien',       $$with t as (insert into maintenance_logs (equipment_id, done_at) values (tests.id('E1'), current_date) returning 1) select count(*) from t$$, '{}'),
 (19, 'écrire la fiche de vie',               $$with t as (insert into equipment_events (equipment_id, type, summary) values (tests.id('E1'), 'entretien', 'x') returning 1) select count(*) from t$$, '{}'),
 (20, 'régler les alertes d''un autre',       $$with t as (insert into notification_settings (user_id, type, enabled) values (tests.id('prop'), 'panne', false) returning 1) select count(*) from t$$, '{}');
grant select on actions_globales to authenticated, anon;

select is(tests.essai(ac.acteur, a.sql),
          case when ac.acteur = any(a.roles_autorises) then 'autorisé' else 'refusé' end,
          ac.acteur || ' | ' || a.action || ' | global')
from actions_globales a cross join acteurs ac
order by a.ordre, ac.ordre;

-- Anonyme (clé publique sans connexion) : aucune lecture, aucune action.
select is(tests.essai('anon', sql), 'refusé', 'anonyme | ' || action)
from (values
  ('voir une machine', $$select count(*) from equipments$$),
  ('voir le stock', $$select count(*) from parts$$),
  ('voir les restaurants', $$select count(*) from restaurants$$),
  ('déclarer une panne', $$select 1 from (select declarer_panne(tests.id('E1'))) s$$),
  ('clôturer', $$select 1 from (select cloturer_intervention(tests.id('I1'), 'x', 'operationnel')) s$$),
  ('mouvement de stock', $$select 1 from (select mouvement_stock(tests.id('P1'), 1)) s$$),
  ('ajouter un restaurant', $$select 1 from (select ajouter_restaurant('Anon', 'TSTX')) s$$),
  ('code machine', $$select count(c) from (select prochain_code_equipement(tests.id('R1'), null) c) s$$)
) as v(action, sql);

-- Propriétaire « tous les restaurants » : accès aux deux restaurants.
select is(tests.essai('prop', $$select count(*) from equipments where restaurant_id in (tests.id('R1'), tests.id('R2'))$$), 'autorisé',
          'prop (tous restaurants) | voir les machines de R1 et R2');
select is(tests.essai('prop', $$with t as (delete from equipments where id = tests.id('E2') returning 1) select count(*) from t$$), 'autorisé',
          'prop (tous restaurants) | supprimer une machine de R2');
select is(tests.essai('prop', $$select 1 from (select cloturer_intervention(tests.id('I2'), 'ok', 'operationnel')) s$$), 'autorisé',
          'prop (tous restaurants) | clôturer une intervention de R2');

-- Recette lot 3 : un compte Auth sans profil (pas de ligne dans users) ne lit rien.
insert into tests.ids (nom) values ('sansprofil');
select is(tests.essai('sansprofil', sql), 'refusé', 'compte sans profil | ' || action)
from (values
  ('voir le stock', $$select count(*) from parts$$),
  ('voir les mouvements de stock', $$select count(*) from stock_movements$$),
  ('voir les catégories', $$select count(*) from categories$$),
  ('voir les marques', $$select count(*) from brands$$),
  ('voir les liens pièce-machine', $$select count(*) from part_compatibilities$$),
  ('voir une machine', $$select count(*) from equipments$$)
) as v(action, sql);

select * from finish();
rollback;
