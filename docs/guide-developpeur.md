# Guide du développeur : où faire quoi

Pour reprendre et modifier le projet seul, sans assistant.
Ce guide complète `docs/README.md`, qui décrit l'installation, les variables, les tests et le déploiement. Ici, on trouve la **carte du projet**, des **recettes** pour les modifications courantes et les **pièges** déjà rencontrés.

---

## 1. Comment l'application fonctionne

```
Téléphone / ordinateur (navigateur ou application installée)
        │  https
        ▼
Next.js 16 sur Vercel
  - pages (Server Components) : lisent la base avec les droits de l'utilisateur
  - actions serveur (actions.ts) : écrivent en base, après vérification
  - proxy.ts : vérifie la session à chaque requête
        │
        ▼
Supabase (Postgres + Auth + Storage + Edge Function)
  - RLS : chaque table filtre ce que l'utilisateur peut voir ou modifier
  - fonctions SQL (SECURITY DEFINER) : déclarer, clôturer, stock, statut, photos…
  - Storage : bucket privé « photos »
  - pg_cron : taches_quotidiennes() chaque jour à 7 h
        │  à chaque ligne ajoutée dans « notifications »
        ▼
trigger trg_notifications_envoi → pg_net → Edge Function envoyer-notification
  - push Firebase vers les appareils du destinataire
  - mail Resend (urgences et pannes seulement)
```

**Règle d'or : la sécurité est dans la base.** L'écran cache les boutons qu'un rôle ne peut pas utiliser, mais c'est la base (RLS et fonctions SQL) qui refuse vraiment. Une nouvelle règle de droits doit donc toujours être écrite **en base**, puis reflétée à l'écran.

---

## 2. Les services et leur rôle

| Service | À quoi il sert | Où le gérer |
|---|---|---|
| **GitHub** (`Cephcode/gmao-chitir`) | Le code. Branches `staging` (travail) et `main` (production) | github.com |
| **Vercel** (projet `gmao-chitir`) | Héberge l'application. `main` part en production, les autres branches donnent une adresse de prévisualisation | vercel.com : Deployments, Settings → Environment Variables, Logs |
| **Supabase** (projet GMAO-CHITIR, Europe) | Base de données, comptes, photos, Edge Function, tâche du matin | supabase.com : Table Editor, SQL Editor, Authentication, Storage, Edge Functions, Database → Cron |
| **Firebase** | Notifications push | console.firebase.google.com : Project settings, Cloud Messaging |
| **Resend** | Mails d'urgence et de panne | resend.com : API Keys, Domains, Emails (historique des envois) |

---

## 3. Carte du projet

