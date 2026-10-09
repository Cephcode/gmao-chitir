# GMAO Chitir Chicken : guide d'exploitation

Application de suivi des pannes, entretiens et pièces des restaurants Chitir Chicken.
Next.js 16 (App Router) sur Vercel, Supabase (Postgres, Auth, Edge Function), Firebase (push), Resend (mails).
Mis à jour le 2026-10-08.

- **État du projet et tâches restantes** (dont la remise des comptes au client) : `docs/taches-restantes.md`. **Commencer par là.**
- **Pour modifier le projet** (carte des fichiers, écran par écran, recettes « je veux… », pièges connus) : `docs/guide-developpeur.md`.
- **La base de données** (tables, fonctions SQL, droits, migrations) : `docs/base-de-donnees.md`.
- Décisions et historique : `docs/journal-decisions.md`.
- Pour présenter l'application au client : `docs/guide-presentation-client.md`.

## 1. Installation locale

Prérequis : Node 20 ou plus, Docker, Supabase CLI.

```bash
cd gmao-chitir
npm install
supabase start        # base locale dans Docker, toutes les migrations appliquées
npm run dev           # http://localhost:3000
```

Autres scripts (`package.json`) : `npm run build`, `npm run start`, `npm run lint`.

**Tester depuis un téléphone du réseau local** : Next bloque par défaut les scripts de dev demandés depuis une autre origine (la page s'affiche mais reste inerte). `next.config.ts` autorise le réseau du poste avec un joker :

```ts
allowedDevOrigins: ["192.168.11.*"],   // nom exact ou joker « * » ; la notation /24 n'est pas reconnue
```

À adapter si le réseau change, puis ouvrir `http://<IP du poste>:3000` sur le téléphone. Ce réglage ne sert qu'en développement.
⚠️ En `http`, le téléphone n'a ni push, ni installation, ni presse-papiers moderne. Pour tester ces fonctions, utiliser l'adresse https de prévisualisation Vercel (section 8).

**Base visée en local** : l'application lit `NEXT_PUBLIC_SUPABASE_URL`. Aujourd'hui, `.env.development.local` pointe sur la base **hébergée**, qui contient les vraies données du client : ne jamais y écrire de données de test. Pour lancer l'application sur la base locale (Docker) sans toucher à ce fichier : `docs/guide-developpeur.md`, section 7.

## 2. Variables d'environnement

Noms seulement. Aucune valeur dans le dépôt ni dans cette doc. Les fichiers `.env*` sont hors dépôt.

**Piège du format** : saisir chaque valeur **seule**, sans guillemets, sans virgule, sans espace. Ne pas coller le bloc JavaScript de la console Firebase tel quel (erreur « API key not valid » constatée le 2026-09-30).

### Application Next.js (Vercel, et `.env.development.local` en local)

| Nom | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de base du projet Supabase (sans `/rest/v1/`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (navigateur et serveur, soumise aux RLS). |
| `SUPABASE_SECRET_KEY` | Clé secrète, serveur seulement (`lib/supabase/admin.ts`) : création et gestion des comptes. Jamais en `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Configuration Firebase publique (push). |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | idem |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | idem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | idem (sans le `measurementId` collé derrière) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Clé publique Web Push, pour obtenir le jeton de l'appareil. |

Le build de production ne lit pas `.env.development.local` : tout doit être saisi dans Vercel.

### Edge Function `envoyer-notification` (secrets Supabase)

À enregistrer avec `supabase secrets set NOM=...` (ou dans la console, Edge Functions, Secrets).

| Nom | Rôle |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Fournis automatiquement par Supabase. Rien à faire. |
| `APP_URL` | Adresse publique de l'application, pour les liens des mails et des push. |
| `RESEND_API_KEY` | Clé d'API Resend. Sans elle, aucun mail ne part. |
| `RESEND_TEST_RECIPIENT` | Mode test : si défini, tous les mails partent vers cette adresse (celle du compte Resend). |
| `RESEND_FROM_PRESENTATION` | Expéditeur de la version de présentation (domaine du développeur vérifié chez Resend). |
| `RESEND_FROM_PRODUCTION` | Expéditeur du client (son domaine vérifié). Vide jusqu'à la remise ; dès qu'il est défini, il remplace celui de présentation. Sans aucun des deux : adresse de test Resend. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Compte de service Firebase : JSON brut ou encodé en base64. Sans lui, aucun push ne part. |

## 3. Base de données

- Migrations : `supabase/migrations/`, appliquées dans l'ordre des noms. Toute modification de la base passe par une nouvelle migration, testée en local d'abord (`supabase db reset` ou `supabase migration up`).
- Envoi sur la base hébergée : `supabase db push`, lancé **depuis le dossier `gmao-chitir`**, sur la **bonne branche Git** (celle dont on veut les migrations), après feu vert du développeur. Vérifier avant et après avec `supabase migration list`.
- **Ne jamais lancer `supabase migration repair`** sans comprendre l'écart : cette commande change l'historique des migrations sans rien appliquer, et peut faire croire qu'une migration est passée.
- **Nouvelles fonctions SQL** : depuis la migration `20260930220000`, les droits par défaut sont fermés à `public` et `anon`. Toute fonction appelée par l'application ou par une politique RLS doit porter :
  ```sql
  grant execute on function public.ma_fonction(...) to authenticated;
  ```
  Sans cette ligne, l'appel est refusé.
- Les écritures sur plusieurs tables (déclarer, clôturer, entretien, stock, ajout de restaurant) passent par des fonctions `SECURITY DEFINER` qui vérifient rôle et restaurant.
- **Photos d'intervention** : bucket Storage `photos`, **privé** (migration `20260930230300`), affiché par des URL signées d'une heure. Chemin `{restaurant_id}/{intervention_id}/{uuid}.jpg`, photos réduites à 1600 px en JPEG dans le navigateur (quelques centaines de Ko). Le plan gratuit de Supabase donne **1 Go de Storage** : surveiller l'usage dans la console (Storage). Limite de 3 photos « avant » et 3 « après » par intervention, à changer à deux endroits : `PHOTOS_MAX_PAR_TYPE` dans `lib/photos.ts` et la fonction SQL `photos_max_par_type()` (nouvelle migration).
- Le trigger d'envoi appelle l'adresse de l'Edge Function **hébergée**, écrite dans la migration `20260930190000`. En local, une notification validée déclenche donc un appel vers l'hébergé, qui ne trouve pas l'id et ne fait rien.
  ⚠️ Cette adresse est celle du projet actuel (`jmxeewnhthhlutqgeixj`). **Sur un autre projet Supabase, les notifications ne partiraient pas.** Correction (adresse lue dans le Vault) : `docs/taches-restantes.md`, T2.

## 4. Tests

Toujours sur la base **locale** (`supabase start` avant).

```bash
bash supabase/tests/run.sh            # tout : scénarios SQL (pgTAP), concurrence, node --test
bash supabase/tests/run.sh 01_stock   # un seul scénario SQL
```

- Résultat attendu au 2026-10-06 : **677 réussis, 0 échoué**.
- Fichiers : `01_stock`, `02_cloture`, `03_entretien`, `04_droits` (matrice rôle × action), `06_notifications`, `07_restaurant`, `08_statuts`, `09_categories`, `10_photos`, `11_comptes`, `12_retours_client`, `concurrence.sh`. Ce que vérifie chacun : `docs/guide-developpeur.md`, section 10.
- Scénarios SQL dans `supabase/tests/`, chacun en transaction annulée : aucune donnée ne reste, rien n'est envoyé. Le script vérifie à la fin qu'aucune donnée de test ne reste.
- Règles pures (droits d'administration, entretien, catégories, photos) : `tests/*.test.ts`, lancés par `node --test` depuis le script.
- Le script refuse de tourner si le conteneur Docker local est absent.

## 5. Tâche quotidienne (pg_cron)

- Fonction SQL `taches_quotidiennes()`, planifiée par pg_cron (tâche `gmao-taches-quotidiennes`, `0 7 * * *`, soit 7 h UTC, 7 h à Ouagadougou).
- Produit « entretien à prévoir » (3 jours avant) et « entretien en retard » (chaque matin), selon les réglages de chacun. Rejouable sans doublon.
- Pas de route cron HTTP ni de cron Vercel.
- Vérifier dans la console : Database, Cron (historique des exécutions).

## 6. Envoi des notifications

1. Une ligne est ajoutée dans `notifications` (panne, clôture, stock, changement de statut, technicien attribué, tâche du matin).
2. Le trigger `trg_notifications_envoi` appelle l'Edge Function `envoyer-notification` via pg_net, après validation de la transaction.
3. La fonction réserve la notification (`delivered_at`) : un seul envoi, un id inconnu ou déjà envoyé ne fait rien. C'est pourquoi elle tourne sans jeton (`verify_jwt = false` dans `supabase/config.toml`).
4. Push Firebase vers tous les appareils du destinataire. Mail Resend pour les urgences, les pannes et les attributions seulement (`EMAIL_TYPES` dans la fonction).

Déployer la fonction : `supabase functions deploy envoyer-notification`.
Journaux : console Supabase, Edge Functions, Logs (aucune donnée personnelle n'y est écrite).

**Mode test Resend** : tant que le domaine n'est pas vérifié, Resend n'envoie qu'à l'adresse du compte. `RESEND_TEST_RECIPIENT` redirige tous les mails vers elle, avec le vrai destinataire écrit en tête du mail.
Pour que ce soit le client qui reçoive ces mails (présentation, remise) : son propre compte Resend, sa clé dans `RESEND_API_KEY` et son e-mail dans `RESEND_TEST_RECIPIENT` (détail : `docs/guide-developpeur.md`, section 10).

### Passer Resend en envoi réel

1. Dans Resend : ajouter le domaine et poser les enregistrements DNS demandés (SPF, DKIM), attendre l'état « vérifié ». Un domaine `….vercel.app` ne convient pas (DNS non modifiables). Le plan gratuit accepte un seul domaine.
2. Version de présentation : `supabase secrets set RESEND_FROM_PRESENTATION="GMAO Chitir <alertes@mon-domaine>"`.
   Remise au client : vérifier son domaine dans Resend (dans son compte Resend, ou remplacer le domaine du développeur sur le plan gratuit), puis `supabase secrets set RESEND_FROM_PRODUCTION="GMAO Chitir <alertes@domaine-client>"`. Aucun code à changer.
3. Supprimer le secret `RESEND_TEST_RECIPIENT` (`supabase secrets unset RESEND_TEST_RECIPIENT`).
4. Déclarer une panne de test et vérifier la réception par le vrai destinataire.

## 7. Push dans le navigateur

- Service worker `/firebase-messaging-sw.js`, généré par une route Next (`app/firebase-messaging-sw.js/route.ts`) avec la configuration Firebase publique.
- Activation **par appareil** : Notifications, Mes alertes, « Notifications sur cet appareil ». Le jeton est enregistré dans `push_tokens`. « Couper sur cet appareil » le supprime.
- À la **déconnexion**, le navigateur retire son propre jeton : sur un appareil partagé, les alertes du compte précédent n'arrivent plus. Les autres appareils du compte ne changent pas.
- **https obligatoire** : sans https (par exemple `http://192.168…`), le navigateur désactive le service worker, donc aucun push, même application installée.
- Application installable (`app/manifest.ts`) : bandeau « Installer l'application » (bouton sur Android, consigne Partager → Sur l'écran d'accueil sur iPhone).
- iPhone : push seulement si l'application est ajoutée à l'écran d'accueil, puis ouverte depuis son icône.
- **On n'est jamais prévenu de sa propre action** : pour tester, agir avec un compte et recevoir sur un autre.
- Application ouverte au premier plan : pas de bannière système, l'alerte reste dans la cloche.

## 8. Déploiement (Vercel)

- Projet Vercel relié au dépôt Git. Production : `https://gmao-chitir.vercel.app` (celle de `APP_URL`), construite à chaque fusion dans `main`. Au 2026-10-08, elle contient `main` = `staging` du 2026-09-30 (pull request n°1). Le client l'utilise déjà.
- **Région des fonctions : Dublin (`dub1`)**, fixée dans `vercel.json`, à côté de la base Supabase (Irlande, `eu-west-1`). Par défaut, Vercel utilise Washington (`iad1`) : chaque lecture de la base traversait alors l'Atlantique (environ 80 ms, plusieurs fois par page). Le plan gratuit permet une seule région. Si la base change de région, changer aussi celle-ci.
- Variables : section 2, à saisir dans Vercel pour chaque environnement utile (Production, Preview). Le script `bash scripts/vercel-env.sh [production]` les copie depuis `.env.development.local` (après `vercel link`), puis **Redeploy**. Sans elles : erreur « 500 Middleware » dès l'accueil.
- Prévisualisation : chaque branche poussée (ex. `staging`) a son adresse https `gmao-chitir-…-cephcodes-projects.vercel.app`. L'ajouter aux Redirect URLs de Supabase (Authentication → URL Configuration), par exemple `https://gmao-chitir-*-cephcodes-projects.vercel.app/**`.
- Règle de travail : changement important commité sur `staging`, testé ensemble, puis fusion dans `main`.
- Ordre conseillé pour une livraison qui touche la base : migrations (`supabase db push`), puis Edge Function si modifiée, puis fusion dans `main`.

## 9. Sauvegardes Supabase

- Vérifier dans la console (Database, Backups) ce que le plan inclut et la durée de conservation.
- Copie manuelle, par exemple avant une migration risquée :
  ```bash
  supabase db dump -f sauvegarde-schema.sql
  supabase db dump --data-only -f sauvegarde-donnees.sql
  ```
- Ces fichiers contiennent des données personnelles : les garder hors du dépôt.
- Ces copies ne contiennent pas les fichiers du bucket `photos` (seulement leurs lignes) : les télécharger depuis la console (Storage) si besoin.

## 10. Comptes et connexion

- Connexion par e-mail et mot de passe uniquement.
- **Pas de « mot de passe oublié » en libre-service** (retiré le 2026-09-30) : la personne demande au propriétaire ou à son éditeur, qui génère un nouveau mot de passe temporaire dans Administration, fiche du compte.
- **Inscription libre désactivée** (`enable_signup = false` dans `supabase/config.toml`, et désactivée dans la console pour l'hébergé). Les comptes sont créés dans Administration, avec un mot de passe temporaire affiché une seule fois, à changer à la première connexion.

## 11. Rôles et droits

Le restaurant décide des données visibles, le rôle décide des actions. Contrôlé en base (RLS et fonctions), pas seulement à l'écran.

| Action | Propriétaire | Éditeur | Commentateur (technicien) | Lecteur |
|---|---|---|---|---|
| Consulter ses restaurants | oui (tous) | oui | oui | oui |
| Déclarer une panne | oui | oui | oui | oui |
| Créer, modifier équipement, pièce, catégorie, marque | oui | oui | non | non |
| Choisir l'état de l'intervention à la déclaration | oui | oui | oui | non (« À planifier » imposé) |
| Créer une intervention de tout type (« Nouvelle intervention ») | oui | oui | oui | non (« Déclarer une panne » à la place) |
| Être choisi comme technicien d'une intervention | oui | oui | oui | non |
| Changer le statut d'une intervention (hors « Terminée ») | oui | oui | oui | non |
| Photos « avant » (intervention ouverte) | oui | oui | oui | oui |
| Photos « après » (intervention terminée, ou à la clôture) | oui | oui | oui | non |
| Retirer une photo | oui | oui | la sienne | la sienne |
| Mouvement de stock (livraison, correction) | oui | oui | non | non |
| Modifier une intervention ouverte (travail fait, technicien), clôturer | oui | oui | oui | non |
| Noter un entretien comme fait | oui | oui | oui | non |
| Supprimer (équipement, pièce, marque, plan) | oui | non | non | non |
| Supprimer une catégorie (seulement si aucune machine) | oui | oui | non | non |
| Administration, comptes | oui (tous) | oui : éditeurs, commentateurs, lecteurs de ses restaurants | non | non |
| Administration, restaurants | oui | non | non | non |
| Administration, catégories | oui | oui | non | non |
| Rappels d'entretien (tâche du matin) | oui | oui | oui | non |

Garde-fous des comptes : un propriétaire a toujours accès à tous les restaurants ; un éditeur ne crée jamais de propriétaire ni d'accès « tous les restaurants » ; personne ne change son propre rôle ni ne supprime son compte ; il reste toujours au moins un propriétaire.
Un compte d'authentification sans profil dans `users` ne lit ni n'écrit rien.

## 12. Interventions, photos, catégories

- **Statuts** : À planifier, En cours, En attente de pièce, Terminée. « Terminée » ne s'obtient **que par la clôture** (bouton Clôturer), qui décompte le stock, met à jour la machine et la fiche de vie, et prévient le déclarant. Une intervention terminée ne se rouvre pas. Chaque changement de statut (`changer_statut_intervention`) prévient le déclarant (réglage « Suivi de mes pannes »). L'onglet « En cours » regroupe tout ce qui n'est pas terminé (libellé demandé par le client). Libellés : `lib/intervention-status.ts`.
- **Photos** : 3 « avant » et 3 « après » par intervention, compressées dans le navigateur, bucket privé `photos` (section 3). Changer la limite : `lib/photos.ts` **et** `photos_max_par_type()` en SQL.
- **Types d'intervention** (2026-10-06) : Réparation (`correctif`), Entretien préventif (`preventif`), Contrôle (`controle`), Installation ou amélioration (`amelioration`). « Nouvelle intervention » (bouton de la liste, ou fiche d'une machine) pour propriétaire, éditeur et commentateur. Une réparation a les effets d'une panne déclarée (machine en panne, équipe prévenue) ; les autres types ne changent pas l'état de la machine. Dans la liste, la puce « Type » filtre le type d'intervention, la puce « Priorité » filtre Urgence, Normal, Alerte.
- **Technicien attribué** : choisi à la création ou dans la fiche (liste avec recherche). Il reçoit la notification « Intervention attribuée » (application, push, mail), sauf s'il se choisit lui-même.
- **Machines** : nom unique dans un restaurant (majuscules, accents et espaces ignorés) ; le même nom reste possible dans deux restaurants, c'est le code qui les distingue. Date d'installation : date du jour si on la laisse vide. Fréquences d'entretien : jour, semaine, mois, 3 mois, 6 mois, an.
- **Catégories** : Administration, puis Catégories (propriétaire et éditeur). Nom unique, code de 3 lettres (sert aux futurs codes machines, le changer ne renomme pas les machines existantes), icône au choix. Suppression refusée par la base si une machine l'utilise.
