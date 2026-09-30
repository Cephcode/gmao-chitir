#!/usr/bin/env bash
# Copie les variables de l'application Next (noms listés dans .env.example) vers Vercel.
# Les valeurs sont lues dans un fichier .env local et envoyées par l'entrée standard :
# elles ne sont jamais affichées ni passées en argument (invisibles dans la liste des processus).
#
# Usage (depuis gmao-chitir, après `vercel login` et `vercel link`) :
#   bash scripts/vercel-env.sh                     # environnement Preview
#   bash scripts/vercel-env.sh production,preview  # plusieurs environnements
#   ENV_FILE=.env.production.local bash scripts/vercel-env.sh production
#
# Chaque valeur est nettoyée (espaces, guillemets, virgule finale) : c'est le piège rencontré
# en collant la configuration Firebase depuis la console. Une variable existante est remplacée.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGETS="${1:-preview}"
ENV_FILE="${ENV_FILE:-.env.development.local}"
# Secrets serveur : stockés en « sensitive » (illisibles ensuite dans l'interface Vercel).
SENSITIVE="SUPABASE_SECRET_KEY"

# Lien avec le projet : project.json (ancien CLI) ou repo.json (CLI récent, lien par dépôt git).
[ -f .vercel/project.json ] || [ -f .vercel/repo.json ] || { echo "Projet non lié : lancez d'abord « vercel link »."; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Fichier $ENV_FILE introuvable."; exit 1; }

# Noms = lignes « NOM=… » non commentées de .env.example.
mapfile -t NAMES < <(grep -E '^[A-Z][A-Z0-9_]*=' .env.example | cut -d= -f1)

# Valeur d'une variable dans le fichier .env, nettoyée (dernière occurrence si doublon).
read_value() {
  local line
  line="$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)"
  [ -n "$line" ] || return 1
  local v="${line#*=}"
  v="$(printf '%s' "$v" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/,$//; s/[[:space:]]+$//')"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

ok=0; missing=()
for name in "${NAMES[@]}"; do
  if ! value="$(read_value "$name")" || [ -z "$value" ]; then
    missing+=("$name"); continue
  fi
  flag="--no-sensitive"
  [[ " $SENSITIVE " == *" $name "* ]] && flag="--sensitive"
  # Development n'accepte pas « sensitive » : on l'évite pour ce seul cas.
  [[ "$TARGETS" == *development* && "$flag" == "--sensitive" ]] && flag="--no-sensitive"
  if printf '%s' "$value" | vercel env add "$name" "$TARGETS" --force --yes "$flag" >/dev/null 2>&1; then
    echo "OK      $name → $TARGETS"
    ok=$((ok + 1))
  else
    echo "ÉCHEC   $name (relancez « vercel env add $name $TARGETS » pour voir l'erreur)"
  fi
done

echo "$ok variable(s) envoyée(s) vers : $TARGETS"
if [ ${#missing[@]} -gt 0 ]; then
  echo "Absentes ou vides dans $ENV_FILE : ${missing[*]}"
fi
echo "Pensez à redéployer (Deployments → Redeploy) : les NEXT_PUBLIC_ sont intégrées à la construction."
