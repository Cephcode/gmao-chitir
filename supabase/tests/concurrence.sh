#!/usr/bin/env bash
# Concurrence (base LOCALE) : deux sessions psql simultanées.
#  1. deux clôtures d'interventions différentes sur la même pièce (stock 1) ;
#  2. deux clôtures de la même intervention ;
#  3. deux retraits de stock simultanés ;
#  4. deux ajouts de photo simultanés quand il ne reste qu'une place (limite par type).
# Deux sessions distinctes exigent des données validées (COMMIT) : elles sont marquées
# (restaurant TSTCC, compte concurrence@test.local, ids cccccccc-…) et supprimées à la fin,
# même en cas d'échec. Aucune notification n'est créée (pas de déclarant, seuil 0), donc
# le trigger pg_net n'appelle rien : c'est vérifié à la fin.
set -uo pipefail
CONTAINER="${GMAO_DB_CONTAINER:-supabase_db_gmao-chitir}"
psql_() { docker exec -i "$CONTAINER" psql -U postgres -X -q -At "$@"; }

R=cccccccc-0000-4000-8000-000000000001
U=cccccccc-0000-4000-8000-000000000002
E=cccccccc-0000-4000-8000-000000000004
P=cccccccc-0000-4000-8000-000000000005
I1=cccccccc-0000-4000-8000-000000000011
I2=cccccccc-0000-4000-8000-000000000012
I3=cccccccc-0000-4000-8000-000000000013
LOGIN="set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$U\",\"role\":\"authenticated\"}', true);"

n=0
check() { # check "description" "attendu" "obtenu"
  n=$((n + 1))
  if [[ "$2" == "$3" ]]; then echo "ok $n - $1"; else echo "not ok $n - $1"; echo "#   attendu : $2"; echo "#   obtenu  : $3"; fi
}

nettoyer() {
  psql_ <<SQL >/dev/null
begin;
delete from notifications where user_id = '$U';
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'photos' and name like '$R/%';
delete from stock_movements where part_id = '$P';
delete from intervention_parts where part_id = '$P';
delete from maintenance_logs where equipment_id = '$E';
delete from equipment_events where equipment_id = '$E';
delete from interventions where restaurant_id = '$R';
delete from equipments where id = '$E';
delete from parts where id = '$P';
delete from user_restaurants where user_id = '$U';
delete from users where id = '$U';
delete from auth.users where id = '$U';
delete from restaurants where id = '$R';
commit;
SQL
}
trap nettoyer EXIT
nettoyer

avant_net=$(psql_ -c "select count(*) from net.http_request_queue")
avant_notif=$(psql_ -c "select count(*) from notifications")

psql_ -v ON_ERROR_STOP=1 <<SQL >/dev/null
begin;
insert into restaurants (id, name, short_code) values ('$R', 'Concurrence', 'TSTCC');
insert into auth.users (id, email, aud, role) values ('$U', 'concurrence@test.local', 'authenticated', 'authenticated');
insert into users (id, first_name, email, role, must_change_password) values ('$U', 'Test', 'concurrence@test.local', 'editeur', false);
insert into user_restaurants values ('$U', '$R');
insert into equipments (id, restaurant_id, code, name) values ('$E', '$R', 'TSTCC-FRI-01', 'Friteuse concurrence');
insert into parts (id, code, name, quantity, min_threshold) values ('$P', 'TSTCC-FIL', 'Filtre concurrence', 1, 0);
insert into stock_movements (part_id, delta, reason) values ('$P', 1, 'livraison');
insert into interventions (id, equipment_id, restaurant_id, type) values
  ('$I1', '$E', '$R', 'normal'), ('$I2', '$E', '$R', 'normal'), ('$I3', '$E', '$R', 'normal');
commit;
SQL

# Lance A (qui garde ses verrous 3 s), puis B 1 s plus tard. Renvoie la sortie de B et sa durée.
duel() { # duel "sql A" "sql B"
  psql_ -v ON_ERROR_STOP=1 -c "begin; $LOGIN $1; select pg_sleep(3); commit;" >/dev/null 2>&1 &
  local pa=$!
  sleep 1
  local t0 t1
  t0=$(date +%s.%N)
  B_OUT=$(psql_ -c "begin; $LOGIN $2; commit;" 2>&1)
  t1=$(date +%s.%N)
  wait $pa
  B_ATTENTE=$(awk -v a="$t0" -v b="$t1" 'BEGIN { print (b - a >= 1.5) ? "oui" : "non" }')
}

