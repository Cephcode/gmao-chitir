-- Jeu de données de test commun (inclus par chaque scénario avec \ir, après BEGIN).
-- Tout est créé dans la transaction du scénario, qui se termine par ROLLBACK :
-- rien ne reste en base, et le trigger trg_notifications_envoi (pg_net) n'envoie rien.
--
-- Restaurants : R1 (TSTA), R2 (TSTB).
-- Comptes : prop (propriétaire, tous restaurants), prop1 (propriétaire limité à R1),
--   ed1 / com1 / com1b / lec1 sur R1, ed2 / com2 / lec2 sur R2.
--   com1b a coupé l'alerte « panne », ed2 a coupé l'alerte « stock_bas ».
-- Équipements : E1 (R1, plan mensuel en retard), E2 (R2, plan trimestriel),
--   E3 (R1, sans plan), E4 (R1, hors service, plan en retard), E5 (R1, sans historique).
-- Pièces : P1 (10, seuil 5, va avec E1), P2 (3, seuil 0).
-- Interventions ouvertes : I1 (R1, E1, déclarée par lec1), I2 (R2, E2, déclarée par com2).

create extension if not exists pgtap with schema public;

create schema tests;
grant usage on schema tests to authenticated, anon;

create table tests.ids (nom text primary key, id uuid not null default gen_random_uuid());
grant select on tests.ids to authenticated, anon;
insert into tests.ids (nom) values
  ('R1'), ('R2'),
  ('prop'), ('prop1'), ('ed1'), ('ed2'), ('com1'), ('com1b'), ('com2'), ('lec1'), ('lec2'),
  ('E1'), ('E2'), ('E3'), ('E4'), ('E5'), ('P1'), ('P2'), ('I1'), ('I2');

create function tests.id(p text) returns uuid
language sql stable as $$ select id from tests.ids where nom = p $$;

-- Simule un utilisateur connecté (comme PostgREST) : rôle authenticated + JWT.
create function tests.se_connecter(p text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.anonyme() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create function tests.se_deconnecter() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Exécute p_sql en tant que p_user dans une sous-transaction toujours annulée.
-- p_sql renvoie un nombre : lignes visibles ou modifiées (0 = refus silencieux des RLS).
-- Résultat : 'autorisé', 'refusé' (0 ligne, erreur 42501 ou P0002) ou 'erreur CODE : message'.
create function tests.essai(p_user text, p_sql text) returns text
language plpgsql as $$
declare
  v_n bigint;
  v_res text;
begin
  begin
    if p_user = 'anon' then perform tests.anonyme(); else perform tests.se_connecter(p_user); end if;
    execute p_sql into v_n;
    v_res := case when coalesce(v_n, 0) > 0 then 'autorisé' else 'refusé' end;
    raise exception using errcode = 'TST01';
  exception
    when sqlstate 'TST01' then null;
    when insufficient_privilege then v_res := 'refusé';
    when no_data_found then v_res := 'refusé';  -- P0002 : « introuvable » (objet hors de portée)
    when others then v_res := 'erreur ' || sqlstate || ' : ' || sqlerrm;
  end;
  return v_res;
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- Restaurants
insert into restaurants (id, name, short_code) values
  (tests.id('R1'), 'Test A', 'TSTA'),
  (tests.id('R2'), 'Test B', 'TSTB');

-- Comptes (auth.users puis profil applicatif)
insert into auth.users (id, email, aud, role)
select id, nom || '@test.local', 'authenticated', 'authenticated'
from tests.ids where nom in ('prop', 'prop1', 'ed1', 'ed2', 'com1', 'com1b', 'com2', 'lec1', 'lec2');

insert into users (id, first_name, email, role, all_restaurants, must_change_password)
select tests.id(n), f, n || '@test.local', r::user_role, a, false
from (values
  ('prop', 'Prosper', 'proprietaire', true),
  ('prop1', 'Paul', 'proprietaire', true),  -- plus de propriétaire limité (recette S-M2)
  ('ed1', 'Eddy', 'editeur', false),
  ('ed2', 'Edith', 'editeur', false),
  ('com1', 'Awa', 'commentateur', false),
  ('com1b', 'Bako', 'commentateur', false),
  ('com2', 'Salif', 'commentateur', false),
  ('lec1', 'Lea', 'lecteur', false),
  ('lec2', 'Luc', 'lecteur', false)
) as v(n, f, r, a);

insert into user_restaurants (user_id, restaurant_id)
select tests.id(u), tests.id(r) from (values
  ('ed1', 'R1'), ('com1', 'R1'), ('com1b', 'R1'), ('lec1', 'R1'),
  ('ed2', 'R2'), ('com2', 'R2'), ('lec2', 'R2')
) as v(u, r);

insert into notification_settings (user_id, type, enabled) values
  (tests.id('com1b'), 'panne', false),
  (tests.id('ed2'), 'stock_bas', false);

-- Équipements
insert into equipments (id, restaurant_id, code, name, state, serial_number, installed_at, model) values
  (tests.id('E1'), tests.id('R1'), 'TSTA-FRI-01', 'Friteuse test', 'en_panne', 'SN-E1', '2024-01-10', 'F2P'),
  (tests.id('E2'), tests.id('R2'), 'TSTB-FRI-01', 'Friteuse B', 'en_panne', 'SN-E2', null, null),
  (tests.id('E3'), tests.id('R1'), 'TSTA-HOT-01', 'Hotte test', 'operationnel', null, null, null),
  (tests.id('E4'), tests.id('R1'), 'TSTA-FRG-01', 'Frigo HS', 'hors_service', null, null, null),
  (tests.id('E5'), tests.id('R1'), 'VIEUX-CODE', 'Machine sans préfixe', 'operationnel', null, null, null);

insert into maintenance_plans (equipment_id, task, frequency, last_done_at, next_due_at) values
  (tests.id('E1'), 'Vidanger l''huile', 'mensuel', current_date - 45, current_date - 15),
  (tests.id('E2'), 'Nettoyer', 'trimestriel', current_date - 10, current_date + 80),
  (tests.id('E4'), 'Dégivrer', 'mensuel', current_date - 35, current_date - 5);

-- Pièces : quantité = somme des mouvements dès le départ.
insert into parts (id, code, name, quantity, min_threshold) values
  (tests.id('P1'), 'TST-FIL-01', 'Filtre test', 10, 5),
  (tests.id('P2'), 'TST-JNT-01', 'Joint test', 3, 0);
insert into stock_movements (part_id, delta, reason) values
  (tests.id('P1'), 10, 'livraison'),
  (tests.id('P2'), 3, 'livraison');
insert into part_compatibilities (part_id, equipment_id) values (tests.id('P1'), tests.id('E1'));

-- Interventions ouvertes (insérées en direct : aucune notification)
insert into interventions (id, equipment_id, restaurant_id, type, status, kind, reported_by, description) values
  (tests.id('I1'), tests.id('E1'), tests.id('R1'), 'normal', 'en_cours', 'correctif', tests.id('lec1'), 'Ne chauffe pas'),
  (tests.id('I2'), tests.id('E2'), tests.id('R2'), 'normal', 'en_cours', 'correctif', tests.id('com2'), 'Fuite');
