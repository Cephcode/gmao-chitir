# Chapitre 06 — L'architecture du projet

**Objectif** : avoir en tête le **plan d'ensemble** de la GMAO : ses couches, ses dossiers, la forme d'un module, et les grands circuits (connexion, notifications, photos). Quand tu sauras ça, tu sauras **où chercher** n'importe quoi.

---

## 1. Vue d'ensemble : les services

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NAVIGATEUR (téléphone, ordinateur)                                           │
│  pages HTML + composants client + service worker (push)                      │
└───────────────┬──────────────────────────────────────────────▲───────────────┘
                │ pages, actions serveur                       │ push
                ▼                                              │
┌───────────────────────────────┐                     ┌────────┴────────┐
│ VERCEL — Next.js (Dublin)     │                     │ FIREBASE        │
│  app/, components/, lib/      │                     │ notifications   │
│  proxy.ts                     │                     │ push            │
└───────────────┬───────────────┘                     └────────▲────────┘
                │ lectures, écritures (session de l'usager)    │
                ▼                                              │
┌──────────────────────────────────────────────────────────────┴───────────────┐
│ SUPABASE (Irlande)                                                           │
│  PostgreSQL : tables, droits (RLS), fonctions SQL, triggers, tâche du matin  │
│  Auth : comptes et mots de passe      Storage : photos (bucket privé)        │
│  Edge Function « envoyer-notification » ─────────────► RESEND (e-mails)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Service | Rôle | Le code correspondant |
|---|---|---|
| **Vercel** | Héberge et exécute Next.js | tout le dépôt sauf `supabase/` |
| **Supabase** | Base, comptes, photos, envoi des alertes | `supabase/migrations/`, `supabase/functions/` |
| **Firebase** | Livre les notifications push aux téléphones | `lib/firebase-client.ts`, `app/firebase-messaging-sw.js/route.ts`, l'Edge Function |
| **Resend** | Envoie les e-mails | l'Edge Function |
| **GitHub** | Garde le code | — |

---

## 2. Les couches du code

Le code Next.js est rangé en **trois couches**. Chacune a un rôle, et on ne les mélange pas :

```
┌───────────────────────────────────────────────────────────────────────┐
│ 1. ROUTES — app/                                                      │
│    « Quelle page pour quelle adresse ? Quelles actions ? »            │
│    page.tsx (lit via lib/, affiche via components/), actions.ts       │
├───────────────────────────────────────────────────────────────────────┤
│ 2. AFFICHAGE — components/                                            │
│    « À quoi ça ressemble ? »                                          │
│    ui/ : briques génériques     app/<module>/ : écrans d'un module    │
├───────────────────────────────────────────────────────────────────────┤
│ 3. LOGIQUE — lib/                                                     │
│    « Quelles données ? Quelles règles ? »                             │
│    <module>.ts : lectures en base    <module>-rules.ts : règles pures │
└───────────────────────────────────────────────────────────────────────┘
                   ▼ tout passe par lib/supabase/
┌───────────────────────────────────────────────────────────────────────┐
│ 4. BASE — supabase/migrations/                                        │
│    tables, droits, fonctions SQL : la vérité et la sécurité           │
└───────────────────────────────────────────────────────────────────────┘
```

**Qui a le droit d'appeler qui :**
- `app/` appelle `lib/` (lire) et `components/` (afficher) ;
- `components/` appelle `components/ui/`, `lib/` (libellés, règles) et les **actions** de `app/…/actions.ts` (pour enregistrer) ;
- `lib/` n'appelle jamais `app/` ni `components/` (seule exception : quelques types d'icônes et de badges) ;
- **rien n'écrit en base sans passer par une action serveur** (sauf les photos, déposées directement dans Storage depuis le navigateur, sous le contrôle des règles du bucket).

### Pourquoi deux fichiers dans `lib/` par module ?

| Fichier | Contenu | Particularité |
|---|---|---|
| `lib/consommables.ts` | Les **lectures** : `getArticle`, `chargerListe`… | Utilise `createClient()` : **serveur seulement** |
| `lib/consommables-rules.ts` | Les **règles pures** : libellés, validations, calculs, filtres | Pas d'accès à la base : utilisable **côté client comme serveur**, et **testable** seul (`tests/consommables-rules.test.ts`) |

Un composant client ne peut pas importer `lib/consommables.ts` (il lit la base), mais peut importer `lib/consommables-rules.ts`. C'est la raison du découpage.

---

## 3. La carte des dossiers

