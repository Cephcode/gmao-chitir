# Guide du développeur : où faire quoi

Pour reprendre et modifier le projet seul, sans assistant. Mis à jour le 2026-10-08.

**Les documents, et dans quel ordre les lire :**
0. `docs/formation/` : **la formation complète, à suivre en premier si le web ou Next.js sont nouveaux pour vous** (12 chapitres, exercices). `docs/comprendre-le-projet.md` en est le résumé (les notions, le trajet d'un clic, modifier et ajouter un module avec un modèle à recopier).
1. `docs/taches-restantes.md` : **où en est le projet** et **comment faire chaque tâche restante** (commencer par là).
2. Ce guide : comment l'application fonctionne, où se trouve chaque chose, comment modifier.
3. `docs/base-de-donnees.md` : toutes les tables, fonctions SQL, droits et migrations.
4. `docs/README.md` : exploitation (installation, variables, tests, notifications, déploiement, rôles).
5. `docs/journal-decisions.md` : chaque décision datée, avec sa raison.

---

## 1. Comment l'application fonctionne

```
Téléphone / ordinateur (navigateur ou application installée)
        │  https
        ▼
Next.js 16 sur Vercel (fonctions à Dublin)
  - proxy.ts : vérifie la session à chaque requête (sinon → /connexion)
  - app/(app)/layout.tsx : profil, mot de passe à changer, menu
  - pages (Server Components) : lisent la base avec les droits de l'utilisateur
  - composants clients ("use client") : formulaires, filtres, photos
  - actions serveur (actions.ts) : écrivent en base, après vérification
        │  clé publique + session de l'utilisateur (RLS appliquée)
        │  clé secrète seulement pour les comptes (lib/supabase/admin.ts)
        ▼
Supabase (Postgres + Auth + Storage + Edge Function), Irlande
  - RLS : chaque table filtre ce que l'utilisateur peut voir ou modifier
  - fonctions SQL (SECURITY DEFINER) : déclarer, clôturer, stock, statut, photos…
  - Storage : bucket privé « photos »
  - pg_cron : taches_quotidiennes() chaque jour à 7 h
        │  à chaque ligne ajoutée dans « notifications »
        ▼
trigger trg_notifications_envoi → pg_net → Edge Function envoyer-notification (Deno)
  - push Firebase vers les appareils du destinataire
  - mail Resend (urgence, panne, attribution)
```

**Règle d'or : la sécurité est dans la base.** L'écran cache les boutons qu'un rôle ne peut pas utiliser, mais c'est la base (RLS et fonctions SQL) qui refuse vraiment. Une nouvelle règle de droits doit donc toujours être écrite **en base**, puis reflétée à l'écran.

**Pile technique** : Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript, Tailwind CSS 4, `@supabase/ssr` et `@supabase/supabase-js`, `firebase` (push côté navigateur). Aucune autre dépendance (`package.json`). Node 24 sur Vercel.

---

## 2. Les services et leur rôle

| Service | À quoi il sert | Où le gérer |
|---|---|---|
| **GitHub** (`Cephcode/gmao-chitir`, privé) | Le code. Branches `staging` (travail) et `main` (production) | github.com |
| **Vercel** (projet `gmao-chitir`, équipe `cephcodes-projects`) | Héberge l'application. `main` part en production (`https://gmao-chitir.vercel.app`), les autres branches donnent une adresse de prévisualisation | vercel.com : Deployments, Settings → Environment Variables, Logs |
| **Supabase** (projet `GMAO-CHITIR`, réf. `jmxeewnhthhlutqgeixj`, Irlande `eu-west-1`) | Base de données, comptes, photos, Edge Function, tâche du matin | supabase.com : Table Editor, SQL Editor, Authentication, Storage, Edge Functions, Database → Cron |
| **Firebase** | Notifications push | console.firebase.google.com : Project settings, Cloud Messaging |
| **Resend** | Mails | resend.com : API Keys, Domains, Emails (historique des envois) |

Le dossier est relié aux services par : `supabase/.temp/project-ref` (`supabase link`) et `.vercel/repo.json` (`vercel link`). Ces deux dossiers sont hors du dépôt.

---

## 3. Carte du projet

| Dossier ou fichier | Contenu |
|---|---|
| `app/(app)/` | Toutes les pages après connexion (le dossier entre parenthèses n'apparaît pas dans l'adresse). `layout.tsx` = garde de session, mot de passe à changer, menu. Un dossier par écran : `equipements/`, `interventions/`, `panne/`, `stock/`, `consommables/`, `notifications/`, `admin/` |
| `app/(app)/**/page.tsx` | Une page : lit les données (fonctions de `lib/`) et affiche les composants |
| `app/(app)/**/actions.ts` | Actions serveur (`"use server"`) : tout ce qui **écrit** |
| `app/(app)/interventions/photos-actions.ts` | Enregistrer et retirer les photos (après dépôt dans Storage) |
| `app/(app)/page.tsx` | Le tableau de bord (indicateurs, « À traiter en priorité », par restaurant) |
| `app/(app)/error.tsx`, `loading.tsx` (et `loading.tsx` de chaque écran) | Écrans d'erreur et de chargement |
| `app/connexion/`, `app/changer-mot-de-passe/` | Connexion, et changement obligatoire du mot de passe temporaire (8 caractères minimum). Pas de « mot de passe oublié » en libre-service |
| `app/layout.tsx` | Page racine : polices, titre, métadonnées iPhone, viewport |
| `app/manifest.ts`, `app/apple-icon.png`, `public/icons/`, `public/logo-chitir.png` | Application installable : nom et icônes. Le logo sert aussi d'icône des push |
| `app/firebase-messaging-sw.js/route.ts` | Service worker des push, généré avec la configuration Firebase publique |
| `app/design-system/page.tsx` | Page de démonstration des composants (non liée au menu, accessible connecté) |
| `app/globals.css` | **Couleurs, polices, arrondis** (tokens dans `@theme`), squelette de chargement, règles globales |
| `components/ui/` | Briques réutilisables : `button`, `field` (champs et focus), `card`, `alert`, `combobox` (liste avec recherche), `segmented-control`, `status-badge` |
| `components/app/` | Composants des écrans, un dossier par écran (tableau section 4) |
| `components/app/nav.tsx` | Menu latéral (ordinateur), barre du bas (mobile), bouton « Déclarer une panne », déconnexion |
| `components/app/url-filters.tsx` | Recherche et puces de filtre, entièrement dans l'adresse (`?q=&restaurant=…`) |
| `components/app/install-banner.tsx` | Bandeau « Installer l'application » |
| `components/icons.tsx` | Toutes les icônes (tracés SVG 24×24) |
| `lib/` | Logique : lecture des données, règles, libellés (tableau suivant) |
| `lib/supabase/` | Les clients Supabase : `client.ts` (navigateur), `server.ts` (serveur, droits de l'utilisateur), `admin.ts` (clé secrète, serveur seulement), `middleware.ts` (session, routes publiques) |
| `proxy.ts` | L'ancien « middleware » (renommé en Next 16) : appelle `updateSession`, et liste les fichiers exclus de la vérification (service worker, manifeste, images) |
| `next.config.ts` | `allowedDevOrigins` (test sur téléphone en développement) |
| `vercel.json` | Région des fonctions : Dublin (`dub1`) |
| `supabase/migrations/` | **Toute la base** : tables, droits, fonctions, données de départ. Une migration = un fichier daté. Détail : `docs/base-de-donnees.md` |
| `supabase/functions/envoyer-notification/index.ts` | L'Edge Function (Deno) qui envoie push et mails |
| `supabase/tests/` | Tests SQL (`run.sh` lance tout) |
| `supabase/config.toml` | Réglages de la base **locale** (inscription fermée, Edge Function sans jeton…) |
| `supabase/snippets/` | Requêtes SQL enregistrées depuis le studio local (sans importance) |
| `tests/` | Tests des règles pures (`node --test`), avec un chargeur qui résout `@/` (`register.mjs`, `alias-hooks.mjs`) |
| `scripts/vercel-env.sh` | Copie les variables d'environnement vers Vercel |
| `scripts/remettre-compte.mjs` | Change l'e-mail de connexion d'un compte (connexion et profil) et met un mot de passe temporaire ; sert à la remise au client (`docs/remise-client.md`) |
| `scripts/verification-production.sql` | Contrôle de santé de la base hébergée en lecture seule (tâche du matin, photos, notifications remises, push, comptes) |
| `scripts/reperage-donnees.sql` | Requêtes en lecture seule pour voir les données de la base hébergée (avant nettoyage) |
| `.env.example` | Liste des variables (noms seulement). Les vrais `.env*` sont hors dépôt |
| `.claude/agents/` | Consignes des assistants utilisés pendant le développement (test, sécurité, conformité, documentation). Inutiles sans assistant |
| `docs/` | Documentation, journal, plans, rapports de recette |
| `../maquettes/` (hors dépôt, dossier voisin) | Maquettes découpées, une page par écran (`INDEX.md`) |

**Les fichiers de `lib/` :**

| Fichier | Contenu |
|---|---|
| `session.ts` | `getProfile` (profil de l'utilisateur connecté, lu une fois par requête), `getNavCounts` (urgences ouvertes, notifications non lues), `ROLE_LABELS` |
| `admin.ts`, `admin-rules.ts` | Qui peut administrer quoi : `canAccessAdmin`, `canManage`, `assignableRoles`, `checkAssignment` (testés). `motDePasseTemporaire` |
| `equipements.ts` | Lecture des machines, filtres, statut d'entretien (`maintenanceOf`), fréquences (`FREQUENCY_LABELS`), `canEditEquipments` |
| `equipment-icon.ts` | Icône d'une machine selon sa catégorie |
| `categories.ts`, `categories-rules.ts` | Catégories : lecture, nombre de machines, code proposé, icônes au choix |
| `interventions.ts` | Interventions : lecture, filtres, types (`KIND_LABELS`), priorités (`TYPE_BADGE`), techniciens (`listTechnicians`), pièces disponibles à la clôture |
| `intervention-status.ts` | Statuts, libellés, `canSetStatus` |
| `stock.ts` | Pièces, unités, mouvements, `isLow`, `canEditStock` |
| `consommables.ts`, `consommables-rules.ts` | Consommables (stock des restaurants) : lectures (`chargerListe`, `getArticle`, mouvements, `canEditConsommables`) ; règles pures testées (familles, unités, opérations, validation, résumé par restaurant, filtres) |
| `notifications.ts` | Types de notification (`TYPE_STYLE`), réglages « Mes alertes » (`SETTINGS`), groupes par jour, `safeLink` |
| `photos.ts`, `photos-browser.ts`, `photos-server.ts` | Photos : limites et chemins ; compression et envoi depuis le navigateur ; liens signés côté serveur |
| `firebase-client.ts`, `push-appareil.ts` | Push : jeton de l'appareil, activation, oubli à la déconnexion |
| `auth-actions.ts` | `deconnexion` |
| `identifiant.ts`, `format.ts` | Normalisation des e-mails ; dates (« depuis », « 6 oct. »), `nomPersonne` (prénom, sinon e-mail) |

---

## 4. Écran par écran

Toutes les pages de `app/(app)/` sont réservées aux comptes connectés. « Qui » = ce que l'écran propose ; la base refuse de toute façon ce qui n'est pas permis.

| Adresse | Page | Composants principaux | Actions serveur → fonction SQL | Qui |
|---|---|---|---|---|
| `/connexion` | `app/connexion/page.tsx` | (dans la page) | `seConnecter` → Supabase Auth, puis `users.last_seen_at` (clé secrète) | Tout le monde |
| `/changer-mot-de-passe` | `app/changer-mot-de-passe/page.tsx` | (dans la page) | `changerMotDePasse` → Auth, puis `must_change_password = false` (clé secrète) | Compte avec mot de passe temporaire |
| `/` | `app/(app)/page.tsx` | `kpi-card`, `list-row`, `restaurant-select` | — (lecture) | Tous |
| `/equipements` | `equipements/page.tsx` | `equipment-list`, `equipment-filters` | — | Tous |
| `/equipements/[id]` | `equipements/[id]/page.tsx` | `equipment-sheet`, `maintenance-done-button` | `noterEntretienFait` → `noter_entretien_fait` | Tous (bouton : sauf lecteur) |
| `/equipements/nouveau`, `/equipements/[id]/modifier` | `equipements/nouveau/page.tsx`, `…/modifier/page.tsx` | `equipment-form` | `enregistrerEquipement` → `enregistrer_equipement` ; `suggererCode` → `prochain_code_equipement` ; `supprimerEquipement` (direct, propriétaire) | Propriétaire, éditeur |
| `/panne` | `panne/page.tsx` | `panne/declare-form`, `photos/photos` | `declarerPanne` → `declarer_panne`, puis photos | Tous |
| `/panne/envoyee/[id]` | `panne/envoyee/[id]/page.tsx` | — | — | Le déclarant |
| `/interventions` | `interventions/page.tsx` | `intervention-list`, `url-filters` | — | Tous |
| `/interventions/[id]` | `interventions/[id]/page.tsx` | `intervention-sheet`, `status-selector`, `closing-form`, `technician-picker`, `intervention-photos` | `changerStatutIntervention` → `changer_statut_intervention` ; `enregistrerIntervention` (direct, colonnes limitées) ; `cloturerIntervention` → `cloturer_intervention` ; `enregistrerPhotos` → `ajouter_photo_intervention` ; `supprimerPhoto` | Tous (actions : sauf lecteur, sauf photos « avant ») |
| `/interventions/nouvelle` | `interventions/nouvelle/page.tsx` | `new-intervention-form`, `technician-picker` | `creerIntervention` → `creer_intervention` | Propriétaire, éditeur, commentateur (le lecteur est renvoyé vers `/panne`) |
| `/stock` | `stock/page.tsx` | `stock-list` | — | Tous |
| `/stock/[id]` | `stock/[id]/page.tsx` | `part-sheet`, `stock-controls` | `mouvementStock` → `mouvement_stock` | Tous (mouvements : propriétaire, éditeur) |
| `/stock/nouvelle`, `/stock/[id]/modifier` | `stock/nouvelle/page.tsx`, `…/modifier/page.tsx` | `part-form` | `enregistrerPiece` (direct + `mouvement_stock` pour la quantité de départ) ; `supprimerPiece` | Propriétaire, éditeur |
| `/consommables` | `consommables/page.tsx` | `consommables/article-list`, `stock/stock-switch` | — | Tous |
| `/consommables/[id]` | `consommables/[id]/page.tsx` | `article-sheet`, `article-operation` | `operationArticle` → `mouvement_article`, `inventaire_article`, `transferer_article`, `regler_seuil_article` ; `arreterSuivi` → `ne_plus_suivre_article` | Tous (opérations : propriétaire, éditeur du restaurant) |
| `/consommables/nouveau`, `/consommables/[id]/modifier` | `consommables/nouveau/page.tsx`, `…/modifier/page.tsx` | `article-form` | `enregistrerArticle`, `supprimerArticle` (direct, RLS) | Propriétaire, éditeur (suppression : propriétaire) |
| `/notifications` | `notifications/page.tsx` | `alert-settings`, `push-toggle` | `ouvrirNotification`, `toutMarquerLu` (colonne `read_at`) | Tous |
| `/notifications/alertes` | `notifications/alertes/page.tsx` | `alert-settings`, `push-toggle` | `reglerAlerte` (`notification_settings`) ; `enregistrerAppareil`, `oublierAppareil` (`push_tokens`) | Tous |
| `/admin` | `admin/page.tsx` | — | — (redirige vers `/admin/utilisateurs`) | Propriétaire, éditeur (garde : `admin/layout.tsx`) |
| `/admin/utilisateurs`, `/nouveau`, `/[id]` | `admin/utilisateurs/…` | `admin-views`, `user-form` | `creerCompte`, `modifierCompte`, `reinitialiserMotDePasse`, `supprimerCompte` (clé secrète, après `checkAssignment`) | Propriétaire ; éditeur pour ses restaurants, sans propriétaire |
| `/admin/restaurants`, `/nouveau` | `admin/restaurants/…` | `admin-views`, `restaurant-form` | `ajouterRestaurant` → `ajouter_restaurant` | Propriétaire |
| `/admin/categories`, `/nouveau`, `/[id]` | `admin/categories/…` | `category-views`, `category-form` | `enregistrerCategorie`, `supprimerCategorie` (direct, RLS) | Propriétaire, éditeur |

**Les filtres sont dans l'adresse** : on peut les partager et le bouton retour les garde. Lus par `readFilters` de chaque fichier de `lib/` :
- `/equipements?q=&restaurant=&categorie=&etat=&entretien=` ;
- `/interventions?statut=&q=&restaurant=&etat=&nature=&type=&technicien=` (`statut` = onglet `ouvertes`, `terminee` ou `toutes` ; `etat` = statut d'une intervention ouverte, `a_planifier`, `en_cours` ou `en_attente_piece` ; `nature` = type d'intervention ; `type` = priorité) ;
- `/stock?q=&categorie=&statut=` ;
- `/consommables?q=&restaurant=CODE&famille=&statut=sous_seuil` ;
- `/?restaurant=CODE` sur le tableau de bord.

---

## 5. Le trajet d'une action, de bout en bout

Exemple : **un lecteur déclare une panne urgente avec une photo.**

1. `/panne` : `app/(app)/panne/page.tsx` lit le profil et les machines des restaurants accessibles, puis affiche `components/app/panne/declare-form.tsx`.
2. L'utilisateur choisit la machine, un symptôme (`SYMPTOMS` dans le même fichier), une photo (compressée tout de suite dans le navigateur par `compressPhoto`, `lib/photos-browser.ts`) et « Oui, c'est urgent ».
3. « Envoyer » appelle l'action serveur `declarerPanne` (`app/(app)/panne/actions.ts`). Elle vérifie la saisie, puis `supabase.rpc("declarer_panne", …)` avec la session de l'utilisateur.
4. La fonction SQL `declarer_panne`, en **une transaction** : vérifie l'accès au restaurant ; crée la ligne `interventions` (statut forcé « À planifier » pour un lecteur) ; passe la machine `en_panne` ; ajoute un `equipment_events` ; insère une `notifications` pour chaque propriétaire, éditeur et commentateur du restaurant, sauf le déclarant et ceux qui ont coupé l'alerte `urgence`.
5. Pour chaque notification insérée, le trigger `trg_notifications_envoi` met en file un appel pg_net vers l'Edge Function. L'appel part **après** la validation de la transaction.
6. L'Edge Function `envoyer-notification` réserve la notification (`delivered_at`), envoie le push à chaque appareil du destinataire (`push_tokens`) et, pour `urgence`, `panne` et `attribution`, un mail par Resend.
7. De retour dans le navigateur, le formulaire envoie les photos (`sendPhotos`) : dépôt direct dans le bucket `photos` (chemin `{restaurant}/{intervention}/{uuid}.jpg`), puis l'action `enregistrerPhotos` (`photos-actions.ts`), qui appelle `ajouter_photo_intervention`. Si une photo échoue, la panne reste déclarée.
8. Redirection vers `/panne/envoyee/[id]` (avec `?photos_echec=N` si besoin). `revalidatePath("/", "layout")` met à jour les compteurs du menu.

Les autres actions suivent le même schéma : **composant client → action serveur → fonction SQL (ou écriture directe filtrée par la RLS) → notifications → Edge Function.**

---

## 6. Le cycle d'une modification

1. **Travailler sur `staging`** : `git checkout staging && git pull`.
2. **Lancer en local** : `supabase start` (base locale dans Docker), puis `npm run dev`.
   ⚠️ `npm run dev` lit `.env.development.local`, qui pointe aujourd'hui sur la **base hébergée** (vraies données du client). Pour travailler sur la base **locale**, voir la section 7.
3. **Si la base change** :
   - créer une migration : `supabase migration new mon_changement` (un fichier vide daté apparaît dans `supabase/migrations/`) ;
   - l'écrire (section 8), l'appliquer en local : `supabase migration up --local` ;
   - en cas d'erreur, tout recréer : `supabase db reset` (base locale seulement ; elle revient aux données de départ, sans compte).
4. **Vérifier** :
   ```bash
   npx tsc --noEmit                 # types
   npx eslint .                     # style et erreurs courantes
   bash supabase/tests/run.sh       # tous les tests (base locale)
   npx next build                   # facultatif : le build de production passe
   ```
5. **Commiter** sur `staging`, puis `git push`. Vercel construit une **adresse de prévisualisation https** : tester dessus, sur téléphone.
6. **Base hébergée** : `supabase db push --dry-run`, puis `supabase db push`, depuis `gmao-chitir` et sur la bonne branche. Vérifier avec `supabase migration list`.
7. **Edge Function modifiée ?** `supabase functions deploy envoyer-notification`.
8. **Production** : pull request `staging` → `main` sur GitHub, fusion. Vercel déploie tout seul.

Ordre à respecter pour une livraison qui touche la base : **migrations, puis Edge Function, puis fusion dans `main`**. Le nouveau code a besoin de la nouvelle base. Les migrations doivent rester **compatibles avec le code en production** pendant ce délai (ajouter plutôt que renommer ou supprimer).

---

## 7. Travailler sur la base locale (sans toucher aux vraies données)

**Raccourci : `bash scripts/dev-local.sh`** fait exactement ce qui suit (et refuse de démarrer si la base locale est arrêtée).

Next ne remplace pas une variable déjà présente dans l'environnement par celle d'un fichier `.env`. On peut donc lancer l'application sur la base locale sans modifier `.env.development.local` :

```bash
supabase start
eval "$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
SUPABASE_SECRET_KEY="$SECRET_KEY" \
npm run dev
```

La base locale n'a **aucun compte** au départ. Créer un propriétaire avec `scripts/creer-proprietaire.mjs` (le script décrit dans `docs/taches-restantes.md`, T8), avec les mêmes variables :

```bash
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY" \
  node scripts/creer-proprietaire.mjs moi@test.local "Moi"
```

Puis créer les autres comptes dans Administration. Studio local (tables, SQL) : `http://127.0.0.1:54323`. Les mails des comptes locaux ne partent pas.
Pour revenir à zéro : `supabase db reset`.

---

## 8. Recettes : « je veux… »

| Je veux… | Je modifie… |
|---|---|
| Changer un texte affiché | Chercher le texte : `grep -rn "le texte" app components lib`, puis le modifier. Les messages d'erreur de la base sont dans les fonctions SQL (`raise exception '…'`). |
| Changer une couleur, un arrondi, une police | `app/globals.css`, bloc `@theme` (tokens `--color-…`). Ne pas écrire de couleur en dur dans les composants. |
| Ajouter ou retirer un symptôme de panne | `SYMPTOMS` dans `components/app/panne/declare-form.tsx`. Pas de migration : les symptômes sont enregistrés comme du texte. |
| Changer le menu | `MAIN_ITEMS` dans `components/app/nav.tsx`. La barre du bas mobile a 4 onglets. |
| Changer les limites de photos (3 avant, 3 après) | **Deux endroits** : `PHOTOS_MAX_PAR_TYPE` dans `lib/photos.ts`, **et** la fonction SQL `photos_max_par_type()`, redéfinie dans une nouvelle migration. Les deux valeurs doivent rester égales. |
| Changer la taille ou la qualité des photos | `lib/photos.ts` (dimension, qualités JPEG, taille maximale). |
| Changer l'heure de la tâche du matin | Nouvelle migration : `select cron.schedule('gmao-taches-quotidiennes', '0 7 * * *', 'select public.taches_quotidiennes()');` (heure UTC ; même nom = remplace la planification). |
| Changer le délai du rappel « entretien à prévoir » (3 jours) | Fonction `taches_quotidiennes` (`current_date + 3`), nouvelle migration qui la recopie. |
| Changer le contenu d'un mail | `envoyerMail` dans `supabase/functions/envoyer-notification/index.ts`, puis `supabase functions deploy envoyer-notification`. |
| Envoyer aussi un mail pour un autre type | `EMAIL_TYPES` dans la même Edge Function, puis redéployer. |
| Changer qui est prévenu d'une panne | La requête `insert into notifications … where u.role in (…)` de `declarer_panne` et `creer_intervention` (nouvelle migration). |
| Changer le titre d'une notification | La fonction SQL qui insère dans `notifications` (`declarer_panne`, `creer_intervention`, `cloturer_intervention`, `mouvement_stock`, `changer_statut_intervention`, `prevenir_technicien_attribue`, `taches_quotidiennes`) : nouvelle migration qui la redéfinit (section 9). |
| Ajouter un type de notification | 1) Migration **seule** : `alter type notification_type add value 'mon_type';` ; 2) migration suivante : la fonction SQL qui l'insère, en respectant `notification_settings` ; 3) `lib/notifications.ts` : `TYPE_STYLE` et `SETTINGS` (pour qu'il apparaisse dans Mes alertes) ; 4) si mail : `EMAIL_TYPES`. |
| Ajouter un statut d'intervention | 1) Migration seule : `alter type intervention_status add value '…';` ; 2) `lib/intervention-status.ts` (libellés, statuts ouverts) ; 3) `components/ui/status-badge.tsx` (couleur, icône) ; 4) vérifier `changer_statut_intervention` et les tests `08_statuts.sql`. |
| Ajouter un type d'intervention (comme « Contrôle ») | 1) Migration seule : `alter type intervention_kind add value '…';` ; 2) `KIND_LABELS` et `KINDS` dans `lib/interventions.ts` ; 3) le choix dans `components/app/interventions/new-intervention-form.tsx` ; 4) l'effet sur la machine dans `creer_intervention` (seul `correctif` la met en panne). |
| Ajouter une fréquence d'entretien | Enum `maintenance_frequency` (migration seule), puis la fonction SQL `next_due_date` (calcul de l'échéance), puis `FREQUENCY_LABELS` dans `lib/equipements.ts` et les boutons de `equipment-form.tsx`. |
| Ajouter une famille ou une unité de consommable | Famille : migration seule `alter type article_famille add value '…';`, puis `FAMILLES` et `FAMILLE_LABELS` dans `lib/consommables-rules.ts`. Unité : migration qui remplace la contrainte `articles_unit_check`, puis `UNITES` dans le même fichier. |
| Laisser le lecteur saisir les consommations | Fonction `consommable_controle` (rôles acceptés) dans une nouvelle migration, en limitant au besoin aux raisons `consommation` et `perte` dans `mouvement_article` ; puis `canEditConsommables` (`lib/consommables.ts`) et les tests `13_consommables.sql`. |
| Ajouter une icône | `components/icons.tsx` : un nom et un tracé SVG 24×24 à trait. Pour qu'elle soit proposée aux catégories : la liste dans `lib/categories-rules.ts`. |
| Changer l'icône d'une catégorie | À l'écran : Administration, puis Catégories. Icône par défaut selon le code : `lib/equipment-icon.ts`. |
| Ajouter un champ à une machine | 1) Migration : `alter table equipments add column …`, puis redéfinir `enregistrer_equipement` avec le nouveau paramètre (supprimer l'ancienne signature avec `drop function`, remettre les `grant`) ; 2) `lib/equipements.ts` (type, lecture) ; 3) `components/app/equipements/equipment-form.tsx` et `app/(app)/equipements/actions.ts` ; 4) l'afficher dans `equipment-sheet.tsx`. |
| Changer qui a le droit de faire quoi | 1) **En base** : politique RLS (nouvelle migration avec `alter policy` ou `create policy`) et/ou contrôle de rôle dans la fonction SQL ; 2) à l'écran : les fonctions `can…` de `lib/` et `app/(app)/admin/layout.tsx` pour l'administration ; 3) tests : `supabase/tests/04_droits.sql` et `tests/admin-rules.test.ts`. |
| Ajouter une page | Un dossier dans `app/(app)/` avec `page.tsx` (et `loading.tsx` si la lecture est lente). Elle est protégée d'office par `proxy.ts` et `app/(app)/layout.tsx`. Si elle est réservée à certains rôles : `redirect()` en haut de la page, comme `interventions/nouvelle/page.tsx`. |
| Rendre une page accessible sans connexion | `PUBLIC_PATHS` dans `lib/supabase/middleware.ts` (et la sortir de `app/(app)/`). |
| Changer le nom ou les icônes de l'application installée | `app/manifest.ts`, `public/icons/` (192, 512, maskable), `app/apple-icon.png` (180 px), titre dans `app/layout.tsx`. |
| Changer l'adresse des liens dans les mails et les push | Secret Supabase `APP_URL`. |
| Ajouter une variable d'environnement | L'ajouter à `.env.example` (nom seulement), à ton `.env.development.local`, puis `bash scripts/vercel-env.sh` (preview) et `bash scripts/vercel-env.sh production`. Redéployer. |

