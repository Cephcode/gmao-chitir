#!/usr/bin/env bash
# Lance l'application sur la base LOCALE (supabase start), jamais sur la base hébergée.
# Les variables passées ici l'emportent sur celles de .env.development.local.
# Usage : bash scripts/dev-local.sh   (docs/formation/01-installer-son-poste.md)
set -euo pipefail
if ! status="$(supabase status -o env 2>/dev/null)"; then
  echo "Base locale arrêtée : lancez d'abord « supabase start »." >&2
  exit 1
fi
eval "$(grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=' <<<"$status")"
echo "Base locale : $API_URL"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
SUPABASE_SECRET_KEY="$SECRET_KEY" \
exec npm run dev
