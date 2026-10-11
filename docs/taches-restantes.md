# Tâches restantes : état du projet et marche à suivre

Mis à jour le 2026-10-08. Ce document dit **où en est le projet** et **comment faire chaque tâche qui reste**, dans l'ordre conseillé, sans assistant.
Pour comprendre le code : `docs/guide-developpeur.md`. Pour la base : `docs/base-de-donnees.md`. Pour l'exploitation (variables, déploiement, notifications) : `docs/README.md`.

---

## 1. État au 2026-10-08

### Ce qui tourne

| Élément | État |
|---|---|
| **Production** | `https://gmao-chitir.vercel.app`, construite depuis la branche `main` (commit `c3c6063`, pull request n°1 « staging → main », fusionnée le 2026-09-30). **Le client l'utilise déjà** : le restaurant CTR4 y a été créé le 2026-10-03. |
| **GitHub** | `Cephcode/gmao-chitir`. `main` = `staging` au 2026-09-30 (commit `3951256` + fusion). Rien n'a été poussé depuis. |
| **Base hébergée** (Supabase, projet `GMAO-CHITIR`, réf. `jmxeewnhthhlutqgeixj`, Irlande) | Les **26 migrations** sont appliquées, **y compris les 3 du 2026-10-06**. Vérifié avec `supabase migration list`. |
| **Edge Function** `envoyer-notification` | Version 6, déployée le 2026-10-06 à 19 h 36 (UTC), après les retours client. |
| **Secrets Supabase** | `APP_URL`, `RESEND_API_KEY`, `RESEND_TEST_RECIPIENT`, `FIREBASE_SERVICE_ACCOUNT_KEY` (+ ceux fournis par Supabase). **Pas** de `RESEND_FROM_PRESENTATION` ni `RESEND_FROM_PRODUCTION` : les mails partent de l'adresse de test Resend, tous vers `RESEND_TEST_RECIPIENT`. |
| **Vercel** | 10 variables définies en Production **et** en Preview (`vercel env ls`). Fonctions à Dublin (`vercel.json`). |
| **Poste local** | `.env.development.local` pointe sur la **base hébergée** : `npm run dev` lit et écrit les vraies données. |

### Le travail du 2026-10-06 n'est pas commité

Les retours de la présentation client (nouvelle intervention, choix du technicien, fréquences jour et semaine, noms uniques, date d'installation, notification « attribution ») sont **dans le dossier de travail seulement**. Ils ne sont ni commités, ni sur GitHub, ni en production.
Pourtant, leurs migrations sont déjà sur la base hébergée. La production (code du 30/09) fonctionne avec cette base, car les ajouts sont compatibles. Mais tant que ce n'est pas commité, une erreur de manipulation (`git checkout .`, disque perdu) ferait perdre du code dont la base dépend déjà.

Fichiers concernés (`git status`) :
- **modifiés** : `app/(app)/equipements/actions.ts`, `app/(app)/equipements/nouveau/page.tsx`, `app/(app)/interventions/[id]/page.tsx`, `app/(app)/interventions/actions.ts`, `app/(app)/interventions/page.tsx`, `components/app/admin/restaurant-form.tsx`, `components/app/equipements/equipment-form.tsx`, `components/app/equipements/equipment-sheet.tsx`, `components/app/interventions/closing-form.tsx`, `components/app/interventions/intervention-list.tsx`, `components/app/interventions/intervention-sheet.tsx`, `components/ui/combobox.tsx`, `docs/journal-decisions.md`, `lib/equipements.ts`, `lib/format.ts`, `lib/interventions.ts`, `lib/notifications.ts`, `supabase/functions/envoyer-notification/index.ts`, `supabase/tests/03_entretien.sql`, `supabase/tests/07_restaurant.sql` ;
- **nouveaux** : `app/(app)/interventions/nouvelle/`, `components/app/interventions/new-intervention-form.tsx`, `components/app/interventions/technician-picker.tsx`, les 3 migrations `supabase/migrations/20261006090*.sql`, `supabase/tests/12_retours_client.sql`.

### Résultat de la recette du 2026-10-06 (après les retours client)

- `bash supabase/tests/run.sh` : **677 réussis, 0 échoué**. `npx tsc --noEmit` : rien. ESLint : 1 erreur (apostrophe dans `app/design-system/page.tsx`, ligne 124).
- `next build` réussi, y compris sur une copie branchée sur une autre base Supabase (la base locale) : l'application ne dépend d'aucun identifiant codé en dur, **sauf l'adresse du trigger** (tâche T2).
- Parcours testés dans Chrome en taille téléphone, un compte par rôle : connexion et erreurs, changement obligatoire du mot de passe (sans contournement possible), création des comptes, mot de passe temporaire régénéré, déclaration de panne, statut, attribution, clôture avec pièces (stock décompté, alerte de seuil), nouvelle intervention, nouvelle machine (code proposé, nom en double refusé), nouvelle pièce, nouveau restaurant par copie, garde-fous de l'administration, cloisonnement entre restaurants (404), appels directs à l'API avec la clé publique (tout refusé), aucun débordement à 360 px ni sur ordinateur.
- **Non vérifié** : l'envoi des photos (voir le piège « Storage local » dans `docs/guide-developpeur.md`), les push et les mails (il faut l'hébergé et deux appareils).