| Dossier ou fichier | Contenu |
|---|---|
| `app/(app)/` | Toutes les pages après connexion. `layout.tsx` = garde de session et menu. Un dossier par écran : `equipements/`, `interventions/`, `panne/`, `stock/`, `notifications/`, `admin/` |
| `app/(app)/**/page.tsx` | Une page : lit les données et affiche les composants |
| `app/(app)/**/actions.ts` | Actions serveur : tout ce qui **écrit** (enregistrer, clôturer, créer un compte…) |
| `app/(app)/page.tsx` | Le tableau de bord |
| `app/(app)/error.tsx`, `loading.tsx` | Écrans d'erreur et de chargement |
| `app/connexion/`, `changer-mot-de-passe/`, `mot-de-passe-oublie/` | Pages accessibles sans session |
| `app/layout.tsx` | Page racine : polices, titre, métadonnées iPhone, viewport |
| `app/manifest.ts`, `app/apple-icon.png`, `public/icons/` | Application installable : nom et icônes |
| `app/firebase-messaging-sw.js/route.ts` | Service worker des push (généré avec la configuration Firebase) |
| `app/globals.css` | **Couleurs, polices, arrondis** (tokens dans `@theme`), squelette de chargement, règles globales |
| `components/ui/` | Briques réutilisables : `button`, `field` (champs et focus), `card`, `alert`, `combobox`, `segmented-control`, `status-badge` |
| `components/app/` | Composants des écrans, un dossier par écran. `nav.tsx` = menu latéral, barre du bas, bouton « Déclarer une panne » |
| `components/icons.tsx` | Toutes les icônes (tracés SVG 24×24) |
| `lib/` | Logique : lecture des données, règles, libellés (voir le tableau suivant) |
| `lib/supabase/` | Les 3 clients Supabase : `client.ts` (navigateur), `server.ts` (serveur, droits de l'utilisateur), `admin.ts` (clé secrète, serveur seulement), `middleware.ts` (session) |
| `proxy.ts` | L'ancien « middleware » (renommé en Next 16) : session, et fichiers exclus de la vérification |
| `supabase/migrations/` | **Toute la base** : tables, droits, fonctions, données de départ. Une migration = un fichier daté |
| `supabase/functions/envoyer-notification/` | L'Edge Function (Deno) qui envoie push et mails |
| `supabase/tests/` | Tests SQL (`run.sh` lance tout) |
| `supabase/config.toml` | Réglages de la base **locale** (inscription, Edge Function sans jeton…) |
| `tests/` | Tests des règles pures (`node --test`) |
| `scripts/vercel-env.sh` | Copie les variables d'environnement vers Vercel |
| `docs/` | Documentation, journal des décisions, plans, rapports de recette |

**Les fichiers de `lib/` :**

| Fichier | Contenu |
|---|---|
| `session.ts` | Profil de l'utilisateur connecté, compteurs du menu, libellés des rôles |
| `admin.ts`, `admin-rules.ts` | Qui peut administrer quoi (règles des comptes, testées) |
| `equipements.ts` | Lecture des machines, filtres, statut d'entretien (`maintenanceOf`), fréquences |
| `equipment-icon.ts` | Icône d'une machine selon sa catégorie |
| `categories.ts`, `categories-rules.ts` | Catégories : lecture, code proposé, liste des icônes au choix |
| `interventions.ts`, `intervention-status.ts` | Interventions : lecture, filtres, statuts et leurs libellés |
| `stock.ts` | Pièces et mouvements |
| `notifications.ts` | Types de notification, réglages « Mes alertes » (`SETTINGS`), styles, `safeLink` |
| `photos.ts`, `photos-browser.ts`, `photos-server.ts` | Photos : limites et règles, compression et envoi, liens signés |
| `firebase-client.ts`, `push-appareil.ts` | Push : jeton de l'appareil, activation, oubli à la déconnexion |
| `identifiant.ts`, `format.ts` | Normalisation des e-mails, formats de dates |

---

## 4. Le cycle d'une modification

1. **Travailler sur `staging`** : `git checkout staging`.
2. **Lancer en local** : `supabase start` (base locale dans Docker), puis `npm run dev`.
   ⚠️ `npm run dev` lit `.env.development.local`, qui pointe aujourd'hui sur la **base hébergée**. Pour travailler sur la base locale, remplacer temporairement `NEXT_PUBLIC_SUPABASE_URL` et les clés par celles qu'affiche `supabase status`.
3. **Si la base change** :
   - créer une migration : `supabase migration new mon_changement` (un fichier vide daté apparaît dans `supabase/migrations/`) ;
   - l'écrire (voir section 6), l'appliquer en local : `supabase migration up --local` ;
   - en cas d'erreur, tout recréer : `supabase db reset` (base locale seulement).
4. **Vérifier** :
   ```bash
   npx tsc --noEmit                 # types
   npx eslint app components lib    # style et erreurs courantes
   bash supabase/tests/run.sh       # tous les tests (base locale)
   ```
5. **Commiter** sur `staging`, puis `git push`. Vercel construit une **adresse de prévisualisation https** : tester dessus, sur téléphone.
6. **Base hébergée** : `supabase db push`, depuis `gmao-chitir` et sur la bonne branche. Vérifier avec `supabase migration list`.
7. **Edge Function modifiée ?** `supabase functions deploy envoyer-notification`.
8. **Production** : fusionner `staging` dans `main` (pull request sur GitHub). Vercel déploie tout seul.

Ordre à respecter pour une livraison qui touche la base : **migrations, puis Edge Function, puis fusion dans `main`**. Le nouveau code a besoin de la nouvelle base.

---

## 5. Recettes : « je veux… »

| Je veux… | Je modifie… |
|---|---|
| Changer un texte affiché | Chercher le texte : `grep -rn "le texte" app components lib`, puis le modifier. |
| Changer une couleur, un arrondi, une police | `app/globals.css`, bloc `@theme` (tokens `--color-…`). Ne pas écrire de couleur en dur dans les composants. |
| Ajouter ou retirer un symptôme de panne | `SYMPTOMS` dans `components/app/panne/declare-form.tsx`. Pas de migration : les symptômes sont enregistrés comme du texte. |
| Changer le menu | `MAIN_ITEMS` dans `components/app/nav.tsx`. La barre du bas mobile a 4 onglets. |
| Changer les limites de photos (3 avant, 3 après) | **Deux endroits** : `PHOTOS_MAX_PAR_TYPE` dans `lib/photos.ts`, **et** la fonction SQL `photos_max_par_type()`, redéfinie dans une nouvelle migration. Les deux valeurs doivent rester égales. |
| Changer la taille ou la qualité des photos | `lib/photos.ts` (dimension, qualités JPEG, taille maximale). |
| Changer l'heure de la tâche du matin | Nouvelle migration : `select cron.schedule('gmao-taches-quotidiennes', '0 7 * * *', 'select public.taches_quotidiennes()');` (heure UTC ; même nom = remplace la planification). La version d'origine est dans `20260930170000_…`. |
| Changer le contenu d'un mail | `envoyerMail` dans `supabase/functions/envoyer-notification/index.ts`, puis `supabase functions deploy envoyer-notification`. |
| Envoyer aussi un mail pour un autre type | `EMAIL_TYPES` dans la même Edge Function, puis redéployer. |
| Changer le titre d'une notification | La fonction SQL qui insère dans `notifications` (`declarer_panne`, `cloturer_intervention`, `mouvement_stock`, `changer_statut_intervention`, `taches_quotidiennes`) : nouvelle migration qui la redéfinit (voir section 6). |
| Ajouter un type de notification | 1) Migration **seule** : `alter type notification_type add value 'mon_type';` ; 2) migration suivante : la fonction SQL qui l'insère, en respectant `notification_settings` ; 3) `lib/notifications.ts` : `TYPE_STYLE` et `SETTINGS` (pour qu'il apparaisse dans Mes alertes) ; 4) si mail : `EMAIL_TYPES`. |
| Ajouter un statut d'intervention | 1) Migration seule : `alter type intervention_status add value '…';` ; 2) `lib/intervention-status.ts` (libellés, statuts ouverts) ; 3) `components/ui/status-badge.tsx` (couleur, icône) ; 4) vérifier `changer_statut_intervention` et les tests `08_statuts.sql`. |
| Ajouter une fréquence d'entretien | Enum `maintenance_frequency` (migration seule), puis la fonction SQL `next_due_date` (calcul de l'échéance), puis les libellés dans `lib/equipements.ts`. |
| Ajouter une icône | `components/icons.tsx` : un nom et un tracé SVG 24×24 à trait. Pour qu'elle soit proposée aux catégories : la liste dans `lib/categories-rules.ts`. |
| Changer l'icône d'une catégorie | À l'écran : Administration, puis Catégories. Icône par défaut selon le code : `lib/equipment-icon.ts`. |
| Ajouter un champ à une machine | 1) Migration : `alter table equipments add column …`, puis redéfinir `enregistrer_equipement` avec le nouveau paramètre (supprimer l'ancienne signature avec `drop function`, remettre les `grant`) ; 2) `lib/equipements.ts` (type, lecture) ; 3) `components/app/equipements/equipment-form.tsx` et `app/(app)/equipements/actions.ts` ; 4) l'afficher dans `equipment-sheet.tsx`. |
| Changer qui a le droit de faire quoi | 1) **En base** : politique RLS (nouvelle migration avec `alter policy` ou `create policy`) et/ou contrôle de rôle dans la fonction SQL ; 2) à l'écran : les fonctions `can…` de `lib/` et `app/(app)/admin/layout.tsx` pour l'administration ; 3) tests : `supabase/tests/04_droits.sql` et `tests/admin-rules.test.ts`. |
| Changer le nom ou les icônes de l'application installée | `app/manifest.ts`, `public/icons/` (192, 512, maskable), `app/apple-icon.png` (180 px), titre dans `app/layout.tsx`. |
| Changer l'adresse des liens dans les mails et les push | Secret Supabase `APP_URL`. |
| Ajouter une variable d'environnement | L'ajouter à `.env.example` (nom seulement), à ton `.env.development.local`, puis `bash scripts/vercel-env.sh` (preview) et `bash scripts/vercel-env.sh production`. Redéployer. |

