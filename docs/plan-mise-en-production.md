# Plan de mise en production

> **Où en est ce plan (2026-10-08)**
> - « Risque à lever en premier » : **réglé**. `staging` a été poussé et fusionné dans `main` (pull request n°1, 2026-09-30). La production tourne sur ce code, et le client l'utilise.
> - Étape 0 : `staging` est sur GitHub ; il reste à tester sur l'adresse de prévisualisation https.
> - Étapes 1 à 6 (seconde recette par les agents, `docs/recette-2/`) : **pas faites**. Une recette rapide a été faite le 2026-10-06 (résultat dans `docs/taches-restantes.md`, section 1).
> - Étape 7 : `@vercel/analytics` retiré (fait). Le reste est à faire.
> - Depuis : retours de la présentation client du 2026-10-06, pas encore commités.
>
> L'ordre de travail à jour, avec les commandes, est dans **`docs/taches-restantes.md`**. Ce plan reste la liste de contrôle détaillée.

Objectif : s'assurer que `staging` est assez robuste pour la production, **sans tout refaire**. La première recette (`docs/plan-recette-agents.md`, rapports dans `docs/recette/`) a couvert l'application jusqu'au rapport de conformité (commit `5838cc6`). Depuis, 39 commits, 91 fichiers et 5 migrations ont été ajoutés : les statuts d'intervention, les photos, l'écran Catégories, l'application installable et les correctifs mobiles (`docs/plan-corrections-mobile.md`).
Cette seconde recette porte donc sur **ce delta**, sur la **non-régression** et sur les **prérequis de production** (configuration, données, sauvegardes).

Même méthode que la première fois : les agents passent l'un après l'autre, chacun écrit son rapport, on en discute, puis on passe au suivant. Les règles communes de `docs/plan-recette-agents.md` (l.6-17) restent valables. Les rapports vont dans `docs/recette-2/`.

## Risque à lever en premier

- **Constat** : `staging` n'a jamais été poussé sur GitHub, et `main` sur GitHub en est resté au commit `e48fe4e` (« first step »). La base hébergée, elle, a reçu toutes les migrations de `staging`, dont la suppression de l'ancienne signature de `declarer_panne`.
- **Conséquence** : si Vercel déploie `main` en production et que quelqu'un l'utilise, cette version est **incompatible avec la base** (déclaration de panne en échec, par exemple).
- **À vérifier par le développeur** : l'adresse de production est-elle déjà utilisée par le client ? Si oui, on accélère la mise en production. Sinon, on le note et on continue.

## Étape 0 : un environnement de test en https

Les tests sur téléphone en `http://192.168…` ont masqué ou créé plusieurs bugs : le presse-papiers, le push, l'installation et les identifiants de photos. La recette mobile doit se faire **en https**, dans les conditions réelles.

1. Pousser `staging` sur GitHub (après accord). Vercel crée alors une adresse de prévisualisation https pour la branche.
2. Dans Vercel, vérifier que les variables d'environnement (voir `.env.example`) sont définies aussi pour « Preview ».
3. Dans Supabase → Authentication → URL Configuration, ajouter l'adresse de prévisualisation aux Redirect URLs.
4. Dans Firebase → Authentication → Authorized domains, ajouter le domaine de prévisualisation s'il est demandé (push).
5. Sur chaque téléphone, désinstaller l'application installée depuis `http://192.168…` et la réinstaller depuis l'adresse https.

## Étape 1 : agent `test`

Rapport : `docs/recette-2/1-tests.md`.

- Relancer toute la suite (`bash supabase/tests/run.sh`, 635 tests à ce jour) et joindre la sortie.
- Compléter les trous restants :
  - **actions serveur** non couvertes (garde-fous d'administration : son propre rôle, dernier propriétaire, délégation de l'éditeur ; changement de statut ; enregistrement des photos ; catégories) ;
  - **comptages** du tableau de bord et du menu avec les nouveaux statuts ;
  - **notifications** « Suivi de mes pannes ».