PIECE="'[{\"part_id\":\"$P\",\"quantity\":1}]'::jsonb"

# 1. Deux clôtures, même pièce, stock 1
duel "select cloturer_intervention('$I1', 'A', 'operationnel', null, $PIECE)" \
     "select cloturer_intervention('$I2', 'B', 'operationnel', null, $PIECE)"
check "2 clôtures simultanées, même pièce : la 2e attend le verrou de la pièce" "oui" "$B_ATTENTE"
check "2 clôtures simultanées, même pièce : la 2e est refusée (stock insuffisant)" "1" "$(grep -c 'Stock insuffisant' <<<"$B_OUT")"
check "stock final 0, jamais négatif" "0" "$(psql_ -c "select quantity from parts where id = '$P'")"
check "quantité = somme des mouvements" "0" "$(psql_ -c "select sum(delta) from stock_movements where part_id = '$P'")"
check "une seule consommation enregistrée" "1" "$(psql_ -c "select count(*) from intervention_parts where part_id = '$P'")"
check "statuts : I1 terminée, I2 toujours ouverte" "terminee a_planifier" \
      "$(psql_ -c "select string_agg(status::text, ' ' order by id) from interventions where id in ('$I1', '$I2')")"

# 2. Deux clôtures de la même intervention
duel "select cloturer_intervention('$I3', 'A3', 'operationnel')" \
     "select cloturer_intervention('$I3', 'B3', 'en_maintenance')"
check "même intervention clôturée deux fois : la 2e attend" "oui" "$B_ATTENTE"
check "même intervention clôturée deux fois : la 2e est refusée (déjà clôturée)" "1" "$(grep -c 'déjà clôturée' <<<"$B_OUT")"
check "une seule réparation dans la fiche de vie de I3" "1" \
      "$(psql_ -c "select count(*) from equipment_events where ref_id = '$I3' and type = 'reparation'")"
check "un seul entretien journalisé pour I3" "A3" \
      "$(psql_ -c "select string_agg(notes, ',') from maintenance_logs where equipment_id = '$E' and notes like '%3'")"

# 3. Deux retraits simultanés (stock 2, retraits de 2 puis 1)
psql_ -v ON_ERROR_STOP=1 -c "begin; $LOGIN select mouvement_stock('$P', 2, 'livraison'); commit;" >/dev/null
duel "select mouvement_stock('$P', -2)" "select mouvement_stock('$P', -1)"
check "2 retraits simultanés : le 2e attend" "oui" "$B_ATTENTE"
check "2 retraits simultanés : le 2e est refusé (stock négatif)" "1" "$(grep -c 'ne peut pas être négatif' <<<"$B_OUT")"
check "stock final 0 = somme des mouvements" "0|0" \
      "$(psql_ -c "select quantity || '|' || (select sum(delta) from stock_movements where part_id = '$P') from parts where id = '$P'")"

# 4. Deux ajouts de photo « avant » simultanés sur I2 (ouverte) : 2 déjà enregistrées, limite 3.
ph() { echo "$R/$I2/0000000$1-0000-4000-8000-000000000000.jpg"; }
psql_ -v ON_ERROR_STOP=1 <<SQL >/dev/null
begin;
insert into storage.objects (bucket_id, name, owner_id)
select 'photos', '$R/$I2/0000000' || n || '-0000-4000-8000-000000000000.jpg', '$U' from generate_series(1, 4) n;
insert into intervention_photos (intervention_id, kind, storage_path, created_by)
values ('$I2', 'avant', '$(ph 1)', '$U'), ('$I2', 'avant', '$(ph 2)', '$U');
commit;
SQL
duel "select ajouter_photo_intervention('$I2', 'avant', '$(ph 3)')" \
     "select ajouter_photo_intervention('$I2', 'avant', '$(ph 4)')"
check "2 ajouts de photo simultanés, une place : le 2e attend le verrou" "oui" "$B_ATTENTE"
check "2 ajouts de photo simultanés, une place : le 2e est refusé (limite)" "1" "$(grep -c 'Limite atteinte' <<<"$B_OUT")"
check "3 photos « avant » au plus" "3" "$(psql_ -c "select count(*) from intervention_photos where intervention_id = '$I2' and kind = 'avant'")"

check "aucune notification créée par le test" "$avant_notif" "$(psql_ -c "select count(*) from notifications")"
check "aucun appel pg_net déclenché" "$avant_net" "$(psql_ -c "select count(*) from net.http_request_queue")"