---

## 6. La base de données : règles à connaître

- **Ne jamais modifier une migration déjà poussée.** Toujours en créer une nouvelle.
- **Une fonction SQL peut être redéfinie dans plusieurs migrations.** C'est la **dernière** qui compte. Pour la retrouver :
  ```bash
  grep -l "function declarer_panne" supabase/migrations/* | tail -1
  # ou, dans la base locale, afficher la version en vigueur :
  docker exec -it supabase_db_gmao-chitir psql -U postgres -c '\sf public.declarer_panne'
  ```
  Pour la modifier : la **copier entièrement** dans une nouvelle migration (`create or replace function …`) et changer seulement ce qu'il faut. Si ses paramètres changent, supprimer l'ancienne version (`drop function nom(anciens types);`), sinon deux versions coexistent.
- **Toute nouvelle fonction** appelée par l'application ou par une politique doit porter :
  ```sql
  revoke execute on function public.ma_fonction(uuid) from public, anon;
  grant execute on function public.ma_fonction(uuid) to authenticated;
  ```
  Les droits par défaut sont fermés depuis `20260930220000`. Sans le `grant`, l'appel est refusé (« permission denied »).
- **Ajouter une valeur à un type** (`alter type … add value`) : dans une migration **à part**, car on ne peut pas utiliser la valeur dans la même transaction.
- **Modèle de fonction d'écriture sûre** :
  ```sql
  create or replace function public.ma_fonction(p_intervention uuid)
  returns void
  language plpgsql security definer set search_path = public, pg_temp
  as $$
  declare
    v_caller uuid := auth.uid();
    v_role user_role := auth_role();
  begin
    if v_caller is null then
      raise exception 'Connexion requise' using errcode = '42501';
    end if;
    if v_role is null or v_role not in ('proprietaire', 'editeur') then
      raise exception 'Votre rôle ne permet pas cette action' using errcode = '42501';
    end if;
    if not has_restaurant(intervention_restaurant(p_intervention)) then
      raise exception 'Restaurant non autorisé' using errcode = '42501';
    end if;
    -- … le travail …
  end;
  $$;
  ```
  Trois pièges : écrire `v_role is null or …` (un rôle vide passerait sinon), fixer le `search_path`, et vérifier le **restaurant**, pas seulement le rôle.