---

## 2. Liste des tâches, dans l'ordre

| N° | Tâche | Gravité | Effort |
|---|---|---|---|
| T1 | Commiter et pousser le travail du 06/10 | **Haute** (risque de perte) | 10 min |
| T2 | Retirer l'adresse du projet Supabase codée en dur dans le trigger | **Bloquante** pour changer de projet Supabase | 30 min |
| T3 | Corriger la perte de saisie des listes avec recherche (marque, technicien) | Moyenne | 1 h |
| T4 | Petits défauts (404 en anglais, « Clôturée par », libellé, typographie, ESLint, mot de passe minimum en local) | Faible | 1 h |
| T5 | Tester sur téléphone en https (prévisualisation Vercel) | Haute | 1 h |
| T6 | Mettre le travail du 06/10 en production | Haute | 30 min |
| T7 | Préparer la production (nettoyage, sauvegarde, réglages) | Haute | 1 à 2 h |
| T8 | Passer aux identifiants du client | Haute | 1 h (transfert) à une demi-journée (nouveau projet) |
| T9 | Points reportés, à proposer plus tard | Faible | — |

---

## T1. Commiter et pousser le travail du 06/10

> **Commité le 2026-10-09** sur `staging` (commits `dc908ba` et suivants). Reste : `git push`.

```bash
cd ~/Bureau/Projets/gmao/webapp/gmao-chitir
git checkout staging
git status                         # vérifier la liste ci-dessus
npx tsc --noEmit                   # doit ne rien afficher
supabase start                     # base locale
bash supabase/tests/run.sh         # doit finir par « 0 échoués »
git add -A
git commit -m "Retours client : nouvelle intervention, technicien, fréquences, noms uniques, date d'installation"
git push
```

Découper en plusieurs commits si tu préfères (migrations et tests, puis écrans), mais **tout** doit partir. Les fichiers `.env*` ne partent pas : `.gitignore` les exclut.
Après le `git push`, Vercel construit une adresse de prévisualisation pour `staging` (onglet Deployments). Elle sert à la tâche T5.

---

## T2. Retirer l'adresse du projet Supabase codée en dur

### Le problème

La fonction `envoyer_notification_trigger()` (migration `20260930190000_envoi_notifications.sql`, ligne 43) appelle :

```
https://jmxeewnhthhlutqgeixj.supabase.co/functions/v1/envoyer-notification
```

