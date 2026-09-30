-- 9. Catégories (phase 5) : droits par rôle, suppression refusée si des machines
-- l'utilisent (même dans un autre restaurant), unicité du nom et du code, colonne icon,
-- création à la volée depuis le formulaire équipement.
begin;
\ir _fixture.sql
select * from no_plan();

-- Colonne icon : présente, remplie pour les catégories d'origine.
select has_column('public', 'categories', 'icon', 'categories.icon existe');
select is((select string_agg(code || '=' || icon, ' ' order by code) from categories
           where code in ('BOI', 'CLI', 'CUI', 'REF', 'VEN', 'VIT')),
          'BOI=snow CLI=wind CUI=flame REF=fridge VEN=hood VIT=fridge',
          'icônes des 6 catégories d''origine reprises du repère par code');

-- Données : une catégorie libre (TCL) et une utilisée par E2 (machine de R2).
insert into tests.ids (nom) values ('CL'), ('CU');
insert into categories (id, name, code) values
  (tests.id('CL'), 'Test libre', 'TCL'),
  (tests.id('CU'), 'Test utilisée', 'TCU');
update equipments set category_id = tests.id('CU') where id = tests.id('E2');

-- Droits : ajouter, modifier (nom, code, icône), supprimer une catégorie libre.
create temp table actions_cat (ordre int, action text, sql text);
insert into actions_cat values
 (1, 'ajouter une catégorie', $$with t as (insert into categories (name, code, icon) values ('Nouvelle test', 'TNX', 'bolt') returning 1) select count(*) from t$$),
 (2, 'modifier une catégorie', $$with t as (update categories set name = 'Renommée', code = 'TRN', icon = 'box' where id = tests.id('CL') returning 1) select count(*) from t$$),
 (3, 'supprimer une catégorie sans machine', $$with t as (delete from categories where id = tests.id('CL') returning 1) select count(*) from t$$);
grant select on actions_cat to authenticated, anon;

select is(tests.essai(ac.acteur, a.sql),
          case when ac.acteur in ('prop1', 'ed1') then 'autorisé' else 'refusé' end,
          ac.acteur || ' | ' || a.action)
from actions_cat a
cross join (values ('prop1'), ('ed1'), ('com1'), ('lec1'), ('anon')) as ac(acteur)
order by a.ordre, ac.acteur;

-- Suppression refusée si une machine l'utilise, y compris pour le propriétaire, et pour un
-- éditeur qui ne voit pas cette machine (E2 est dans R2, ed1 est sur R1).
select tests.se_connecter('ed1');
select throws_ok($$ delete from categories where id = tests.id('CU') $$, '23503', null,
                 'éditeur : suppression refusée, catégorie utilisée par une machine d''un autre restaurant');
select tests.se_deconnecter();
select tests.se_connecter('prop1');
select throws_ok($$ delete from categories where id = tests.id('CU') $$, '23503', null,
                 'propriétaire : suppression refusée, catégorie utilisée');
select tests.se_deconnecter();
select is((select category_id from equipments where id = tests.id('E2')), tests.id('CU'),
          'la machine garde sa catégorie');

-- Unicité et format.
select tests.se_connecter('ed1');
select throws_ok($$ insert into categories (name, code) values ('TEST LIBRE', 'TZZ') $$, '23505', null,
                 'nom déjà pris (sans tenir compte des majuscules) refusé');
select throws_ok($$ insert into categories (name, code) values ('Autre test', 'TCU') $$, '23505', null,
                 'code déjà pris refusé');
select throws_ok($$ update categories set code = 'ab' where id = tests.id('CL') $$, '23514', null,
                 'code hors format refusé');
select throws_ok($$ insert into categories (name, code) values ('   ', 'TVV') $$, '23514', null,
                 'nom vide refusé');

-- Changer le code d'une catégorie ne renomme pas les machines existantes.
update categories set code = 'TUU' where id = tests.id('CU');
select tests.se_deconnecter();
select is((select code from equipments where id = tests.id('E2')), 'TSTB-FRI-01',
          'changer le code de la catégorie ne touche pas au code de la machine');

-- Création à la volée depuis le formulaire équipement : toujours possible, icône vide.
select tests.se_connecter('ed1');
select isnt(enregistrer_equipement(null, tests.id('R1'), 'Machine test', null, 'operationnel',
                                   null, 'Friteuses test'), null,
            'création à la volée : l''équipement est enregistré');
select tests.se_deconnecter();
select is((select code || ' ' || coalesce(icon, 'sans icône') from categories where name = 'Friteuses test'),
          'FRI sans icône', 'création à la volée : code proposé, icône vide');

select * from finish();
rollback;
