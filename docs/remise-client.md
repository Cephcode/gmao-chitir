# Remise du projet au client

Marche à suivre, dans l'ordre, pour remettre la GMAO au client. Écrite le 2026-10-09.
Choix retenus : **la base Supabase est transférée** dans une organisation au nom du client, et **le compte propriétaire actuel passe à son e-mail** avec un mot de passe temporaire.

Ce qui ne change pas avec un transfert : l'adresse du projet Supabase, ses clés, les données, le code et les variables Vercel. Il n'y a **rien à modifier dans le code**. La tâche T2 de `docs/taches-restantes.md` (adresse en dur) n'est donc pas nécessaire.

---

## Étape 1 : mettre la dernière version en production (avant la remise)

Le travail du 2026-10-06 (nouvelle intervention, technicien, fréquences…) est commité sur `staging`. La base hébergée et l'Edge Function sont déjà à jour : il ne reste que le code.

1. Pousser `staging` :
   ```bash
   cd ~/Bureau/Projets/gmao/webapp/gmao-chitir
   git checkout staging
   git push
   ```
2. Attendre la prévisualisation Vercel (Deployments, environ 2 minutes). L'ouvrir sur un téléphone, se connecter, et vérifier au moins : « Nouvelle intervention » avec un technicien, une déclaration de panne avec photo. ⚠️ C'est la vraie base : travailler sur un restaurant ou une machine de test, puis tout supprimer.
3. Mettre en production, au choix :
   - **sur GitHub** (conseillé) : Pull requests → New pull request → base `main`, compare `staging` → Create → **Merge** ;
   - **en ligne de commande** :
     ```bash
     git checkout main && git pull
     git merge --no-edit staging
     git push
     git checkout staging
     ```
4. Vercel construit `main` et le met en production tout seul. Suivre dans Deployments (environ 2 minutes).
5. **Test de fumée** sur `https://gmao-chitir.vercel.app` : connexion, déclarer une panne, changer le statut, nouvelle intervention avec technicien, clôturer, push reçu sur un autre appareil, mail reçu.
6. En cas de problème : Vercel → Deployments → le déploiement de production précédent → **Promote to Production**.

---

## Étape 2 : sauvegarder et contrôler

1. Sauvegarde, hors du dépôt (elle contient des données personnelles) :
   ```bash
   mkdir -p ~/sauvegardes-gmao
   supabase db dump -f ~/sauvegardes-gmao/schema-$(date +%F).sql
   supabase db dump --data-only -f ~/sauvegardes-gmao/donnees-$(date +%F).sql
   ```
2. Contrôle de santé : coller `scripts/verification-production.sql` dans le SQL Editor de Supabase. Ce qu'il faut voir est écrit au-dessus de chaque requête : tâche du matin active, notifications remises, bucket photos privé.
3. Supabase → Authentication : inscription libre désactivée, mot de passe de 8 caractères minimum.
4. Supprimer les données et comptes de test (`scripts/reperage-donnees.sql` aide à les repérer).

---

## Étape 3 : transférer la base Supabase au client

**Côté client** (tu peux le faire avec lui) :
1. Il crée un compte sur supabase.com **avec son propre e-mail**.
2. Il crée une **organisation** (plan gratuit possible), puis t'y invite comme **Owner** (Organization settings → Team → Invite).

**De ton côté** :
3. Accepter l'invitation.
4. Dans ton projet `GMAO-CHITIR` : Project Settings → General → **Transfer project** (en bas de la page) → choisir l'organisation du client. Il faut être Owner des deux organisations. Les conditions exactes (plan, interruption éventuelle) s'affichent avant de confirmer : les lire.
5. Vérifier : `supabase projects list` montre toujours le projet `jmxeewnhthhlutqgeixj`, et l'application en production fonctionne (connexion, tableau de bord).

**Ensuite** :
- La facturation Supabase passe chez le client.
- Pour continuer à maintenir l'application (`supabase db push`, `supabase functions deploy`), il faut **rester membre** de son organisation (rôle Developer suffit, Owner si tu gères les réglages). Le dossier local reste lié au même projet : rien à refaire.
- Les secrets de l'Edge Function (Resend, Firebase, `APP_URL`) suivent le projet. Voir l'étape 5 pour les mails.