C'est l'adresse **de ton projet**. Si la base est recréée dans un autre projet (option B de la tâche T8), chaque notification appellerait **ta** fonction. Elle ne trouverait pas la notification et ne ferait rien : aucun mail, aucun push, et aucune erreur visible.
C'est aussi pour cela que la base locale appelle aujourd'hui l'hébergé à chaque notification (sans effet, mais inutile).

**Si tu choisis le transfert du projet (option A de T8), l'adresse ne change pas** et cette tâche devient facultative. Elle reste conseillée.

### La correction (testée en local le 2026-10-08)

On range l'adresse du projet dans le **Vault** de Supabase (coffre chiffré intégré à la base) et la fonction l'y lit. Sans adresse enregistrée, la fonction n'appelle rien (cas de la base locale).

1. Créer la migration :
   ```bash
   supabase migration new adresse_projet_dans_vault
   ```
2. Y coller :
   ```sql
   -- L'adresse de l'Edge Function n'est plus écrite en dur : elle est lue dans le Vault
   -- (secret « project_url », ex. https://abcd.supabase.co). Sans ce secret (base locale,
   -- projet neuf pas encore réglé), aucune requête n'est envoyée.
   -- Après le db push, sur chaque projet hébergé, lancer une fois dans le SQL Editor :
   --   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   create or replace function envoyer_notification_trigger()
   returns trigger
   language plpgsql security definer set search_path = public, extensions, pg_temp
   as $$
   declare
     v_url text;
   begin
     select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
     if v_url is null then
       return new;
     end if;
     perform net.http_post(
       url := rtrim(v_url, '/') || '/functions/v1/envoyer-notification',
       body := jsonb_build_object('id', new.id),
       headers := '{"Content-Type": "application/json"}'::jsonb
     );
     return new;
   end;
   $$;

   revoke execute on function envoyer_notification_trigger() from public, anon, authenticated;
   ```
3. Adapter le test `supabase/tests/06_notifications.sql`. Sa ligne 66 vérifie « une requête d'envoi par notification ». Sans secret dans la base locale, il n'y en aura plus, et le test échouera. Ajouter en haut du fichier, juste après l'inclusion de `_fixture.sql` (avant toute notification) :
   ```sql
   -- Adresse du projet pour le trigger d'envoi (annulée avec la transaction, comme le reste).
   select vault.create_secret('https://test.supabase.co', 'project_url');
   ```
   Si tu le souhaites, ajouter aussi un test « sans secret, aucune requête ».
4. Tester en local : `supabase migration up --local`, puis `bash supabase/tests/run.sh` (0 échec attendu).
5. **Ordre sur l'hébergé, à respecter** (sinon les notifications s'arrêtent entre les deux étapes) :
   1. d'abord créer le secret, dans le SQL Editor de Supabase :
      ```sql
      select vault.create_secret('https://jmxeewnhthhlutqgeixj.supabase.co', 'project_url');
      ```
   2. puis `supabase db push`.
6. Vérifier : déclarer une panne avec un compte, regarder Supabase → Edge Functions → `envoyer-notification` → Logs. Un appel doit apparaître.
7. Changer l'adresse plus tard (nouveau projet) :
   ```sql
   select vault.update_secret(id, 'https://<nouvelle-ref>.supabase.co') from vault.secrets where name = 'project_url';
   ```
8. Mettre à jour `docs/README.md` (section 3, dernier point) et le journal.

---

## T3. Corriger la perte de saisie des listes avec recherche

### Le problème (reproduit le 2026-10-06)

Dans « Nouvel équipement », si l'on tape une marque (« Pitco ») puis qu'on appuie directement sur « Enregistrer », **sans toucher** la suggestion « Ajouter « Pitco » comme nouvelle marque », la machine est créée **sans marque** et sans avertissement.
Même chose pour le champ **Technicien** (nouvelle intervention, fiche intervention) : un prénom tapé sans toucher la suggestion n'est pas enregistré.