```
gmao-chitir/
├── app/                              ROUTES
│   ├── layout.tsx                      cadre racine : <html>, polices, titre
│   ├── globals.css                     Tailwind + COULEURS du thème (@theme)
│   ├── manifest.ts, apple-icon.png     application installable
│   ├── firebase-messaging-sw.js/       script des push (route API)
│   ├── connexion/                      page publique de connexion + son action
│   ├── changer-mot-de-passe/           mot de passe temporaire à changer
│   ├── design-system/                  démonstration des briques (/design-system)
│   └── (app)/                          PAGES CONNECTÉES
│       ├── layout.tsx                    garde de session + menu
│       ├── error.tsx, loading.tsx        erreur et chargement communs
│       ├── page.tsx                      tableau de bord
│       ├── equipements/                  machines
│       ├── panne/                        déclarer une panne
│       ├── interventions/                interventions (+ photos-actions.ts)
│       ├── stock/                        pièces détachées
│       ├── consommables/                 stock des restaurants
│       ├── notifications/                alertes et réglages
│       └── admin/                        comptes, restaurants, catégories (+ layout.tsx de garde)
│
├── components/                       AFFICHAGE
│   ├── ui/                             briques : button, field, card, alert, combobox,
│   │                                   segmented-control, status-badge
│   ├── icons.tsx                       toutes les icônes (tracés SVG)
│   └── app/                            un dossier par module + éléments communs
│       ├── nav.tsx                       menu latéral, barre du bas, bouton « Déclarer une panne »
│       ├── url-filters.tsx               recherche + puces de filtre (dans l'adresse)
│       ├── loading-state.tsx, list-row.tsx, kpi-card.tsx, sheet-title.tsx, …
│       └── equipements/, interventions/, stock/, consommables/, panne/, photos/, notifications/, admin/
│
├── lib/                              LOGIQUE
│   ├── supabase/                       server.ts, client.ts, admin.ts, middleware.ts
│   ├── session.ts                      usager connecté, rôle, compteurs du menu
│   ├── <module>.ts, <module>-rules.ts  par module
│   └── format.ts, identifiant.ts, …    utilitaires
│
├── supabase/                         BASE
│   ├── migrations/                     tout le schéma, dans l'ordre (un fichier = une évolution)
│   ├── functions/envoyer-notification/ Edge Function (push + e-mails), en Deno
│   ├── tests/                          tests SQL (pgTAP) + run.sh
│   └── config.toml                     réglages de la base LOCALE
│
├── tests/                            tests des règles pures (node --test)
├── scripts/                          outils : dev-local.sh, creer-proprietaire.mjs, vercel-env.sh…
├── public/                           fichiers servis tels quels (icônes, logo)
├── docs/                             documentation (dont cette formation)
├── proxy.ts                          garde de session avant chaque requête
├── next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs, vercel.json
└── package.json                      bibliothèques et commandes npm
```

---

## 4. L'anatomie d'un module

Tous les modules ont **la même forme**. Si tu comprends un module, tu les comprends tous. Exemple : **Consommables**.

```
                 ┌─────────────── supabase/migrations/20261009090000_consommables.sql
   BASE          │   tables articles, article_stocks, article_mouvements
                 │   droits (RLS), fonctions mouvement_article, inventaire_article…
                 └───────────────
                 ┌─────────────── lib/consommables-rules.ts   (règles pures, testées)
   LOGIQUE       │                lib/consommables.ts         (lectures en base)
                 └───────────────
                 ┌─────────────── app/(app)/consommables/
   ROUTES        │   page.tsx              /consommables            liste
                 │   [id]/page.tsx         /consommables/<id>       fiche
                 │   nouveau/page.tsx      /consommables/nouveau    création
                 │   [id]/modifier/page.tsx                         modification
                 │   loading.tsx                                    chargement
                 │   actions.ts            enregistrerArticle, supprimerArticle,
                 │                         operationArticle, arreterSuivi
                 └───────────────
                 ┌─────────────── components/app/consommables/
   AFFICHAGE     │   article-list.tsx      (serveur) liste : cartes mobile, tableau ordinateur
                 │   article-sheet.tsx     (serveur) fiche
                 │   article-form.tsx      (client)  formulaire de l'article
                 │   article-operation.tsx (client)  « Mettre à jour le stock »
                 └───────────────
   TESTS          supabase/tests/13_consommables.sql, tests/consommables-rules.test.ts
   MENU           components/app/nav.tsx
```

**Les noms de fichiers d'affichage suivent un même vocabulaire** dans tous les modules :

| Suffixe | Ce que c'est | Exemples |
|---|---|---|
| `-list.tsx` | la liste (avec filtres) | `stock-list`, `equipment-list`, `article-list` |
| `-sheet.tsx` | la **fiche** d'un élément | `part-sheet`, `equipment-sheet`, `intervention-sheet`, `article-sheet` |
| `-form.tsx` | le formulaire de création/modification | `part-form`, `equipment-form`, `article-form` |

### La mise en page « liste + fiche »

