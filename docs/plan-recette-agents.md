# Plan de recette par les agents

Objectif : tester l'application livrée sur `staging` (étapes 1 à 7), corriger ce qui doit l'être, puis documenter, avant la fusion dans `main`.
Les agents passent **l'un après l'autre**. Chacun écrit son rapport dans `docs/recette/`, le développeur le lit et donne son feu vert avant l'agent suivant.

## Règles communes à tous les agents

- **Base** : les tests tournent sur la base **locale** (Supabase dans Docker, toutes les migrations appliquées). La base hébergée contient les vraies données : lecture seule, jamais d'écriture de test.
- **Secrets** : on lit les noms des variables, jamais leurs valeurs.
- **Code** : seul `dev-principal` modifie le code de production, après accord du développeur, un commit par correction sur `staging`.
- **Rapports** : courts, en français, classés par gravité, avec pour chaque point le fichier et la ligne.
- **Contexte à jour** (prime sur les fiches d'agents quand elles divergent) :
  - Rôles : `proprietaire`, `editeur`, `commentateur` (le technicien), `lecteur`. Pas de rôle « Responsable technique » séparé (c'est un éditeur).
  - Connexion par e-mail uniquement (le téléphone a été abandonné).
  - Tâche quotidienne : fonction SQL `taches_quotidiennes()` planifiée par pg_cron à 7 h, pas de route cron HTTP.
  - Envoi des notifications : trigger `trg_notifications_envoi` (pg_net) vers l'Edge Function `envoyer-notification` (`verify_jwt = false`, protégée par la réservation `delivered_at`).
  - Décisions : `docs/journal-decisions.md`. Maquettes : `/home/bere/Bureau/Projets/gmao/webapp/maquettes/INDEX.md`.

## Ordre de passage

| # | Agent | Rôle dans la recette | Rapport | Modifie le code |
|---|---|---|---|---|
| 0 | `reduction-tokens` | Plan de lecture de la recette | dans la conversation | non |
| 1 | `test` | Tests des règles métier et des droits | `docs/recette/1-tests.md` | tests seulement |
| 2 | `cybersecurite` | Audit de sécurité | `docs/recette/2-securite.md` | non |
| 3 | `conformite-ui-ux` | Écarts avec les maquettes, accessibilité | `docs/recette/3-conformite.md` | non |
| 4 | `dev-principal` | Tri et corrections validées | `docs/recette/4-corrections.md` | oui, après accord |
| 5 | `test` puis `cybersecurite` | Contre-vérification des corrections | complète les rapports 1 et 2 | tests seulement |
| 6 | `documentation` | Commentaires, README, journal | `docs/README.md`, journal | commentaires et docs |
| 7 | `reduction-tokens` | Bilan des coûts | dans la conversation | non |
| 8 | Développeur | Recette finale, fusion `staging` vers `main` | | |

Pourquoi cet ordre : les tests d'abord (ils prouvent ce qui marche et ce qui casse), la sécurité ensuite (elle s'appuie sur la matrice des droits testée), l'UI après (les écarts visuels sont moins graves), une seule passe de corrections groupées, puis la documentation sur le code final pour ne pas la réécrire.

## 0. `reduction-tokens` : plan de lecture

Consigne : « Propose un plan de lecture pour la recette : fichiers et plages que chaque agent doit lire, en partant de `docs/plan-recette-agents.md`, `docs/journal-decisions.md` et de la liste des fichiers modifiés (`git diff --stat main..staging`). Quelques lignes. »

## 1. `test` : règles métier et droits

Consigne : « Lis `docs/plan-recette-agents.md` (règles communes). Écris et exécute des tests sur la base locale, dans `supabase/tests/` (scénarios SQL en transaction annulée, comptes de test créés dans le test) et, pour les règles pures, avec `node --test`. Rapport dans `docs/recette/1-tests.md` avec la sortie réelle des tests. »

À couvrir, par priorité :

1. **Stock** (non testé à la main par le développeur) : livraison (+), correction − / + (`mouvement_stock`), jamais négatif, pièce créée avec un stock initial (quantité = somme des mouvements), décrément à la clôture, alerte au franchissement du seuil une seule fois, deux clôtures simultanées sur la même pièce.
2. **Clôture** : dernier entretien = jour de clôture pour normal et urgence, inchangé pour une alerte, état de la machine, pièces, fiche de vie, notification au déclarant.
3. **Entretien** : échéance = dernier + fréquence, statut à jour ou en retard (jour même, sans plan, sans dernier entretien), « noter l'entretien », changement de fréquence.
4. **Matrice des droits** : chaque rôle contre chaque action (équipement, panne, clôture, stock, pièce, restaurant, comptes), sur son restaurant et sur un autre, refus vérifiés en base (RLS et fonctions) et pas seulement à l'écran.
5. **Délégation des comptes** : règles de `lib/admin-rules.ts` (éditeur limité à ses restaurants, jamais propriétaire ni « tous les restaurants », pas de changement de son propre rôle, toujours un propriétaire).
6. **Notifications** : bons destinataires selon le restaurant et les réglages, titres, `taches_quotidiennes()` rejouable sans doublon, réservation `delivered_at` (un seul envoi).
7. **Ajout de restaurant** avec copie : codes régénérés, sans historique.

Le parcours mobile (390 px) ne peut pas être automatisé sans navigateur de test : le lister comme vérification manuelle pour le développeur.

## 2. `cybersecurite` : audit

Consigne : « Lis `docs/plan-recette-agents.md` (règles communes, contexte à jour). Audite `staging` (`git diff main..staging`). Rapport classé critique, haute, moyenne, basse dans `docs/recette/2-securite.md`. »

Points à regarder en priorité :

- Toutes les fonctions `SECURITY DEFINER` (`supabase/migrations/`) : rôle, restaurant, `search_path`, droits `execute` (y compris `anon`).
- Actions serveur qui utilisent le client admin (`app/(app)/admin/actions.ts`, `app/(app)/notifications/actions.ts`) : l'acteur est relu en base avant toute écriture.
- Edge Function `envoyer-notification` sans jeton : risques résiduels (appels répétés, contenu des mails, lien interne seulement).
- `push_tokens` : un jeton peut-il être rattaché à un autre compte ?
- Mot de passe temporaire : génération, affichage unique, changement forcé.
- Redirections (`safeLink`), entrées non validées, XSS dans les mails (échappement).
- Secrets : rien dans le dépôt ni dans une variable `NEXT_PUBLIC`, fichiers `.env*` ignorés.
- Limitation des tentatives de connexion (réglage Supabase Auth).

## 3. `conformite-ui-ux` : maquettes et accessibilité

Consigne : « Lis `docs/plan-recette-agents.md`. Compare le code des écrans aux maquettes découpées (`INDEX.md`, puis `apercu.jpg`, `texte.txt`, sections utiles seulement). Rapport bloquant, à corriger, détail dans `docs/recette/3-conformite.md`. »

Écrans : tableau de bord, équipements (liste, fiche, formulaire), déclarer une panne (2 étapes, confirmation), interventions (liste, clôture), stock (liste, fiche pièce), notifications et Mes alertes, administration (comptes, restaurants), connexion.
Écarts déjà décidés, à ne pas signaler : commentaires retirés, photo de panne hors périmètre, code équipement `CTR2-REF-05` au lieu de `CTR2-FRG-06`, compte créé avec mot de passe temporaire au lieu d'une invitation par lien, téléphone retiré, « Nouvelle intervention » reportée.
L'agent lit le code (il ne voit pas l'écran) : il signale les points qu'il faut vérifier visuellement, le développeur confirme par des captures.