---

## 9. La base de données : règles à connaître

Inventaire complet (tables, fonctions et leur version en vigueur, droits) : `docs/base-de-donnees.md`.

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
- **Codes d'erreur** : les actions serveur affichent tel quel le message SQL pour les codes `42501` (accès), `22004` et `22023` (saisie), `23514` (stock), `P0002` (introuvable). Écrire ces messages en français, lisibles par le client. Les autres erreurs donnent un message générique.
- **Fonctions d'aide** utilisables dans les politiques : `auth_role()`, `has_restaurant(id)`, `equipment_restaurant(id)`, `intervention_restaurant(id)`, `peut_intervenir(user, restaurant)`.
- **Ne jamais lancer `supabase migration repair`** sans comprendre l'écart : cette commande réécrit l'historique sans rien appliquer.

---

## 10. Tests

```bash
supabase start                          # base locale (Docker)
bash supabase/tests/run.sh              # tout (801 tests au 2026-10-09)
bash supabase/tests/run.sh 08_statuts   # un seul fichier
```

| Fichier | Ce qu'il vérifie |
|---|---|
| `_fixture.sql` | Jeu commun : restaurants TSTA et TSTB, un compte par rôle, machines, pièces, interventions. Fonctions `tests.se_connecter('ed1')`, `tests.essai(...)` |
| `01_stock.sql` | Mouvements, seuil, stock jamais négatif |
| `02_cloture.sql` | Clôture : pièces, état de la machine, fiche de vie |
| `03_entretien.sql` | Échéances, retards, entretien noté, clôture comptée comme entretien |
| `04_droits.sql` | Matrice rôle × action × restaurant (265 tests) |
| `06_notifications.sql` | Destinataires, réglages, titres, réservation `delivered_at` |
| `07_restaurant.sql` | Ajout et copie d'un restaurant |
| `08_statuts.sql` | Statuts d'intervention |
| `09_categories.sql` | Catégories : droits, suppression, unicité |
| `10_photos.sql` | Photos : RLS, bucket, limite, ajouts simultanés |
| `11_comptes.sql` | Suppression d'un compte qui en a créé d'autres |
| `12_retours_client.sql` | Retours du 2026-10-06 : nouvelle intervention, attribution, fréquences, noms uniques, date |
| `13_consommables.sql` | Consommables : livraison, consommation, perte, inventaire, transfert, seuil et alertes par restaurant, droits rôle × restaurant (101 tests) |
| `concurrence.sh` | Clôtures et mouvements simultanés |
| `tests/*.test.ts` | Règles pures : administration, entretien, catégories, photos (`node --test`) |

