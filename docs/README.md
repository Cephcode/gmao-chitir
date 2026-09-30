# GMAO Chitir Chicken : guide d'exploitation

Application de suivi des pannes, entretiens et pièces des restaurants Chitir Chicken.
Next.js 16 (App Router) sur Vercel, Supabase (Postgres, Auth, Edge Function), Firebase (push), Resend (mails).
Décisions et historique : `docs/journal-decisions.md`.

## 1. Installation locale

Prérequis : Node 20 ou plus, Docker, Supabase CLI.

```bash
cd gmao-chitir
npm install
supabase start        # base locale dans Docker, toutes les migrations appliquées
npm run dev           # http://localhost:3000
```

Autres scripts (`package.json`) : `npm run build`, `npm run start`, `npm run lint`.

**Tester depuis un téléphone du réseau local** : Next bloque par défaut les ressources de dev demandées depuis une autre origine. Ajouter l'adresse du poste dans `next.config.ts` :

```ts
const nextConfig: NextConfig = { allowedDevOrigins: ["<IP du poste sur le réseau>"] };
```

Puis ouvrir `http://<IP du poste>:3000` sur le téléphone. Ce réglage ne sert qu'en développement.
Note : il n'est pas présent dans `next.config.ts` à ce jour.

**Base visée en local** : l'application lit `NEXT_PUBLIC_SUPABASE_URL`. Selon le fichier `.env*` utilisé, elle pointe sur la base locale (Docker) ou sur la base hébergée. La base hébergée contient les vraies données : ne jamais y écrire de données de test.

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

## 4. Tests

Toujours sur la base **locale** (`supabase start` avant).

```bash
bash supabase/tests/run.sh            # tout : scénarios SQL (pgTAP), concurrence, node --test
bash supabase/tests/run.sh 01_stock   # un seul scénario SQL
```

- Résultat attendu à la fin de la recette : **471 réussis, 0 échoué**.
- Scénarios SQL dans `supabase/tests/`, chacun en transaction annulée : aucune donnée ne reste, rien n'est envoyé. Le script vérifie à la fin qu'aucune donnée de test ne reste.
- Règles pures (droits d'administration, entretien) : `tests/*.test.ts`, lancés par `node --test` depuis le script.
- Le script refuse de tourner si le conteneur Docker local est absent.

## 5. Tâche quotidienne (pg_cron)

- Fonction SQL `taches_quotidiennes()`, planifiée par pg_cron (tâche `gmao-taches-quotidiennes`, `0 7 * * *`, soit 7 h UTC, 7 h à Ouagadougou).
- Produit « entretien à prévoir » (3 jours avant) et « entretien en retard » (chaque matin), selon les réglages de chacun. Rejouable sans doublon.
- Pas de route cron HTTP ni de cron Vercel.
- Vérifier dans la console : Database, Cron (historique des exécutions).

## 6. Envoi des notifications

1. Une ligne est ajoutée dans `notifications` (panne, clôture, stock, tâche du matin).
2. Le trigger `trg_notifications_envoi` appelle l'Edge Function `envoyer-notification` via pg_net, après validation de la transaction.
3. La fonction réserve la notification (`delivered_at`) : un seul envoi, un id inconnu ou déjà envoyé ne fait rien. C'est pourquoi elle tourne sans jeton (`verify_jwt = false` dans `supabase/config.toml`).
4. Push Firebase vers tous les appareils du destinataire. Mail Resend pour les urgences et les pannes seulement.

Déployer la fonction : `supabase functions deploy envoyer-notification`.
Journaux : console Supabase, Edge Functions, Logs (aucune donnée personnelle n'y est écrite).

**Mode test Resend** : tant que le domaine n'est pas vérifié, Resend n'envoie qu'à l'adresse du compte. `RESEND_TEST_RECIPIENT` redirige tous les mails vers elle, avec le vrai destinataire écrit en tête du mail.

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
- iPhone : push seulement si l'application est ajoutée à l'écran d'accueil.
- Application ouverte au premier plan : pas de bannière système, l'alerte reste dans la cloche.

## 8. Déploiement (Vercel)

- Projet Vercel relié au dépôt Git. Adresse : celle de `APP_URL`.
- Variables : section 2, à saisir dans Vercel pour chaque environnement utile (Production, Preview).
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
- **Inscription libre désactivée** (`enable_signup = false` dans `supabase/config.toml`, et désactivée dans la console pour l'hébergé). Les comptes sont créés dans Administration, avec un mot de passe temporaire affiché une seule fois, à changer à la première connexion.

## 11. Rôles et droits

Le restaurant décide des données visibles, le rôle décide des actions. Contrôlé en base (RLS et fonctions), pas seulement à l'écran.

| Action | Propriétaire | Éditeur | Commentateur (technicien) | Lecteur |
|---|---|---|---|---|
| Consulter ses restaurants | oui (tous) | oui | oui | oui |
| Déclarer une panne | oui | oui | oui | oui |
| Créer, modifier équipement, pièce, catégorie, marque | oui | oui | non | non |
| Mouvement de stock (livraison, correction) | oui | oui | non | non |
| Modifier une intervention en cours, clôturer | oui | oui | oui | non |
| Noter un entretien comme fait | oui | oui | oui | non |
| Supprimer (équipement, pièce, catégorie, marque, plan) | oui | non | non | non |
| Administration, comptes | oui (tous) | oui : éditeurs, commentateurs, lecteurs de ses restaurants | non | non |
| Administration, restaurants | oui | non | non | non |
| Rappels d'entretien (tâche du matin) | oui | oui | oui | non |

Garde-fous des comptes : un propriétaire a toujours accès à tous les restaurants ; un éditeur ne crée jamais de propriétaire ni d'accès « tous les restaurants » ; personne ne change son propre rôle ni ne supprime son compte ; il reste toujours au moins un propriétaire.
Un compte d'authentification sans profil dans `users` ne lit ni n'écrit rien.