Sur **ordinateur**, la fiche s'ouvre **à droite de la liste** ; sur **mobile**, la fiche prend **tout l'écran**. Une seule page fait les deux, avec Tailwind (`hidden lg:block` = caché sur mobile, visible sur ordinateur). Voir `app/(app)/consommables/[id]/page.tsx` :

```tsx
<div className="lg:flex">
  <div className="hidden lg:block flex-1">     {/* liste : ordinateur seulement */}
    <ArticleList … selectedId={article.id} />
  </div>
  <aside className="lg:w-[440px] …">          {/* fiche : toujours */}
    <ArticleSheet … />
  </aside>
</div>
```

Les **formulaires** (`*-form.tsx`) s'ouvrent en plein écran sur mobile et en **panneau latéral** sur ordinateur, par-dessus la liste.

---

## 5. Les conventions du projet

| Sujet | Convention |
|---|---|
| **Langue** | Tout ce que voit l'usager, les commentaires et la documentation sont **en français**. Les noms dans le code sont en français pour le code récent (`chargerListe`, `verifierOperation`) et en anglais pour le plus ancien (`listParts`, `readFilters`) : garde la langue du fichier que tu modifies |
| **Noms de fichiers** | en minuscules avec tirets : `article-sheet.tsx` |
| **Noms de composants** | en `PascalCase` : `ArticleSheet` |
| **Noms de fonctions et variables** | en `camelCase` : `chargerListe`, `canEdit` |
| **Constantes de listes** | en MAJUSCULES : `FAMILLES`, `STATUS_LABELS` |
| **Droits d'affichage** | une fonction `can…` dans `lib/` : `canEditStock`, `canEditConsommables`, `canSetStatus` |
| **Résultat d'une action** | `{ ok: true, message }` ou `{ ok: false, error, field? }` (`field` = le champ à souligner en rouge) |
| **Commentaires** | en tête de chaque fichier : à quoi il sert. Au-dessus des fonctions non évidentes : **pourquoi** |
| **Couleurs** | uniquement les couleurs du thème (`bg-orange`, `text-danger`…), jamais de code couleur en dur |
| **Filtres de liste** | dans l'adresse (`?q=&restaurant=…`), lus par `readFilters` / `lireFiltres` |

---

## 6. Le système de design

L'apparence repose sur **trois éléments** :

1. **Les couleurs, rayons et tailles** du thème : `app/globals.css`, bloc `@theme`. Chaque ligne `--color-xxx` crée les classes Tailwind `bg-xxx`, `text-xxx`, `border-xxx`. Exemples : `--color-orange` (action principale), `--color-danger` (panne, erreur), `--color-warning` (retard, sous le seuil), `--color-surface` (cartes blanches), `--color-text-muted` (texte secondaire).
2. **Les briques** de `components/ui/` : `Button`, `Field` + `TextInput`, `Card`, `Alert`, `Combobox`, `SegmentedControl`, `StatusBadge`. Elles appliquent les règles (taille tactile de 44 px minimum, focus visible, couleurs accessibles).
3. **Les icônes** : `components/icons.tsx`, un tracé SVG par nom (`<Icon name="box" />`).

**Règles du design**, à respecter dans tout nouvel écran :
- **une seule action orange** (`Button` `primary`) par écran ;
- un statut = **couleur + icône + texte** ensemble (`StatusBadge`), jamais la couleur seule ;
- **mobile d'abord** : écrire les classes pour le téléphone, puis ajouter `lg:` pour l'ordinateur ;
- cibles tactiles d'au moins **44 px** (`size-touch`, `h-field`).

La page **`/design-system`** (une fois connecté) montre toutes les briques.

---

## 7. La sécurité en quatre barrières

```
   requête ──► ① proxy.ts          pas connecté ? → /connexion
           ──► ② layouts           pas de profil ? mot de passe à changer ? pas admin ? → redirection
           ──► ③ actions serveur   saisie revérifiée ; client avec la session de l'usager
           ──► ④ BASE              RLS : ne lit/écrit que ce que le rôle et les restaurants permettent
                                   fonctions SQL : revérifient rôle + restaurant + règles métier
```

Les barrières ① ② ③ sont du **confort** (messages clairs, pas de bouton inutile). **La barrière ④ est la vraie** : même si tout le reste était contourné, la base refuserait. C'est pourquoi toute règle de droits s'écrit **d'abord en base**.

**Les trois clients Supabase** (`lib/supabase/`) :

| Fichier | Où | Droits | Usage |
|---|---|---|---|
| `server.ts` → `createClient()` | serveur | **ceux de l'usager connecté** (RLS) | 99 % des cas : pages et actions |
| `client.ts` → `createClient()` | navigateur | ceux de l'usager (RLS) | dépôt des photos dans Storage |
| `admin.ts` → `createAdminClient()` | serveur **uniquement** | 🔒 **tous** (contourne la RLS) | créer, modifier, supprimer des comptes ; lever « mot de passe à changer » ; noter la dernière connexion ; compter les machines par catégorie ; reprendre un appareil push d'un autre compte |