- Chaque scénario SQL tourne dans une transaction annulée : rien ne reste en base, rien n'est envoyé.
- Le script refuse de tourner si le conteneur Docker local est absent, et vérifie à la fin qu'aucune donnée de test ne reste.
- **Après chaque changement de base ou de droits, relancer toute la suite.** Si un test casse, se demander d'abord si c'est le code ou le test qui a tort.
- Ajouter un test : copier un fichier existant (début `begin;`, `\ir _fixture.sql`, `select * from no_plan();` ; fin `select * from finish();` puis `rollback;`), le numéroter à la suite. `run.sh` le prend tout seul.
- Les écrans ne sont pas couverts par des tests automatiques : les parcours se testent à la main (`docs/plan-mise-en-production.md`, étape 1).

---

## 11. Où regarder quand quelque chose ne marche pas

| Symptôme | Où regarder |
|---|---|
| Erreur 500, page blanche en ligne | Vercel → Deployments → le déploiement → **Logs** |
| Pages lentes | Région des fonctions dans le résumé du déploiement Vercel : doit être `dub1`, comme `vercel.json`, à côté de la base (Irlande) |
| Erreur d'une fonction SQL ou d'un droit | Message affiché à l'écran, puis Supabase → Logs → Postgres |
| Notification absente | Supabase → Edge Functions → `envoyer-notification` → **Logs** ; table `notifications` (la ligne existe ? `delivered_at` rempli ?) |
| Mail absent | Resend → **Emails** (historique, statut de chaque envoi) |
| Push absent | Table `push_tokens` (l'appareil est-il enregistré ?), réglage « Notifications sur cet appareil », https |
| Rappels d'entretien absents | Supabase → Database → **Cron** (historique des exécutions de 7 h) |
| Photos | Supabase → **Storage** → `photos` (fichiers, quota de 1 Go) |
| Connexion refusée | Supabase → Authentication → Users, et URL Configuration |
| Erreur JavaScript sur un téléphone, en développement | `tail -f .next/dev/logs/next-development.log` (Next y recopie la console du navigateur) |

---

## 12. Pièges déjà rencontrés (et leur solution)

| Symptôme | Cause | Solution |
|---|---|---|
| Sur téléphone en `http://192.168…` : page inerte, rien ne réagit | Next bloque les scripts de dev venant d'une autre origine | `allowedDevOrigins: ["192.168.11.*"]` dans `next.config.ts` (joker, pas de `/24`). Redémarrer `next dev` |
| Sur téléphone en http : « Copier », push, installation ou photos en échec | Ces fonctions du navigateur n'existent qu'en **https** | Tester sur l'adresse de prévisualisation Vercel (https). Le code a des solutions de repli pour copier et pour les photos, pas pour le push |
| Vercel : « 500 Middleware » dès l'accueil | Variables absentes pour cet environnement (Preview ou Production) | `bash scripts/vercel-env.sh` (ou `… production`), puis **Redeploy** |
| « API key not valid » (Firebase) | Valeur collée avec guillemets, espace ou virgule | Une valeur seule par variable. Le script `vercel-env.sh` nettoie les valeurs |
| Une variable `NEXT_PUBLIC_` changée n'est pas prise en compte | Elle est intégrée au moment de la construction | Redéployer (Vercel) ou relancer `npm run dev` |
| `supabase db push` : « Remote migration versions not found » | Commande lancée depuis le mauvais dossier ou la mauvaise branche | `cd gmao-chitir`, `git branch --show-current`. **Pas de `migration repair`** |
| `supabase db push` part sur le mauvais projet | `supabase link` pointe sur un autre projet (après la remise au client, par exemple) | `cat supabase/.temp/project-ref` avant chaque `db push` |
| « permission denied for function » | `grant execute … to authenticated` manquant | L'ajouter dans une nouvelle migration |
| « unsafe use of new value » (enum) | Valeur ajoutée et utilisée dans la même migration | Séparer en deux migrations |
| Nouvelles classes Tailwind sans effet | Feuille de style du serveur de dev pas à jour | Redémarrer `npm run dev`, recharger la page |
| Bouton « ordinateur » visible aussi sur mobile | `hidden lg:inline-flex` combiné à `buttonClass()` (qui contient déjà `inline-flex`) | Utiliser `max-lg:hidden` |
| La page déborde à droite sur mobile | Grille sans colonnes définies : la colonne prend la largeur du texte le plus long | `grid-cols-1` sur la grille, `min-w-0` sur les enfants |
| « Je ne reçois pas la notification » | On n'est **jamais prévenu de sa propre action** ; réglage coupé dans Mes alertes ; push pas activé sur l'appareil ; iPhone non installé | Tester avec deux comptes, vérifier Mes alertes et « Notifications sur cet appareil » |
| « Tous les mails arrivent chez moi » | Resend sans domaine vérifié : envoi seulement à l'adresse du compte | Normal en mode test. Voir section 14 |
| Marque ou technicien tapé puis perdu à l'enregistrement | `components/ui/combobox.tsx` efface le texte non choisi dans la liste | Toucher la suggestion. Correction prévue : `docs/taches-restantes.md`, T3 |
| En local, envoi de photo en erreur 500 (`42P10`, « no unique or exclusion constraint matching the ON CONFLICT ») | Pile Docker locale incohérente : le schéma Storage est plus récent que l'image `storage-api` (constaté le 2026-10-06). Ne concerne pas l'hébergé | Tester les photos sur l'adresse de prévisualisation (hébergé). Piste pour réparer le local, non essayée : mettre à jour la Supabase CLI, puis `supabase stop --no-backup && supabase start` (efface les données locales) |
| Le build échoue avec « Symlink … points out of the filesystem root » | Turbopack refuse un `node_modules` en lien symbolique | Faire un vrai `npm ci` dans la copie du projet |
| La production ne correspond pas à `main` vu en local | Référence locale pas à jour | `git fetch origin` puis `git log origin/main` |

---

## 13. Tester sur un téléphone

- **Rapide, sans https** : `npm run dev`, puis sur le téléphone (même Wi-Fi) `http://<IP du PC>:3000`. IP du PC : `ip -4 addr`. Pas de push, pas d'installation.
- **Réaliste, en https** : pousser `staging`, ouvrir l'adresse de prévisualisation Vercel sur le téléphone. C'est là qu'il faut valider photos, push et installation.
- **Deux comptes** pour les notifications : on n'est jamais prévenu de sa propre action.
- **Voir les erreurs du téléphone sur le PC** (développement) : `tail -f .next/dev/logs/next-development.log`. Appareils connectés : `ss -tn state established '( sport = :3000 )'`.
- **Simuler un téléphone sur le PC** : Chrome → outils de développement (F12) → icône téléphone, largeur 390 px (et 360 px pour les petits écrans).

---

## 14. Mails : passer de mon e-mail à celui du client

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

Remise complète des comptes au client (Supabase, Vercel, Firebase, Resend, GitHub) : `docs/taches-restantes.md`, T8.

---

## 15. Commandes utiles

```bash
# Local
supabase start | supabase stop | supabase status
npm run dev
supabase migration new nom
supabase migration up --local
supabase db reset                       # base LOCALE seulement : recrée tout
bash supabase/tests/run.sh

# Base hébergée (depuis gmao-chitir, bonne branche, bon projet lié)
cat supabase/.temp/project-ref          # projet visé
supabase migration list                 # comparer local et hébergé
supabase db push --dry-run              # voir ce qui partirait
supabase db push
supabase db dump -f sauvegarde.sql      # sauvegarde (hors dépôt)

# Edge Function et secrets
supabase functions deploy envoyer-notification
supabase functions list                 # version déployée
supabase secrets list                   # noms seulement
supabase secrets set NOM="valeur"

# Vercel
vercel link
vercel ls gmao-chitir                   # déploiements
vercel env ls                           # variables (noms)
bash scripts/vercel-env.sh [production]
vercel logs <adresse-du-déploiement>

# Git
git checkout staging && git pull
git fetch origin && git log --oneline origin/main -5
git push
```

---

## 16. Next.js 16 : ce qui diffère des tutoriels habituels

- Le middleware s'appelle **`proxy.ts`** (fonction `proxy`).
- `error.tsx` reçoit `retry` (et non plus `reset`).
- Les pages reçoivent des props typées `PageProps<"/chemin">`, et `params` et `searchParams` sont des promesses (`await props.searchParams`).
- `next dev` écrit dans `.next/dev/` (et non `.next/`) ; on peut donc lancer `next build` pendant que le serveur de dev tourne. Son journal est `.next/dev/logs/next-development.log`.
- La documentation exacte de la version installée est dans `node_modules/next/dist/docs/` : c'est la seule qui fait foi (voir `AGENTS.md`).

---

## 17. Les autres documents

| Document | Contenu |
|---|---|
| `docs/taches-restantes.md` | État au 2026-10-08, tâches restantes et marche à suivre |
| `docs/plan-module-consommables.md` | Plan d'implémentation et de livraison du module Consommables (stock des restaurants) |
| `docs/remise-client.md` | Remise au client pas à pas : production, transfert Supabase, compte propriétaire, mails, Vercel |
| `docs/base-de-donnees.md` | Tables, types, fonctions SQL, triggers, droits, migrations |
| `docs/README.md` | Installation, variables, base, tests, notifications, déploiement, rôles et droits |
| `docs/journal-decisions.md` | Chaque décision datée : quoi, pourquoi, ce qui a été écarté |
| `docs/guide-presentation-client.md` | Déroulé de la démonstration au client |
| `docs/plan-mise-en-production.md` | Seconde recette et liste de contrôle avant la mise en production |
| `docs/plan-corrections-mobile.md` | Corrections après la recette mobile du 2026-09-30 (toutes faites) |
| `docs/plan-recette-agents.md`, `docs/recette/` | Méthode et rapports de la première recette (tests, sécurité, conformité, corrections) |
| `docs/modele-donnees-proposition.md` | Modèle de données d'origine (historique ; l'état réel est dans `docs/base-de-donnees.md`) |
| `docs/maquettes-resume.md` | Résumé des maquettes (les maquettes découpées sont dans `../maquettes/`) |
