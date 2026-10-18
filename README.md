# GMAO Chitir Chicken

Application web de **gestion de la maintenance** des restaurants Chitir Chicken : machines, pannes, interventions, entretiens, stock de pièces, stock des restaurants (consommables) et alertes (application, push, mail). Pensée d'abord pour le téléphone, installable sur l'écran d'accueil.

- Production : `https://gmao-chitir.vercel.app`
- Code : Next.js 16 (App Router) sur Vercel ; Supabase (Postgres, Auth, Storage, Edge Function) ; Firebase (push) ; Resend (mails).
- Tout le texte de l'application, du code et de la documentation est en français.

## Par où commencer

| Je veux… | Lire |
|---|---|
| **Débuter : comprendre comment tout marche (sans connaître Next.js), modifier ou ajouter un module** | [`docs/comprendre-le-projet.md`](docs/comprendre-le-projet.md) |
| Savoir où en est le projet et ce qu'il reste à faire (dont la remise au client) | [`docs/taches-restantes.md`](docs/taches-restantes.md) |
| Remettre le projet au client (transfert, compte propriétaire, mails) | [`docs/remise-client.md`](docs/remise-client.md) |
| Comprendre le code, trouver un fichier, faire une modification | [`docs/guide-developpeur.md`](docs/guide-developpeur.md) |
| Connaître les tables, fonctions SQL et droits | [`docs/base-de-donnees.md`](docs/base-de-donnees.md) |
| Installer, configurer, tester, déployer | [`docs/README.md`](docs/README.md) |
| Savoir pourquoi une décision a été prise | [`docs/journal-decisions.md`](docs/journal-decisions.md) |
| Présenter l'application au client | [`docs/guide-presentation-client.md`](docs/guide-presentation-client.md) |

## Démarrage rapide

Prérequis : Node 20 ou plus (24 conseillé), Docker, Supabase CLI, Vercel CLI.

```bash
npm install
supabase start                 # base locale dans Docker, toutes les migrations
bash supabase/tests/run.sh     # 801 tests au 2026-10-09, 0 échec attendu
npm run dev                    # http://localhost:3000
```

⚠️ `npm run dev` lit `.env.development.local`, qui pointe sur la **base hébergée** (vraies données). Pour travailler sur la base locale : [`docs/guide-developpeur.md`](docs/guide-developpeur.md), section 7.
Les variables nécessaires sont listées (sans valeurs) dans `.env.example`.

## Organisation

```
app/                  pages et actions serveur (Next.js)
components/           composants d'écran (app/) et briques (ui/)
lib/                  lecture des données, règles, libellés
supabase/migrations/  toute la base (tables, droits, fonctions, données de départ)
supabase/functions/   Edge Function d'envoi des notifications
supabase/tests/       tests SQL (pgTAP) et script run.sh
tests/                tests des règles pures (node --test)
scripts/              outils (variables Vercel, repérage des données)
docs/                 documentation
```

Branches : `staging` pour le travail, `main` pour la production (déployée par Vercel à chaque fusion).