## 4. `dev-principal` : corrections

Consigne : « Lis les rapports 1 à 3. Fais un tableau unique dans `docs/recette/4-corrections.md` : point, gravité, correction proposée, effort. Présente-le au développeur et attends son accord. Puis corrige dans l'ordre : critique, haute, bloquant UI, reste validé. Un commit par correction sur `staging`. Toute migration est testée en local puis poussée après accord. »

## 5. Contre-vérification

- `test` : relance toute la suite, ajoute un test pour chaque bug corrigé, met à jour le rapport 1.
- `cybersecurite` : revérifie seulement les points corrigés, met à jour le rapport 2.

## 6. `documentation`

Consigne : « Lis `docs/plan-recette-agents.md`. Sur le code final de `staging` : vérifie que les commentaires sont vrais et complète ceux qui manquent (le pourquoi) ; écris `docs/README.md` ; mets à jour le journal. »

Contenu attendu du `docs/README.md` :

- Installation locale (Node, Docker, Supabase CLI, `npm run dev`, accès depuis le réseau local avec `allowedDevOrigins`).
- Variables d'environnement : noms seulement, rôle de chacune, côté Vercel ou côté secrets Supabase (Edge Function), piège du format (une valeur seule, sans guillemets ni virgule).
- Base de données : migrations, `supabase db push`, base locale pour les tests.
- Tâche quotidienne (pg_cron), envoi des notifications (trigger, Edge Function, mode test Resend), push (service worker, activation par appareil).
- Déploiement Vercel, sauvegardes Supabase, procédure pour passer Resend en envoi réel (domaine vérifié).
- Rôles et droits en une page.

## 7. `reduction-tokens` : bilan

Poste le plus coûteux de la recette et une économie concrète pour la suite.

## 8. Recette finale et fusion

Le développeur rejoue les parcours clés sur téléphone et ordinateur (liste manuelle du rapport 1), puis donne son feu vert. Alors seulement : fusion de `staging` dans `main`, et poussée vers GitHub si le développeur le demande.