### La cause

`components/ui/combobox.tsx`, gestion de `onBlur` (vers la ligne 106) : quand on quitte le champ, un `setTimeout` de 150 ms **remet le texte du choix précédent** si l'on n'a rien choisi. Le texte tapé est donc jeté. De plus, l'envoi du formulaire part avant la fin de ce délai.

### La correction proposée

Dans `onBlur`, **avant** le `setTimeout`, valider tout de suite le texte tapé s'il est sans ambiguïté :
- si une option a exactement ce libellé (même normalisation que la recherche), la choisir (`onChange({ id })`) ;
- sinon, si **une seule** option correspond à la recherche, la choisir ;
- sinon, si le champ autorise la création (`createLabel` fourni : marque, catégorie), choisir la création (`onChange({ newName: q })`) ;
- sinon (technicien inconnu), laisser le comportement actuel, mais afficher l'erreur « Choisissez dans la liste » plutôt que d'effacer en silence.

Garder le `setTimeout` seulement pour **fermer la liste**. Le clic sur une option n'est pas concerné : `onMouseDown` y appelle `preventDefault()`, donc le champ ne perd pas le focus.

Vérifier ensuite à la main, sur téléphone :
1. marque tapée puis « Enregistrer » → marque enregistrée ;
2. technicien « Theo » tapé puis « Créer l'intervention » → technicien attribué ;
3. choix au doigt dans la liste → inchangé ;
4. champ vidé → « aucun choix », comme avant.

---

## T4. Petits défauts