- Écrire la **liste des parcours manuels** en https, sous forme de cases à cocher, dans `docs/recette-2/parcours-manuels.md` :
  - pour chaque rôle, sur Android, iPhone et ordinateur ;
  - déclarer avec état et photos, changer de statut, clôturer avec photos, stock, catégories, comptes ;
  - notifications et push avec **deux comptes** (on n'est jamais prévenu de sa propre action), installation de l'application, clavier, hors ligne ou erreur.

## Étape 2 : agent `cybersecurite`, audit du delta

Rapport : `docs/recette-2/2-securite.md`.

- **Storage** : politiques du bucket `photos` (chemin, restaurant, intervention), bucket privé, URLs signées, fichiers orphelins, garde-fou contre le remplissage du quota.
- **Nouvelles fonctions** : `ajouter_photo_intervention`, `changer_statut_intervention`, nouvelle `declarer_panne` (droits `execute`, rôle NULL, restaurant, `search_path`).
- **Catégories** : suppression ouverte à l'éditeur, clé étrangère en `restrict`, comptage fait avec la clé secrète côté serveur.
- **Code client** : bandeau d'installation, manifeste exclu du proxy, `randomId`, repli du presse-papiers.
- **Contrôle sur l'hébergé**, par des requêtes en lecture seule fournies au développeur, qui les lance dans le SQL Editor :
  - fonctions exécutables par `anon` ;
  - politiques ouvertes ;
  - tâche pg_cron active ;
  - bucket privé.
- Revoir les points reportés de la première recette (S-B2, S-B4, S-B5, S-B8, S-B9) et dire lesquels deviennent **bloquants pour la production**. Par exemple, les en-têtes de sécurité et la limite de taille des entrées.

## Étape 3 : agent `conformite-ui-ux`, écrans nouveaux ou modifiés

Rapport : `docs/recette-2/3-conformite.md`.

- **Écrans à couvrir** :
  - Déclarer une panne (état obligatoire, photos) ;
  - fiche intervention (statut, photos avant et après) ;
  - clôture (photos) ;
  - liste des interventions (onglet « En cours », filtre Statut, badges) ;
  - Administration → Catégories ;
  - bandeau d'installation ;
  - écrans d'erreur et de chargement ;
  - Mes alertes (« Suivi de mes pannes ») ;
  - menu latéral ;
  - débordements sur mobile.
- **Contrôles** : accessibilité (libellés, cibles de 44 px, focus, lecteurs d'écran pour les photos et le statut), vocabulaire du client (« En cours » conservé), mobile à 390 px.
- **Écarts déjà décidés**, à ne pas signaler : ceux de la première recette, plus C2 et les autres détails reportés.

## Étape 4 : agent `dev-principal`, corrections groupées

Tableau unique dans `docs/recette-2/4-corrections.md` : point, gravité, correction, effort. Il est validé par le développeur avant toute correction.
Ordre des corrections : critique, haute, bloquant d'interface, puis le reste validé. Un commit par correction, les migrations d'abord en local, poussées après accord.

## Étape 5 : contre-vérification

- Je relance moi-même toute la suite de tests.
- L'agent `cybersecurite` repasse seulement si des corrections de sécurité ont été faites.
- Le développeur rejoue la liste des parcours manuels sur l'adresse https de prévisualisation.

## Étape 6 : agent `documentation`

- `docs/README.md` :
  - statuts d'intervention ;
  - photos : bucket, limites et où les changer ;
  - catégories ;
  - application installable et push (https obligatoire, deux comptes pour tester) ;
  - **procédure de mise en production et de retour arrière**.
- Mettre à jour le journal des décisions.

## Étape 7 : préparation de la production (développeur, avec mon aide)

**Supabase (hébergé)**
- [ ] **Sauvegarde avant la mise en production** : `supabase db dump`, et téléchargement du bucket `photos` (le dump ne contient pas les fichiers).
- [ ] **Nettoyage des données de test** créées pendant la recette sur la base hébergée : pannes, interventions, photos, catégories, comptes de test. Je fournirai des requêtes de repérage en lecture seule, et le développeur valide ce qui est supprimé.
- [ ] **Authentication** :
  - inscription libre désactivée (fait) ;
  - mot de passe de 8 caractères minimum ;
  - Site URL et Redirect URLs réglées sur l'adresse de production.
  - (Pas de modèle « mot de passe oublié » à traduire : fonction retirée, décision du 2026-09-30.)
- [ ] **Tâche pg_cron** `taches_quotidiennes` active (`select * from cron.job`).
- [ ] **Edge Function** `envoyer-notification` : bien déployée, et secret `APP_URL` = adresse de production.

**Resend**
- [ ] Domaine d'envoi vérifié, `RESEND_FROM_PRESENTATION` réglé (puis `RESEND_FROM_PRODUCTION` à la remise), `RESEND_TEST_RECIPIENT` **supprimé**. Tant que ce n'est pas fait, tous les mails partent vers une seule boîte.

**Firebase**
- [ ] Domaine de production autorisé, push testé sur l'adresse de production.

**Vercel**
- [ ] Variables de production complètes (`.env.example`), variables inutiles retirées.
- [ ] Branche de production = `main`.
- [ ] `@vercel/analytics` : l'activer (`<Analytics />`) ou retirer l'import inutilisé.

**Application**
- [ ] Logo en haute définition pour les icônes (actuellement agrandies depuis 180 px).
- [ ] Dépôt GitHub : privé, sinon réécrire l'historique (e-mail présent dans un ancien commit).

## Étape 8 : mise en production

1. **Critères de passage** (tous requis) :
   - aucun point critique ou haut ouvert ;
   - suite de tests entièrement verte ;
   - parcours manuels cochés sur Android, iPhone et ordinateur ;
   - push reçu sur deux appareils ;
   - sauvegarde faite.
2. Ouvrir une pull request `staging` vers `main` sur GitHub, la relire, puis la fusionner (sur accord explicite).
3. Déploiement Vercel automatique, puis **tests de fumée en production** (10 minutes) : connexion, déclarer une panne avec photo, changer de statut, clôturer, push reçu, mail reçu.
4. **Retour arrière** :
   - Vercel : « Promote to Production » sur le déploiement précédent.
   - Base : les migrations ne s'annulent pas. Une correction se fait par une nouvelle migration, et la sauvegarde sert en dernier recours.

## Étape 9 : après la mise en production

- Surveiller la première semaine : journaux Vercel et Supabase, quota du Storage (1 Go sur le plan gratuit), mails qui n'arrivent pas.
- Points reportés, à proposer plus tard :
  - C2 (colonne de connexion sur ordinateur) ;
  - « Rester connecté » ;
  - CAPTCHA ;
  - S-B2, S-B4, S-B8 ;
  - rouvrir une intervention clôturée ;
  - « Nouvelle intervention » sans panne ;
  - mail à la création d'un compte ;
  - plus de photos avec le plan payant.

## Décisions à prendre avant de commencer

1. L'adresse de production est-elle déjà utilisée par le client ? (Voir « Risque à lever en premier ».)
2. Accord pour pousser `staging` sur GitHub, afin d'obtenir l'adresse https de prévisualisation (étape 0) ?
3. Le domaine d'envoi Resend est-il disponible pour la mise en production, ou part-on d'abord en mode test, sans mails aux vrais destinataires ?
