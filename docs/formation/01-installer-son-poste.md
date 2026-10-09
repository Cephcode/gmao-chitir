# Chapitre 01 — Installer ton poste et lancer le projet

**Objectif** : à la fin de ce chapitre, l'application tourne sur ton ordinateur, sur une base de données à toi, sans risque pour les vraies données du client.

---

## 1. Les outils, et à quoi ils servent

| Outil | À quoi il sert | Où le trouver |
|---|---|---|
| **VS Code** | L'éditeur de code : tu y ouvres le dossier du projet | code.visualstudio.com |
| **Node.js** (version 20 ou plus, 24 conseillé) | Le moteur qui exécute le JavaScript sur ton ordinateur. Il apporte **npm**, l'outil qui installe les bibliothèques | nodejs.org (version « LTS ») |
| **Git** | Garde l'historique du code et l'envoie sur GitHub | git-scm.com |
| **Docker Desktop** | Fait tourner une copie de la base de données sur ton ordinateur | docker.com |
| **Supabase CLI** | Pilote la base (locale et en ligne) en ligne de commande | supabase.com/docs/guides/cli |
| **Vercel CLI** (facultatif au début) | Pilote l'hébergement en ligne de commande | `npm install -g vercel` |

Extensions VS Code conseillées : **ESLint**, **Tailwind CSS IntelliSense**, **PostgreSQL** (ou « SQLTools »), **French Language Pack** si tu veux VS Code en français.

Vérifie que tout est installé en tapant, dans un terminal :

```bash
node -v        # doit afficher v20… ou plus
npm -v
git --version
docker -v
supabase -v
```

---

## 2. Le terminal, en 5 minutes

Le **terminal** est une fenêtre où l'on tape des commandes au lieu de cliquer. Dans VS Code : menu **Terminal → Nouveau terminal**. Il s'ouvre directement dans le dossier du projet.

Les seules commandes de base dont tu as besoin :

| Commande | Ce qu'elle fait |
|---|---|
| `pwd` | Affiche le dossier où tu es |
| `ls` (Mac, Linux) / `dir` (Windows) | Liste les fichiers du dossier |
| `cd nom-du-dossier` | Entre dans un dossier ; `cd ..` remonte d'un cran |
| `Ctrl + C` | **Arrête** la commande en cours (par exemple le serveur) |
| `↑` (flèche du haut) | Rappelle la commande précédente |

💡 Sous Windows, utilise **Git Bash** (installé avec Git) ou le terminal **WSL** : les commandes de cette formation y fonctionnent telles quelles.

---

## 3. Récupérer le projet

Le code est sur GitHub : `Cephcode/gmao-chitir`.

```bash
git clone https://github.com/Cephcode/gmao-chitir.git
cd gmao-chitir
git checkout staging          # la branche de travail (voir chapitre 10)
npm install                   # télécharge les bibliothèques dans node_modules/ (quelques minutes)
```

`npm install` lit le fichier `package.json` (la liste des bibliothèques dont le projet a besoin) et les installe dans le dossier `node_modules/`. Ce dossier est énorme et **ne s'envoie jamais sur GitHub** : chacun le recrée avec `npm install`.

Ouvre ensuite le dossier dans VS Code : **Fichier → Ouvrir le dossier → gmao-chitir**.

---

## 4. Les deux bases de données : la vraie et la tienne

C'est **le point le plus important de ce chapitre**.

```
                 ┌──────────────────────────────┐
                 │  Base HÉBERGÉE (Supabase)    │  ← les VRAIES données du client
                 │  utilisée par la production  │     NE PAS faire d'essais dessus
                 └──────────────────────────────┘

                 ┌──────────────────────────────┐
                 │  Base LOCALE (Docker)        │  ← TA base d'essai, sur ton PC
                 │  créée par « supabase start »│     tu peux tout casser
                 └──────────────────────────────┘
```

L'application sait à quelle base se connecter grâce à des **variables d'environnement** : des réglages qu'on donne au programme au démarrage, hors du code. La liste est dans `.env.example` :

- `NEXT_PUBLIC_SUPABASE_URL` : l'adresse de la base ;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : la clé « publique » (sans danger, la base protège les données) ;
- `SUPABASE_SECRET_KEY` : la clé **secrète** (pleins pouvoirs, serveur uniquement, ne jamais la partager) ;
- les variables `NEXT_PUBLIC_FIREBASE_…` : pour les notifications push (facultatives en local).

⚠️ Si un fichier `.env.development.local` existe dans ton dossier, `npm run dev` le lit **automatiquement**. Celui de l'ancien développeur pointe sur la **base hébergée**. Pour apprendre, **travaille toujours sur la base locale** (section suivante).