---

## Étape 4 : remettre le compte propriétaire au client

### Pourquoi un script et pas la console Supabase

L'e-mail d'un compte est enregistré à **deux endroits** :
- dans le compte de connexion (`auth.users`), visible dans Supabase → Authentication → Users ;
- dans le profil de l'application (`users.email`), qui sert d'adresse **pour les mails** de notification et s'affiche dans Administration.

Changer l'e-mail dans la console ne modifie que le premier. Les mails continueraient de partir vers l'ancienne adresse. L'écran Administration ne permet pas non plus de changer un e-mail.
Le script `scripts/remettre-compte.mjs` change les deux, met un mot de passe temporaire et oblige à le changer à la première connexion. Le compte garde son rôle, ses restaurants et son historique (pannes déclarées, interventions). Il a été testé le 2026-10-09 sur la base locale : ancien e-mail refusé, nouvel e-mail accepté, historique conservé.

### Marche à suivre

1. **Te déconnecter** de ce compte sur tous tes appareils (menu → Se déconnecter). Changer le mot de passe ne ferme pas forcément les sessions déjà ouvertes.
2. Lancer le script, depuis `gmao-chitir`. `.env.development.local` vise la base **hébergée** (celle du client) :
   ```bash
   node --env-file=.env.development.local scripts/remettre-compte.mjs ton.email@actuel email.du@client.com "Prénom Nom"
   ```
   Le prénom est facultatif (il remplace celui du compte). Le script affiche la base visée (`Base : https://jmxeewnhthhlutqgeixj.supabase.co`), l'ancien et le nouvel e-mail, et le **mot de passe temporaire**. Il refuse si l'ancien e-mail n'existe pas, ou si le nouveau est déjà utilisé par un autre compte.
3. Transmettre le mot de passe temporaire au client **par un autre canal que l'e-mail** (téléphone, SMS, en main propre).
4. Le client ouvre `https://gmao-chitir.vercel.app`, se connecte avec **son** e-mail et ce mot de passe. L'application lui demande aussitôt de choisir son propre mot de passe (8 caractères minimum). Tu ne le connaîtras pas.
5. Ton propre accès, si tu continues la maintenance : le client te crée un compte dans Administration → Créer un compte, avec le rôle convenu ensemble. Ton ancien e-mail est libre après l'étape 2.

**Mot de passe perdu plus tard** : il n'y a pas de « mot de passe oublié » dans l'application. Un propriétaire ou un éditeur génère un nouveau mot de passe temporaire dans Administration → fiche du compte. Si c'est le **seul propriétaire** qui a perdu le sien, relancer le script avec **le même e-mail** en ancien et en nouveau : il génère seulement un nouveau mot de passe temporaire.
```bash
node --env-file=.env.development.local scripts/remettre-compte.mjs email.du@client.com email.du@client.com
```

---

## Étape 5 : les mails (à régler, ils n'iront pas chez le client tout seuls)

### La situation actuelle

- `RESEND_API_KEY` = la clé de **ton** compte Resend.
- `RESEND_TEST_RECIPIENT` = **ton** e-mail. Tant que ce secret existe, **tous** les mails partent vers cette seule adresse, avec en tête « Mode test : ce mail était destiné à … ».
- Aucun domaine d'envoi vérifié : Resend n'accepte alors d'envoyer qu'à l'adresse du titulaire du compte.

**Conséquence** : même après le transfert et le changement d'e-mail du propriétaire, les mails continueront d'arriver **chez toi**. Le transfert de Supabase ne change pas ces secrets.

### Option A : le client reçoit tous les mails (sans nom de domaine, 10 minutes)

1. Le client crée un compte sur resend.com **avec son e-mail**, puis API Keys → Create API Key (« Sending access »).
2. Remplacer les deux secrets :
   ```bash
   supabase secrets set RESEND_API_KEY="cle_du_client"
   supabase secrets set RESEND_TEST_RECIPIENT="email.du@client.com"
   ```
3. Tous les mails (urgences, pannes, attributions, de tous les comptes) arrivent dans **sa** boîte. Les autres membres de l'équipe ne reçoivent pas de mail ; ils ont les notifications dans l'application et les push.

