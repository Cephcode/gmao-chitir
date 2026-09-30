-- 10. Photos d'intervention (phase 4) : bucket privé, politiques de storage.objects
-- (restaurant du chemin, intervention de ce restaurant), table intervention_photos
-- (lecture, ajout par ajouter_photo_intervention, suppression), limite par type, rôles.
-- La concurrence (deux ajouts simultanés) est vérifiée dans concurrence.sh.
begin;
\ir _fixture.sql
select * from no_plan();

-- La suppression directe dans storage.objects est bloquée par Supabase (trigger
-- protect_delete) : on l'autorise pour ce scénario afin de tester la politique elle-même.
select set_config('storage.allow_delete_query', 'true', true);

-- I3 : intervention terminée de R1.
insert into tests.ids (nom) values ('I3');
insert into interventions (id, equipment_id, restaurant_id, type, status, kind, reported_by, closed_at)
values (tests.id('I3'), tests.id('E3'), tests.id('R1'), 'normal', 'terminee', 'correctif', tests.id('com1'), now());

-- Chemin d'objet : {restaurant}/{intervention}/{uuid}.jpg
create function tests.chemin(p_r text, p_i text, p_n int) returns text
language sql stable as $$
  select tests.id(p_r) || '/' || tests.id(p_i) || '/' || lpad(p_n::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'
$$;
grant execute on function tests.chemin(text, text, int) to authenticated, anon;

-- ---------- Bucket et limite ----------
select is((select public from storage.buckets where id = 'photos'), false, 'bucket photos privé');
select is((select file_size_limit from storage.buckets where id = 'photos'), 2097152::bigint, 'bucket : 2 Mo par fichier');
select is(photos_max_par_type(), 3, 'limite : 3 photos par type');
select has_column('public', 'interventions', 'photo_url', 'interventions.photo_url laissée en place');

-- ---------- storage.objects : ajout ----------
create temp table depots (ordre int, cas text, acteur text, chemin text, attendu text);
insert into depots values
 (1, 'son restaurant, son intervention', 'com1', tests.chemin('R1', 'I1', 1), 'autorisé'),
 (2, 'lecteur, son restaurant', 'lec1', tests.chemin('R1', 'I1', 2), 'autorisé'),
 (3, 'éditeur, son restaurant', 'ed1', tests.chemin('R1', 'I1', 3), 'autorisé'),
 (4, 'propriétaire, autre restaurant', 'prop', tests.chemin('R2', 'I2', 4), 'autorisé'),
 (5, 'autre restaurant', 'com1', tests.chemin('R2', 'I2', 5), 'refusé'),
 (6, 'intervention d''un autre restaurant sous son restaurant', 'com1', tests.chemin('R1', 'I2', 6), 'refusé'),
 (7, 'intervention d''un autre restaurant sous son restaurant (éditeur R2)', 'ed2', tests.chemin('R2', 'I1', 7), 'refusé'),
 (8, 'intervention inexistante', 'com1', tests.id('R1') || '/' || gen_random_uuid() || '/00000008-0000-4000-8000-000000000000.jpg', 'refusé'),
 (9, 'nom mal formé (png)', 'com1', replace(tests.chemin('R1', 'I1', 9), '.jpg', '.png'), 'refusé'),
 (10, 'nom mal formé (sous-dossier)', 'com1', tests.id('R1') || '/' || tests.id('I1') || '/x/a.jpg', 'refusé'),
 (11, 'anonyme', 'anon', tests.chemin('R1', 'I1', 11), 'refusé');
grant select on depots to authenticated, anon;

select is(tests.essai(acteur, format(
            $$with t as (insert into storage.objects (bucket_id, name, owner_id) values ('photos', %L, auth.uid()::text) returning 1) select count(*) from t$$,
            chemin)),
          attendu, 'storage insert | ' || acteur || ' | ' || cas)
from depots order by ordre;

-- Garde-fou quota : au plus 4 x 3 = 12 fichiers par dossier d'intervention.
insert into storage.objects (bucket_id, name, owner_id)
select 'photos', tests.chemin('R2', 'I2', 100 + g), tests.id('com2')::text from generate_series(1, 12) g;
select is(tests.essai('com2', format(
            $$with t as (insert into storage.objects (bucket_id, name, owner_id) values ('photos', %L, auth.uid()::text) returning 1) select count(*) from t$$,
            tests.chemin('R2', 'I2', 200))),
          'refusé', 'storage insert refusé au-delà de 12 fichiers dans le dossier');
delete from storage.objects where bucket_id = 'photos' and name like tests.id('R2') || '/%';

-- Objets de départ (déposés en tant que postgres, avec leur propriétaire).
insert into storage.objects (bucket_id, name, owner_id)
select 'photos', tests.chemin(r, i, n), tests.id(o)::text
from (values ('R1', 'I1', 21, 'lec1'), ('R1', 'I1', 22, 'com1'), ('R1', 'I1', 23, 'com1'),
             ('R1', 'I1', 24, 'com1'), ('R1', 'I1', 25, 'com1'),
             ('R1', 'I3', 31, 'com1'), ('R1', 'I3', 32, 'lec1'), ('R1', 'I1', 33, 'com1'),
             ('R2', 'I2', 41, 'com2')) as v(r, i, n, o);

-- ---------- storage.objects : lecture, modification, suppression ----------
select is(tests.essai('com1', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R1', 'I1', 21))),
          'autorisé', 'storage select | com1 voit une photo de R1');
select is(tests.essai('lec1', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R1', 'I1', 22))),
          'autorisé', 'storage select | lec1 voit une photo de R1');
select is(tests.essai('com2', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R1', 'I1', 21))),
          'refusé', 'storage select | com2 ne voit pas une photo de R1');
select is(tests.essai('ed1', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R2', 'I2', 41))),
          'refusé', 'storage select | ed1 ne voit pas une photo de R2');
select is(tests.essai('prop', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R2', 'I2', 41))),
          'autorisé', 'storage select | propriétaire voit tout');
select is(tests.essai('anon', format($$select count(*) from storage.objects where name = %L$$, tests.chemin('R1', 'I1', 21))),
          'refusé', 'storage select | anonyme refusé');
select is(tests.essai('ed1', format($$with t as (update storage.objects set metadata = '{}' where name = %L returning 1) select count(*) from t$$, tests.chemin('R1', 'I1', 21))),
          'refusé', 'storage update | refusé même pour l''éditeur (pas de remplacement)');

create temp table retraits (ordre int, acteur text, n int, attendu text);
insert into retraits values
 (1, 'lec1', 21, 'autorisé'),   -- son propre fichier
 (2, 'com1b', 21, 'refusé'),    -- commentateur, fichier d'un autre
 (3, 'lec1', 22, 'refusé'),     -- lecteur, fichier d'un autre
 (4, 'ed1', 21, 'autorisé'),    -- éditeur du restaurant
 (5, 'prop', 21, 'autorisé'),
 (6, 'ed2', 21, 'refusé'),      -- éditeur d'un autre restaurant
 (7, 'anon', 21, 'refusé');
grant select on retraits to authenticated, anon;
select is(tests.essai(acteur, format($$with t as (delete from storage.objects where name = %L returning 1) select count(*) from t$$,
                                     tests.chemin('R1', 'I1', n))),
          attendu, 'storage delete | ' || acteur || ' | fichier n° ' || n)
from retraits order by ordre;

-- ---------- intervention_photos : ajout par la fonction ----------
create temp table ajouts (ordre int, cas text, acteur text, sql text, attendu text);
insert into ajouts values
 (1, 'lecteur, avant, intervention ouverte', 'lec1',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I1'), 'avant', %L)) t$$, tests.chemin('R1', 'I1', 21)), 'autorisé'),
 (2, 'commentateur, avant, intervention ouverte', 'com1',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I1'), 'avant', %L)) t$$, tests.chemin('R1', 'I1', 22)), 'autorisé'),
 (3, 'lecteur, après, intervention terminée', 'lec1',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I3'), 'apres', %L)) t$$, tests.chemin('R1', 'I3', 31)), 'refusé'),
 (4, 'commentateur, après, intervention terminée', 'com1',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I3'), 'apres', %L)) t$$, tests.chemin('R1', 'I3', 31)), 'autorisé'),
 (5, 'éditeur, après, intervention terminée', 'ed1',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I3'), 'apres', %L)) t$$, tests.chemin('R1', 'I3', 31)), 'autorisé'),
 (6, 'autre restaurant', 'com2',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I1'), 'avant', %L)) t$$, tests.chemin('R1', 'I1', 21)), 'refusé'),
 (7, 'anonyme', 'anon',
  format($$select count(*) from (select ajouter_photo_intervention(tests.id('I1'), 'avant', %L)) t$$, tests.chemin('R1', 'I1', 21)), 'refusé'),
 (8, 'insertion directe dans la table', 'ed1',
  format($$with t as (insert into intervention_photos (intervention_id, kind, storage_path, created_by) values (tests.id('I1'), 'avant', %L, auth.uid()) returning 1) select count(*) from t$$, tests.chemin('R1', 'I1', 21)), 'refusé');
grant select on ajouts to authenticated, anon;
select is(tests.essai(acteur, sql), attendu, 'ajout photo | ' || acteur || ' | ' || cas) from ajouts order by ordre;

select tests.se_connecter('com1');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'apres', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 23)),
                 '22023', null, 'après refusée tant que l''intervention est ouverte');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I3'), tests.chemin('R1', 'I3', 32)),
                 '22023', null, 'avant refusée une fois l''intervention terminée');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I3', 32)),
                 '22023', null, 'chemin d''une autre intervention refusé');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 99)),
                 'P0002', null, 'fichier absent du bucket refusé');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'avant', null)$$, tests.id('I1')),
                 '22023', null, 'chemin vide refusé');

-- Limite : 3 photos « avant » sur I1, la 4e est refusée ; les « après » ont leur propre limite.
select lives_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 22)), 'avant n° 1');
select lives_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 23)), 'avant n° 2');
select lives_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 24)), 'avant n° 3');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 25)),
                 '23514', null, 'avant n° 4 refusée (limite 3)');