🔒 Les fichiers `.env…` ne vont **jamais** sur GitHub (ils sont listés dans `.gitignore`).

---

## 5. Lancer l'application sur ta base locale

**Étape 1 — Démarrer la base locale** (Docker Desktop doit être ouvert) :

```bash
supabase start
```

La première fois, il télécharge des images Docker (plusieurs minutes). Ensuite, il crée la base et exécute **toutes les migrations** du dossier `supabase/migrations/` : tu obtiens une base identique à celle du client, mais vide (2 restaurants, 49 machines, aucun compte).

**Étape 2 — Créer ton premier compte** (propriétaire) :

```bash
eval "$(supabase status -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY" \
  node scripts/creer-proprietaire.mjs moi@test.local "Moi"
```

La première ligne lit les adresses et clés de ta base locale. La seconde lance le script, qui affiche un **mot de passe temporaire**. Note-le.

**Étape 3 — Lancer l'application** sur cette base :

```bash
bash scripts/dev-local.sh
```

Ce petit script (ouvre-le, il fait 15 lignes) lit les adresses de ta base locale et lance `npm run dev` avec. Il refuse de démarrer si la base locale est arrêtée : impossible de tomber par erreur sur les vraies données.

Ouvre **http://localhost:3000** dans ton navigateur. Connecte-toi avec `moi@test.local` et le mot de passe temporaire : l'application te demande d'en choisir un nouveau. Tu es dans la GMAO, en propriétaire, sur ta propre base. 🎉

**Étape 4 — Créer d'autres comptes** pour tester les rôles : dans l'application, menu **Administration → Comptes → Nouveau compte** (un éditeur limité à CTR1, un lecteur…).

---

## 6. Ce que fait `npm run dev`

`npm run dev` lance la commande `next dev` (voir la section `scripts` de `package.json`). Elle démarre un **serveur de développement** :
- il fabrique les pages à la demande ;
- **dès que tu enregistres un fichier, la page se met à jour** dans le navigateur, sans recharger ;
- les erreurs s'affichent dans le terminal **et** dans le navigateur (un panneau rouge en bas de l'écran).

Les autres commandes de `package.json` :

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (pour travailler) |
| `npm run build` | Fabrique la version **de production** optimisée (Vercel le fait tout seul en ligne) |
| `npm run start` | Lance la version de production fabriquée par `build` |
| `npm run lint` | Vérifie le style et les erreurs courantes (ESLint) |

---

## 7. Arrêter, redémarrer, remettre à zéro

```bash
Ctrl + C              # arrête npm run dev
supabase stop         # arrête la base locale (les données sont gardées)
supabase start        # la redémarre
supabase db reset     # ⚠️ EFFACE ta base locale et la recrée depuis les migrations
```

Après un `supabase db reset`, il n'y a plus de compte : refais l'étape 2.

Pour **voir les tables** de ta base locale : le **Studio** Supabase, à l'adresse affichée par `supabase status` (en général http://127.0.0.1:54323). C'est une interface web, comme un tableur.

---

## ⚠️ Si ça ne marche pas

| Symptôme | Solution |
|---|---|
| `supabase start` : « Cannot connect to the Docker daemon » | Ouvre Docker Desktop et attends qu'il soit prêt |
| La connexion répond « E-mail ou mot de passe incorrect » alors que le compte existe | Avec une Supabase CLI récente, le réglage `enable_signup = false` de la section `[auth.email]` de `supabase/config.toml` coupe toute connexion par e-mail **en local**. Passe-le à `true` sur ton poste (sans le commiter), puis `supabase stop && supabase start` |
| La page affiche les vraies données du client | Tu as lancé `npm run dev` directement : arrête (`Ctrl + C`) et lance `bash scripts/dev-local.sh` |
| `npm install` échoue | Vérifie `node -v` (20 ou plus). Supprime `node_modules` et relance |
| Port 3000 déjà utilisé | Un autre `npm run dev` tourne déjà : ferme l'autre terminal |

---

## ✅ Ce qu'il faut retenir

- Le code est sur GitHub ; `npm install` installe les bibliothèques ; `npm run dev` lance l'application.
- **Deux bases** : l'hébergée (vraies données, on n'y touche pas pour apprendre) et la **locale** (`supabase start`, la tienne).
- Les **variables d'environnement** disent à l'application quelle base utiliser.

## 🏋️ Exercice 1

1. Lance l'application sur ta base locale et connecte-toi.
2. Crée un compte **éditeur** limité au restaurant **CTR1**, puis connecte-toi avec ce compte dans une **fenêtre de navigation privée**. Compare ce que voient les deux comptes dans **Équipements**.
3. Ouvre le Studio et trouve la table `users` : retrouve tes deux comptes.

👉 Chapitre suivant : [Les bases du web](02-bases-du-web.md)