⚠️ N'utilise `createAdminClient()` que si c'est **indispensable**, et jamais dans un fichier `"use client"`.

---

## 8. Les grands circuits

### 8.1 Connexion

```
/connexion ── seConnecter (app/connexion/actions.ts)
                 └─ supabase.auth.signInWithPassword ──► Supabase Auth vérifie
                 └─ cookie de session posé
                 └─ redirect("/")
"/"        ── proxy.ts : session valide ? ── app/(app)/layout.tsx : profil ? mot de passe temporaire ?
                                                └─ oui → /changer-mot-de-passe (changerMotDePasse)
```

Les comptes sont créés **par un propriétaire ou un éditeur** dans Administration (`creerCompte`, clé secrète). Il n'y a pas d'inscription libre ni de « mot de passe oublié » : un admin génère un nouveau mot de passe temporaire.

### 8.2 Notifications (alerte → push + e-mail)

```
① une fonction SQL (declarer_panne, cloturer_intervention, mouvement_stock, mouvement_article,
   taches_quotidiennes…) INSÈRE une ligne dans la table notifications
       │
② le trigger trg_notifications_envoi appelle, via pg_net, l'Edge Function
       │                                    (après la validation de la transaction)
③ supabase/functions/envoyer-notification/index.ts
       ├─ réserve la notification (delivered_at) : un seul envoi
       ├─ push Firebase vers chaque appareil du destinataire (table push_tokens)
       └─ e-mail Resend pour les types urgence, panne, attribution
       │
④ dans l'application, la cloche lit la table notifications (lib/notifications.ts)
```

Pour qu'un appareil reçoive les push, l'usager l'active dans **Notifications → Mes alertes** (`push-toggle.tsx` → `obtenirJetonPush` → action `enregistrerAppareil` → table `push_tokens`).

**La tâche du matin** : chaque jour à 7 h, `pg_cron` lance la fonction SQL `taches_quotidiennes()` qui crée les alertes « entretien à prévoir » et « en retard ».

### 8.3 Photos d'intervention

```
navigateur : compressPhoto (lib/photos-browser.ts) ─► JPEG réduit (1600 px max)
           : sendPhotos ─► dépôt DIRECT dans Storage, bucket « photos »,
                           chemin {restaurant}/{intervention}/{uuid}.jpg
                           (les règles du bucket vérifient le droit)
           : action enregistrerPhotos ─► fonction SQL ajouter_photo_intervention (3 max par type)
affichage  : listPhotos (lib/photos-server.ts) ─► URL signées valables 1 h (bucket privé)
```

### 8.4 Un mouvement de stock (rappel du chapitre 05)

`article-operation.tsx` → `operationArticle` (action) → `mouvement_article` (SQL : droits, stock suffisant, historique, alerte au seuil) → `revalidatePath` → la fiche se met à jour.

---

## 9. Les environnements

| Environnement | Code | Base | Adresse |
|---|---|---|---|
| **Local** (ton poste) | ta copie | locale (Docker) | http://localhost:3000 |
| **Prévisualisation** | une branche poussée sur GitHub (pas `main`) | hébergée | adresse Vercel temporaire, https |
| **Production** | branche `main` | hébergée | https://gmao-chitir.vercel.app |

⚠️ La prévisualisation utilise **la même base que la production** : les essais y créent de vraies données. Fais tes essais en local, et utilise la prévisualisation pour vérifier sur un vrai téléphone (https).

---

## ✅ Ce qu'il faut retenir

- Trois couches de code : **`app/`** (routes), **`components/`** (affichage), **`lib/`** (logique) ; plus la **base** (`supabase/`).
- Un module = migration + `lib/x.ts` + `lib/x-rules.ts` + `app/(app)/x/` + `components/app/x/` + tests + menu.
- Vocabulaire : `-list`, `-sheet`, `-form`, `can…`, `{ ok, message | error }`.
- 🔒 **La base est la vraie barrière** ; la clé secrète (`admin.ts`) est réservée à l'administration des comptes.

## 🏋️ Exercice 6

1. Pour le module **Équipements**, liste les fichiers de chacune des couches (base, logique, routes, affichage).
2. Où est définie la couleur orange ? Change-la en local pour du vert, regarde le résultat, puis remets-la.
3. Suis le circuit des notifications pour une **déclaration de panne** : quelle fonction SQL crée la notification ? Quel type de notification part aussi par e-mail ?

👉 Chapitre suivant : [La base de données](07-base-de-donnees.md)
