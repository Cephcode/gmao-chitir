#!/usr/bin/env bash
# Suite de recette GMAO : scénarios SQL (pgTAP, base LOCALE uniquement) + règles pures (node --test).
# Usage : bash supabase/tests/run.sh           (tout)
#         bash supabase/tests/run.sh 01_stock  (un seul scénario SQL, sans node ni concurrence)
# Chaque scénario SQL tourne dans une transaction annulée (ROLLBACK) : aucune donnée ne reste,
# et le trigger trg_notifications_envoi (pg_net) n'envoie rien. Le test de concurrence
# (concurrence.sh) valide des données de test marquées puis les supprime.
set -uo pipefail

CONTAINER="${GMAO_DB_CONTAINER:-supabase_db_gmao-chitir}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -X -q -At -v ON_ERROR_STOP=1)

# Garde-fou : on ne travaille que sur le conteneur Docker local.
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Conteneur local $CONTAINER introuvable : lancez 'supabase start'." >&2
  exit 2
fi

total_ok=0; total_ko=0; declare -a lignes
docker exec "$CONTAINER" rm -rf /tmp/gmao-tests
docker cp "$HERE" "$CONTAINER:/tmp/gmao-tests" >/dev/null

run_sql() {
  local f="$1" out ok ko
  out="$("${PSQL[@]}" -f "/tmp/gmao-tests/$f.sql" 2>&1)"
  ok=$(grep -cE '^ok [0-9]+' <<<"$out")
  ko=$(grep -cE '^not ok [0-9]+' <<<"$out")
  if grep -qE '^(psql:|ERROR|ERREUR)' <<<"$out"; then
    ko=$((ko + 1))
    echo "$out" | grep -E '^(psql:|ERROR|ERREUR)' | sed "s/^/  [$f] /"
  fi
  echo "$out" | awk '/^not ok/ {p = 1; print; next} p && /^#/ {print; next} {p = 0}' | sed "s/^/  [$f] /"
  total_ok=$((total_ok + ok)); total_ko=$((total_ko + ko))
  lignes+=("$(printf '%-18s %4d réussis %4d échoués' "$f" "$ok" "$ko")")
}

if [[ $# -gt 0 ]]; then
  # Nom d'un scénario existant seulement (lettres, chiffres, _) : pas de chemin arbitraire.
  if [[ ! "$1" =~ ^[A-Za-z0-9_]+$ || ! -f "$HERE/$1.sql" ]]; then
    echo "Scénario inconnu : $1 (attendu : un nom de fichier de $HERE, sans .sql)" >&2
    exit 2
  fi
  run_sql "$1"
else
  for f in "$HERE"/[0-9]*.sql; do run_sql "$(basename "$f" .sql)"; done

  out="$(bash "$HERE/concurrence.sh" 2>&1)"
  ok=$(grep -cE '^ok ' <<<"$out"); ko=$(grep -cE '^not ok ' <<<"$out")
  echo "$out" | grep -E '^(not ok|ERREUR|ERROR|psql:)' | sed 's/^/  [concurrence] /'
  total_ok=$((total_ok + ok)); total_ko=$((total_ko + ko))
  lignes+=("$(printf '%-18s %4d réussis %4d échoués' concurrence "$ok" "$ko")")

  out="$(cd "$ROOT" && node --test --no-warnings --test-reporter=tap --import ./tests/register.mjs tests/*.test.ts 2>&1)"
  ok=$(grep -E '^# pass ' <<<"$out" | awk '{print $3}'); ko=$(grep -E '^# fail ' <<<"$out" | awk '{print $3}')
  echo "$out" | grep -E '^\s*not ok' -A12 | sed 's/^/  [node] /'
  total_ok=$((total_ok + ${ok:-0})); total_ko=$((total_ko + ${ko:-1}))
  lignes+=("$(printf '%-18s %4d réussis %4d échoués' "node --test" "${ok:-0}" "${ko:-1}")")
fi

# Contrôle : aucune requête pg_net en attente, aucune donnée de test restée en base.
reste="$("${PSQL[@]}" -c "select (select count(*) from net.http_request_queue) || ' requête(s) pg_net, '
  || (select count(*) from restaurants where short_code like 'TST%') || ' restaurant(s) de test, '
  || (select count(*) from auth.users where email like '%@test.local') || ' compte(s) de test'")"

echo
echo "== Bilan =="
printf '%s\n' "${lignes[@]}"
echo "TOTAL : $total_ok réussis, $total_ko échoués"
echo "Après la suite : $reste"
[[ $total_ko -eq 0 ]]