select lives_ok(format($$select ajouter_photo_intervention(%L, 'apres', %L)$$, tests.id('I3'), tests.chemin('R1', 'I3', 31)), 'après n° 1 sur I3 (limite propre aux « après »)');
select throws_ok(format($$select ajouter_photo_intervention(%L, 'apres', %L)$$, tests.id('I3'), tests.chemin('R1', 'I3', 31)),
                 '23505', null, 'même fichier enregistré deux fois refusé');
select tests.se_deconnecter();

-- Le lecteur ajoute une photo « avant » sur I3 ? Non : terminée. Sur I1 ? Non : limite atteinte.
select is(tests.essai('lec1', format($$select count(*) from (select ajouter_photo_intervention(tests.id('I1'), 'avant', %L)) t$$,
                                    tests.chemin('R1', 'I1', 21))),
          'erreur 23514 : Limite atteinte : 3 photos « avant » au plus par intervention',
          'limite atteinte : message clair');

-- ---------- intervention_photos : lecture ----------
select is(tests.essai('lec1', $$select count(*) from intervention_photos where intervention_id = tests.id('I1')$$),
          'autorisé', 'lecture | lec1 voit les photos de R1');
select is(tests.essai('com2', $$select count(*) from intervention_photos where intervention_id = tests.id('I1')$$),
          'refusé', 'lecture | com2 ne voit pas les photos de R1');