### Option B : chacun reçoit ses propres mails (nom de domaine nécessaire)

1. Le client a un nom de domaine (par exemple `chitirchicken.com`) et peut modifier ses DNS.
2. Dans **son** compte Resend : Domains → Add domain → poser les enregistrements DNS demandés (SPF, DKIM) → attendre « Verified ».
3. Puis :
   ```bash
   supabase secrets set RESEND_API_KEY="cle_du_client"
   supabase secrets set RESEND_FROM_PRODUCTION="GMAO Chitir <alertes@chitirchicken.com>"
   supabase secrets unset RESEND_TEST_RECIPIENT
   ```
4. Chaque personne reçoit les mails à l'adresse de son compte.

Dans les deux cas : aucun redéploiement (la fonction relit les secrets à chaque envoi). Tester en déclarant une panne avec un **autre** compte que celui qui doit recevoir le mail, puis vérifier dans Resend → Emails.

---

## Étape 6 : l'application (Vercel) et l'adresse

L'application reste aujourd'hui sur **ton** Vercel, à l'adresse `https://gmao-chitir.vercel.app`. Elle continue de fonctionner après le transfert de Supabase, sans rien changer. Trois possibilités :

1. **La laisser sur ton Vercel** : rien à faire. Tu restes responsable de l'hébergement (plan gratuit suffisant à ce volume).
2. **La transférer** au client : il crée une équipe Vercel ; projet → Settings → Transfer. Les variables d'environnement suivent. Si le dépôt GitHub change aussi de propriétaire, reconnecter Git dans Settings → Git.
3. **Lui donner sa propre adresse** (ex. `gmao.chitirchicken.com`), quel que soit le compte Vercel :
   - Vercel → projet → Settings → Domains → Add → poser chez le client l'enregistrement DNS indiqué (CNAME) ;
   - puis mettre à jour : le secret `APP_URL` (`supabase secrets set APP_URL="https://gmao.chitirchicken.com"`), et Supabase → Authentication → URL Configuration (Site URL et Redirect URLs) ;
   - chaque utilisateur réinstalle l'application depuis la nouvelle adresse et réactive les notifications sur son appareil (les push sont liés à l'adresse).
   Le même domaine peut servir pour les mails (option B de l'étape 5).

---

## Étape 7 : les push (Firebase) et le code (GitHub)

- **Firebase** : les push passent par **ton** projet Firebase, qui reste valable après le transfert. Rien à changer pour que ça marche. Pour une remise complète : console Firebase → Project settings → Users and permissions → ajouter le client comme **Owner**.
- **GitHub** : garder le dépôt **privé**. Donner l'accès au client (Settings → Collaborators) ou le lui transférer (Settings → Danger Zone → Transfer ownership).

---

## Étape 8 : après la remise

1. **Changer les secrets que tu connais**, si tu ne restes pas en charge :
   - Supabase → Project Settings → API Keys : nouvelle clé secrète → la mettre dans Vercel (`SUPABASE_SECRET_KEY`, Production et Preview) → Redeploy → révoquer l'ancienne ;
   - Supabase → Database → réinitialiser le mot de passe de la base.
2. Relancer `scripts/verification-production.sql`.
3. Surveiller la première semaine : Vercel → Logs ; Supabase → Edge Functions → Logs ; Resend → Emails ; Database → Cron.

---

## Liste de contrôle

- [ ] `staging` poussé, prévisualisation testée sur téléphone
- [ ] Fusion dans `main`, production vérifiée (test de fumée)
- [ ] Sauvegarde faite, `verification-production.sql` correct, données de test supprimées
- [ ] Authentication : inscription fermée, 8 caractères minimum
- [ ] Organisation Supabase du client créée, projet transféré, toi membre
- [ ] Déconnecté de tes appareils, `remettre-compte.mjs` lancé, mot de passe transmis par téléphone
- [ ] Le client s'est connecté et a choisi son mot de passe
- [ ] Mails : option A ou B réglée, mail de test reçu par le client
- [ ] Vercel : décision prise (garder, transférer, domaine), `APP_URL` à jour si l'adresse change
- [ ] Firebase et GitHub : client ajouté
- [ ] Secrets changés si tu quittes le projet