- **Fonctions d'aide** utilisables dans les politiques : `auth_role()`, `has_restaurant(id)`, `equipment_restaurant(id)`, `intervention_restaurant(id)`, `peut_intervenir(user, restaurant)`.
- **Ne jamais lancer `supabase migration repair`** sans comprendre l'écart : cette commande réécrit l'historique sans rien appliquer.

---

## 7. Tests

```bash
supabase start                       # base locale (Docker)
bash supabase/tests/run.sh           # tout (639 tests au 2026-09-30)
bash supabase/tests/run.sh 08_statuts   # un seul fichier
```

- Un fichier par sujet dans `supabase/tests/` : `01_stock`, `02_cloture`, `03_entretien`, `04_droits` (matrice rôle × action), `06_notifications`, `07_restaurant`, `08_statuts`, `09_categories`, `10_photos`, `11_comptes`, plus `concurrence.sh`.
- Chaque scénario tourne dans une transaction annulée : rien ne reste en base.
- Les comptes de test sont créés dans `_fixture.sql`.
- **Après chaque changement de base ou de droits, relancer toute la suite.** Si un test casse, se demander d'abord si c'est le code ou le test qui a tort.

---

## 8. Où regarder quand quelque chose ne marche pas

| Symptôme | Où regarder |
|---|---|
| Erreur 500, page blanche en ligne | Vercel → Deployments → le déploiement → **Logs** |
| Erreur d'une fonction SQL ou d'un droit | Message affiché à l'écran, puis Supabase → Logs → Postgres |
| Notification absente | Supabase → Edge Functions → `envoyer-notification` → **Logs** |
| Mail absent | Resend → **Emails** (historique, statut de chaque envoi) |
| Rappels d'entretien absents | Supabase → Database → **Cron** (historique des exécutions de 7 h) |
| Photos | Supabase → **Storage** → `photos` (fichiers, quota de 1 Go) |
| Connexion refusée | Supabase → Authentication → Users, et URL Configuration |