select is(tests.essai('anon', $$select count(*) from intervention_photos$$), 'refusé', 'lecture | anonyme refusé');
select is(tests.essai('com1', $$with t as (update intervention_photos set kind = 'apres' returning 1) select count(*) from t$$),
          'refusé', 'modification directe refusée');

-- ---------- intervention_photos : suppression ----------
-- Photo de com1 sur I1 (n° 22) et photo de lec1 (déposée par lec1, enregistrée ici).
update intervention_photos set created_by = tests.id('lec1') where storage_path = tests.chemin('R1', 'I1', 24);
create temp table suppressions (ordre int, acteur text, n int, attendu text);
insert into suppressions values
 (1, 'lec1', 24, 'autorisé'),   -- sa photo
 (2, 'lec1', 22, 'refusé'),     -- photo d'un autre
 (3, 'com1b', 22, 'refusé'),    -- commentateur, photo d'un autre
 (4, 'com1', 22, 'autorisé'),   -- sa photo
 (5, 'ed1', 22, 'autorisé'),
 (6, 'prop', 22, 'autorisé'),
 (7, 'ed2', 22, 'refusé'),
 (8, 'anon', 22, 'refusé');
grant select on suppressions to authenticated, anon;
select is(tests.essai(acteur, format($$with t as (delete from intervention_photos where storage_path = %L returning 1) select count(*) from t$$,
                                     tests.chemin('R1', 'I1', n))),
          attendu, 'suppression photo | ' || acteur || ' | photo n° ' || n)
from suppressions order by ordre;

-- Après une suppression, une place se libère.
delete from intervention_photos where storage_path = tests.chemin('R1', 'I1', 24);
select tests.se_connecter('com1');
select lives_ok(format($$select ajouter_photo_intervention(%L, 'avant', %L)$$, tests.id('I1'), tests.chemin('R1', 'I1', 25)),
                'place libérée : nouvel ajout accepté');
select tests.se_deconnecter();

-- Intervention supprimée : ses lignes partent en cascade (les fichiers restent, voir migration).
delete from interventions where id = tests.id('I1');
select is((select count(*) from intervention_photos where storage_path like tests.id('R1') || '/' || tests.id('I1') || '/%'),
          0::bigint, 'cascade : lignes supprimées avec l''intervention');

select * from finish();
rollback;