| Défaut | Où | Correction |
|---|---|---|
| Page 404 en anglais (« This page could not be found. ») : vue par exemple en ouvrant le lien d'une intervention d'un autre restaurant | Aucun fichier `not-found.tsx` | Créer `app/(app)/not-found.tsx` (dans la coquille de l'application, menu visible) avec un titre « Page introuvable », une phrase (« Ce contenu n'existe pas ou n'est pas accessible avec votre compte. ») et un lien vers l'accueil. Ajouter aussi `app/not-found.tsx` pour les adresses inconnues. Convention vérifiée dans `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`. |
| « Clôturée par » désigne deux personnes différentes : la notification nomme le **technicien attribué**, la fiche nomme **celui qui a cliqué** | Fonction SQL `cloturer_intervention` (dernière version : migration `20260930210000`), ligne `select first_name into v_closer_name … coalesce(p_assigned_to, v_caller)` | Choisir une règle. Soit la notification dit « Réparée par <technicien> » (le texte change, la donnée reste), soit elle prend `v_caller`. Nouvelle migration qui recopie **toute** la fonction (voir `docs/guide-developpeur.md`, section 6). Mettre à jour le test `supabase/tests/06_notifications.sql` (ligne 61, texte attendu « Clôturée par Eddy · Fixé »). |
| Champ « Ajouter une pièce du stock… » sans libellé pour les lecteurs d'écran | `components/app/interventions/closing-form.tsx`, `<Combobox … placeholder="Ajouter une pièce du stock…">` (vers la ligne 187) | Lui donner un `id` et relier le titre « Pièces utilisées » par `<label htmlFor>` (ou passer un `aria-label` au composant). |
| Le « » » fermant passe seul à la ligne (« appuyez sur « Déclarer une panne » ») | Textes avec guillemets français | Espace insécable avant « » » et après « « » (` `, ou `&nbsp;` en JSX). Chercher : `grep -rn "« " components app`. |
| ESLint : 1 erreur | `app/design-system/page.tsx:124` | Remplacer l'apostrophe `'` par `&apos;` (ou `’`). |
| `supabase/config.toml` : `minimum_password_length = 6` | Réglage de la base **locale** | Mettre `8`, comme l'application. Attention : `supabase config push` enverrait ces réglages sur l'hébergé ; ne pas l'utiliser sans relire tout le fichier. |

---

## T5. Tester sur téléphone en https

Pourquoi https : en `http://192.168…`, le navigateur du téléphone coupe le push, l'installation et certaines fonctions (presse-papiers, identifiants de photos). Les tests en http ont déjà masqué des bugs.

1. Après T1, récupérer l'adresse de prévisualisation de `staging` : Vercel → Deployments → la ligne « Preview » la plus récente, ou `vercel ls gmao-chitir`.
2. Supabase → Authentication → URL Configuration → Redirect URLs : vérifier qu'elle accepte cette adresse (motif `https://gmao-chitir-*-cephcodes-projects.vercel.app/**`).
3. ⚠️ La prévisualisation utilise la **base hébergée**, avec les vraies données du client. Créer un restaurant de test (par exemple code `TST`) et des comptes de test, et travailler seulement dessus. Les supprimer à la fin (T7).
4. Dérouler la liste de `docs/plan-mise-en-production.md`, étape 1 (« parcours manuels »), sur **Android**, **iPhone** et **ordinateur**, avec **deux comptes** (on n'est jamais prévenu de sa propre action). Priorités :
   - photos à la déclaration et à la clôture (non vérifiées en local) ;
   - push reçu sur un deuxième appareil, application installée (sur iPhone : ajoutée à l'écran d'accueil et ouverte depuis l'icône) ;
   - mail reçu dans la boîte de `RESEND_TEST_RECIPIENT` ;
   - nouvelle intervention avec technicien : le technicien reçoit « Intervention attribuée » ;
   - les cas de T3, si la correction est faite.

### Tester rapidement sur le réseau local (sans https)

Pour un test d'écran rapide seulement :
1. `npm run dev` sur le PC. ⚠️ Avec `.env.development.local` actuel, c'est la base **hébergée**.
2. Sur le téléphone, même Wi-Fi : `http://<IP du PC>:3000`. L'IP s'affiche avec `ip -4 addr` (au 2026-10-06 : `192.168.11.129`).
3. Si la page s'affiche mais ne réagit pas, vérifier `allowedDevOrigins` dans `next.config.ts` (joker du réseau, par exemple `192.168.11.*`), puis redémarrer `npm run dev`.
4. Pour voir les erreurs JavaScript du téléphone sur le PC : Next 16 recopie la console du navigateur dans `.next/dev/logs/next-development.log` :
   ```bash
   tail -f .next/dev/logs/next-development.log
   ```
   Pour voir les appareils connectés au serveur : `ss -tn state established '( sport = :3000 )'`.

---

## T6. Mettre le travail du 06/10 en production

La base hébergée et l'Edge Function sont **déjà à jour**. Il ne reste que le code de l'application.

1. Conditions : T1 fait, tests verts, T5 concluant (au minimum : nouvelle intervention, attribution, photos).
2. Si T2 est fait : créer le secret Vault **puis** `supabase db push` (ordre de T2).
3. Si l'Edge Function a été modifiée depuis le 06/10 : `supabase functions deploy envoyer-notification`.
4. Sur GitHub : pull request `staging` → `main`, relire la liste des fichiers, fusionner.
5. Vercel déploie `main` tout seul en production (2 minutes environ). Suivre dans Deployments.
6. **Test de fumée** (10 minutes, sur `https://gmao-chitir.vercel.app`) : connexion ; déclarer une panne avec photo sur le restaurant de test ; changer le statut ; nouvelle intervention avec technicien ; clôturer ; push reçu ; mail reçu.
7. **Retour arrière** si besoin : Vercel → Deployments → déploiement de production précédent → « Promote to Production ». La base ne revient pas en arrière : une erreur de base se corrige par une nouvelle migration.

---

## T7. Préparer la production

Liste complète : `docs/plan-mise-en-production.md`, étape 7. Les commandes :

0. **Contrôle de santé** (lecture seule) : coller `scripts/verification-production.sql` dans le SQL Editor. Il vérifie la tâche du matin, le bucket photos, la remise des notifications, les réponses de l'Edge Function, les appareils push et les comptes. Ce qu'il faut voir est écrit au-dessus de chaque requête.
1. **Repérer les données de test** (lecture seule) : coller `scripts/reperage-donnees.sql` dans le SQL Editor de Supabase. Il donne les volumes, les machines modifiées, les plans d'entretien et les pannes sans machine.
2. **Sauvegarder avant tout nettoyage** (fichiers hors du dépôt, ils contiennent des données personnelles) :
   ```bash
   mkdir -p ~/sauvegardes-gmao && cd ~/Bureau/Projets/gmao/webapp/gmao-chitir
   supabase db dump -f ~/sauvegardes-gmao/schema-$(date +%F).sql
   supabase db dump --data-only -f ~/sauvegardes-gmao/donnees-$(date +%F).sql
   ```
   Les photos ne sont pas dans ces fichiers : les télécharger depuis Supabase → Storage → `photos`.
3. **Nettoyer** les données de test, après validation de la liste avec le client (il utilise déjà la production). Comptes de test : Administration → fiche du compte → Supprimer (ou Supabase → Authentication → Users). Restaurant de test : il n'y a pas de bouton de suppression dans l'application ; dans le SQL Editor, supprimer d'abord ses interventions, ses machines, puis le restaurant. Les photos se retirent depuis la console Storage.
4. **Authentication** (console Supabase) : inscription libre désactivée ; mot de passe d'au moins 8 caractères ; Site URL = adresse de production ; Redirect URLs = production et motif de prévisualisation.
5. **Tâche du matin** : `select * from cron.job;` doit montrer `gmao-taches-quotidiennes`, `0 7 * * *`. Historique : Database → Cron.
6. **Resend** : domaine vérifié, puis `RESEND_FROM_PRODUCTION` réglé et `RESEND_TEST_RECIPIENT` supprimé (`docs/README.md`, section 6). Tant que ce n'est pas fait, tous les mails arrivent dans une seule boîte.
7. **Firebase** : push testé sur l'adresse de production, sur deux appareils.
8. **Dépôt GitHub** : le garder **privé** (un e-mail figure dans un ancien commit).
9. **Logo** : les icônes de l'application installée sont agrandies depuis un logo de 180 px. Avec un logo en haute définition, remplacer `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` et `app/apple-icon.png`.

---

## T8. Passer aux identifiants du client

> **Choix fait le 2026-10-09** : transfert de la base Supabase dans l'organisation du client, compte propriétaire remis à son e-mail. Marche à suivre complète et à jour : **`docs/remise-client.md`** (avec le script `scripts/remettre-compte.mjs`). La suite de cette section reste comme référence (option B, autres services).

Il y a **quatre comptes** à remettre : Supabase (base, comptes, photos), Vercel (hébergement), Firebase (push), Resend (mails). Plus GitHub pour le code.
Deux façons de faire. **Le client a déjà des données réelles dans ta base** (CTR4, interventions) : l'option A est donc la plus sûre.

### Option A (conseillée) : transférer les projets existants

Rien ne change dans le code ni dans les variables : l'adresse du projet, les clés et les données restent les mêmes.

1. **Supabase** : le client crée une organisation sur supabase.com et t'y invite comme propriétaire. Dans ton projet : Project Settings → General → **Transfer project** vers son organisation. La facturation passe chez lui. Ensuite, il peut te laisser développeur ou te retirer.
2. **Vercel** : le client crée une équipe (team). Projet `gmao-chitir` → Settings → **Transfer** vers son équipe. Les variables et l'adresse `gmao-chitir.vercel.app` suivent. Si le dépôt GitHub change de propriétaire, reconnecter Git dans Settings → Git.
3. **GitHub** : Settings → Danger Zone → **Transfer ownership** vers le compte du client, ou l'ajouter comme collaborateur. Le dépôt doit rester privé.
4. **Firebase** : console Firebase → Project settings → Users and permissions → ajouter le client comme **Owner**.
5. **Resend** : un compte ne se transfère pas. Le client crée le sien, vérifie son domaine et crée une clé (« Sending access »). Ensuite :
   ```bash
   supabase secrets set RESEND_API_KEY="cle_du_client"
   supabase secrets set RESEND_FROM_PRODUCTION="GMAO Chitir <alertes@domaine-du-client>"
   supabase secrets unset RESEND_TEST_RECIPIENT
   ```
6. **Changer les secrets que tu as connus** (bonne pratique après une remise) :
   - Supabase → Project Settings → API Keys : créer une nouvelle clé secrète, la mettre dans Vercel (`SUPABASE_SECRET_KEY`, Production et Preview), redéployer, puis révoquer l'ancienne ;
   - Supabase → Database → réinitialiser le mot de passe de la base ;
   - Firebase : créer une nouvelle clé de compte de service, la mettre dans le secret `FIREBASE_SERVICE_ACCOUNT_KEY`, supprimer l'ancienne.
7. Test de fumée (T6, étape 6).

### Option B : nouveaux projets au nom du client

À choisir seulement si le client veut repartir **sans** les données actuelles. Reprendre les données d'un projet à l'autre est possible, mais délicat : les comptes de connexion (`auth.users`) et les photos sont à part.
**Prérequis : T2 fait**, sinon les notifications ne partiront pas.

**Supabase**
1. Le client crée le projet dans **sa** organisation, **région Irlande (`eu-west-1`)** pour rester à côté des fonctions Vercel (`dub1`). Noter le mot de passe de la base.
2. Relier ton dossier au nouveau projet (cela remplace le lien vers l'ancien, dans `supabase/.temp/`) :
   ```bash
   supabase link --project-ref <ref_du_client>
   supabase db push                 # 27 migrations (26 + celle de T2)
   supabase migration list          # local = hébergé partout
   ```
   Les migrations créent tout : tables, droits, fonctions, bucket `photos` privé, tâche du matin, et les données de départ (2 restaurants, 6 catégories, 49 machines).
3. Adresse du projet dans le Vault (SQL Editor) :
   ```sql
   select vault.create_secret('https://<ref_du_client>.supabase.co', 'project_url');
   ```
4. Edge Function : `supabase functions deploy envoyer-notification`. `supabase/config.toml` lui donne `verify_jwt = false` ; le vérifier dans la console (Edge Functions → la fonction → « Verify JWT » désactivé).
5. Secrets :
   ```bash
   supabase secrets set APP_URL="https://adresse-de-production"
   supabase secrets set RESEND_API_KEY="..." RESEND_FROM_PRODUCTION="GMAO Chitir <alertes@domaine-client>"
   supabase secrets set FIREBASE_SERVICE_ACCOUNT_KEY="$(base64 -w0 compte-de-service.json)"
   ```
6. Authentication : inscription libre **désactivée**, mot de passe de 8 caractères minimum, Site URL et Redirect URLs (T7, point 4).
7. Vérifier : `select * from cron.job;` (tâche du matin) et Storage → `photos` (privé).
8. **Premier propriétaire** : l'application ne permet pas de créer le premier compte (il faut déjà être propriétaire). Utiliser le script ci-dessous.

**Script du premier propriétaire.** Créer `scripts/creer-proprietaire.mjs` :

```js
// Crée le premier compte propriétaire d'un projet Supabase neuf (à lancer une seule fois).
// Usage : node --env-file=<fichier .env du projet> scripts/creer-proprietaire.mjs email "Prénom"
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY. Affiche un mot de passe temporaire,
// à changer à la première connexion (comme les comptes créés dans Administration).
import { createClient } from "@supabase/supabase-js";

const [email, prenom] = process.argv.slice(2);
if (!email) throw new Error('Usage : node --env-file=… scripts/creer-proprietaire.mjs email "Prénom"');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const motDePasse = Array.from(crypto.getRandomValues(new Uint32Array(12)), (b) => alphabet[b % alphabet.length]).join("");

const { data, error } = await admin.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password: motDePasse,
  email_confirm: true,
});
if (error) throw error;
const { error: profil } = await admin.from("users").insert({
  id: data.user.id,
  email: email.trim().toLowerCase(),
  first_name: prenom || null,
  role: "proprietaire",
  all_restaurants: true,
  must_change_password: true,
});
if (profil) {
  await admin.auth.admin.deleteUser(data.user.id);
  throw profil;
}
console.log(`Compte créé pour ${email}. Mot de passe temporaire : ${motDePasse}`);
```

Lancer : `node --env-file=.env.client.local scripts/creer-proprietaire.mjs proprietaire@client.com "Prénom"`. Le fichier `.env.client.local` contient les deux variables du nouveau projet ; il est exclu du dépôt par `.gitignore` (motif `.env*`). Un script équivalent a été testé le 2026-10-06 sur la base locale.

**Firebase** (si nouveau projet)
1. console.firebase.google.com → nouveau projet → ajouter une **application Web** : la console affiche `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
2. Project settings → Cloud Messaging → Web Push certificates → **Generate key pair** : c'est `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. Project settings → Service accounts → **Generate new private key** : le JSON va dans le secret Supabase `FIREBASE_SERVICE_ACCOUNT_KEY` (en base64, étape 5 ci-dessus). Ne jamais le mettre dans le dépôt.
4. Les jetons push enregistrés avec l'ancien projet deviennent invalides. La fonction les efface d'elle-même au premier échec. Chaque utilisateur doit réactiver « Notifications sur cet appareil ».

**Vercel**
1. Écrire les nouvelles valeurs dans un fichier hors dépôt, par exemple `.env.client.local`, avec les **10 noms** de `.env.example` (une valeur seule par ligne, sans guillemets ni virgule).
2. Après `vercel link` sur le projet voulu :
   ```bash
   ENV_FILE=.env.client.local bash scripts/vercel-env.sh production,preview
   ```
3. **Redeploy** : les variables `NEXT_PUBLIC_` sont intégrées à la construction.
4. Si l'adresse de production change, mettre à jour `APP_URL` (secret Supabase) et les URL d'Authentication.

**Ton poste**
- Mettre les nouvelles valeurs dans `.env.development.local` si tu continues à développer pour le client.
- `supabase link` pointe désormais sur le projet du client : toute commande `db push` part chez lui.

**Fin** : test de fumée complet (T6, étape 6) avec le compte propriétaire, puis création des comptes de l'équipe par Administration.

---

## T9. Points reportés (à proposer au client plus tard)

Décidés hors du périmètre actuel (`docs/plan-mise-en-production.md`, étape 9, et le journal) :
- C2 : colonne de connexion sur ordinateur ;
- « Rester connecté » ;
- CAPTCHA à la connexion ;
- S-B2, S-B4, S-B8 (en-têtes de sécurité, limite de taille des entrées : voir `docs/recette/2-securite.md`) ;
- rouvrir une intervention clôturée ;
- mail à la création d'un compte ;
- plus de photos par intervention (plan payant Supabase, Storage au-delà de 1 Go).

Fait depuis la liste du 30/09 : « Nouvelle intervention » sans panne (2026-10-06).

### Surveiller la première semaine

- Vercel → Logs (erreurs 500) ;
- Supabase → Logs Postgres et Edge Functions ;
- Supabase → Storage (quota de 1 Go du plan gratuit) ;
- Resend → Emails (envois refusés) ;
- Database → Cron (tâche de 7 h exécutée chaque jour).