---

## 9. Pièges déjà rencontrés (et leur solution)

| Symptôme | Cause | Solution |
|---|---|---|
| Sur téléphone en `http://192.168…` : page inerte, rien ne réagit | Next bloque les scripts de dev venant d'une autre origine | `allowedDevOrigins: ["192.168.11.*"]` dans `next.config.ts` (joker, pas de `/24`). Redémarrer `next dev` |
| Sur téléphone en http : « Copier », push, installation ou photos en échec | Ces fonctions du navigateur n'existent qu'en **https** | Tester sur l'adresse de prévisualisation Vercel (https). Le code a des solutions de repli pour copier et pour les photos, pas pour le push |
| Vercel : « 500 Middleware » dès l'accueil | Variables absentes pour cet environnement (Preview ou Production) | `bash scripts/vercel-env.sh` (ou `… production`), puis **Redeploy** |
| « API key not valid » (Firebase) | Valeur collée avec guillemets, espace ou virgule | Une valeur seule par variable. Le script `vercel-env.sh` nettoie les valeurs |
| Une variable `NEXT_PUBLIC_` changée n'est pas prise en compte | Elle est intégrée au moment de la construction | Redéployer (Vercel) ou relancer `npm run dev` |
| `supabase db push` : « Remote migration versions not found » | Commande lancée depuis le mauvais dossier ou la mauvaise branche | `cd gmao-chitir`, `git branch --show-current`. **Pas de `migration repair`** |
| « permission denied for function » | `grant execute … to authenticated` manquant | L'ajouter dans une nouvelle migration |
| « unsafe use of new value » (enum) | Valeur ajoutée et utilisée dans la même migration | Séparer en deux migrations |
| Nouvelles classes Tailwind sans effet | Feuille de style du serveur de dev pas à jour | Redémarrer `npm run dev`, recharger la page |
| Bouton « ordinateur » visible aussi sur mobile | `hidden lg:inline-flex` combiné à `buttonClass()` (qui contient déjà `inline-flex`) | Utiliser `max-lg:hidden` |
| La page déborde à droite sur mobile | Grille sans colonnes définies : la colonne prend la largeur du texte le plus long | `grid-cols-1` sur la grille, `min-w-0` sur les enfants |
| « Je ne reçois pas la notification » | On n'est **jamais prévenu de sa propre action** ; réglage coupé dans Mes alertes ; push pas activé sur l'appareil ; iPhone non installé | Tester avec deux comptes, vérifier Mes alertes et « Notifications sur cet appareil » |
| « Tous les mails arrivent chez moi » | Resend sans domaine vérifié : envoi seulement à l'adresse du compte | Normal en mode test. Voir section 10 |

---

## 10. Mails : passer de mon e-mail à celui du client

Sans nom de domaine, Resend n'envoie qu'à l'adresse **du propriétaire du compte Resend**. Tous les mails partent vers `RESEND_TEST_RECIPIENT`, avec le vrai destinataire écrit en tête du mail.

**Pour que le client reçoive les mails à ta place :**
1. Le client crée un compte gratuit sur resend.com **avec son e-mail**, puis une clé d'API (API Keys → Create API Key, « Sending access »).
2. Remplacer les deux secrets :
   ```bash
   supabase secrets set RESEND_API_KEY="clé_du_client"
   supabase secrets set RESEND_TEST_RECIPIENT="email.du.client@exemple.com"
   ```
3. Aucun redéploiement : la fonction relit les secrets à chaque envoi. Tester en déclarant une panne avec un compte technicien.

**Pour que chacun reçoive ses propres mails**, il faut un **nom de domaine** vérifié dans Resend (enregistrements DNS SPF et DKIM). Un `….vercel.app` ne convient pas. Ensuite :
```bash
supabase secrets set RESEND_FROM_PRODUCTION="GMAO Chitir <alertes@domaine-client>"
supabase secrets unset RESEND_TEST_RECIPIENT
```
Ordre de priorité de l'expéditeur : `RESEND_FROM_PRODUCTION`, puis `RESEND_FROM_PRESENTATION`, puis l'adresse de test Resend.

---

## 11. Commandes utiles

```bash
# Local
supabase start | supabase stop | supabase status
npm run dev
supabase migration new nom
supabase migration up --local
supabase db reset                       # base LOCALE seulement : recrée tout
bash supabase/tests/run.sh

# Base hébergée (depuis gmao-chitir, bonne branche)
supabase migration list                 # comparer local et hébergé
supabase db push --dry-run              # voir ce qui partirait
supabase db push
supabase db dump -f sauvegarde.sql      # sauvegarde (hors dépôt)

# Edge Function et secrets
supabase functions deploy envoyer-notification
supabase secrets list                   # noms seulement
supabase secrets set NOM="valeur"

# Vercel
vercel link
bash scripts/vercel-env.sh [production]
vercel logs <adresse-du-déploiement>

# Git
git checkout staging && git pull
git push
```

---

## 12. Next.js 16 : ce qui diffère des tutoriels habituels

- Le middleware s'appelle **`proxy.ts`** (fonction `proxy`).
- `error.tsx` reçoit `retry` (et non plus `reset`).
- Les pages reçoivent des props typées `PageProps<"/chemin">`, et `searchParams` est une promesse (`await props.searchParams`).
- La documentation exacte de la version installée est dans `node_modules/next/dist/docs/` : c'est la seule qui fait foi.

---

## 13. Les autres documents

| Document | Contenu |
|---|---|
| `docs/README.md` | Installation, variables, base, tests, notifications, déploiement, rôles et droits |
| `docs/journal-decisions.md` | Chaque décision datée : quoi, pourquoi, ce qui a été écarté |
| `docs/guide-presentation-client.md` | Déroulé de la démonstration au client |
| `docs/plan-mise-en-production.md` | Liste de contrôle avant la mise en production |
| `docs/modele-donnees-proposition.md` | Modèle de données d'origine |
| `docs/recette/` | Rapports de la première recette (tests, sécurité, conformité, corrections) |
| `docs/maquettes-resume.md` | Résumé des maquettes (les maquettes découpées sont dans `../maquettes/`) |
