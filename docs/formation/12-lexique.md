# Chapitre 12 — Lexique

Tous les mots techniques de la formation, expliqués simplement, avec **où les voir dans le projet**. Classés par ordre alphabétique.

| Mot | Sens | Dans le projet |
|---|---|---|
| **Action serveur** | Fonction `async` d'un fichier `"use server"`, appelée depuis l'écran comme une fonction normale, exécutée sur le serveur. Sert à **écrire** | `app/(app)/*/actions.ts` |
| **API** | « Porte » par laquelle un programme parle à un autre | Supabase reçoit les demandes du code par son API |
| **App Router** | La façon dont Next range les pages : un dossier de `app/` par adresse | `app/` |
| **`async` / `await`** | `async` marque une fonction qui attend ; `await` attend le résultat d'une opération longue (lecture en base) | toutes les lectures de `lib/` |
| **Auth** | Gestion des comptes et mots de passe | Supabase Auth, table `auth.users` |
| **Branche** | Ligne de travail parallèle dans Git | `staging` (travail), `main` (production) |
| **Bucket** | « Dossier » de fichiers dans Supabase Storage | `photos` (privé) |
| **Build** | Fabrication de la version de production | `npm run build` (Vercel le fait seul) |
| **`cache()`** | Garde un résultat le temps d'une requête | `getProfile` dans `lib/session.ts` |
| **Clé étrangère** | Colonne qui pointe vers une ligne d'une autre table | `equipments.restaurant_id` → `restaurants.id` |
| **Clé primaire** | Identifiant unique d'une ligne | la colonne `id` de chaque table |
| **Clé publique / secrète** | Publique (*publishable*) : sans danger dans le navigateur, la RLS protège. Secrète : tous les droits, serveur seulement | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| **Client** (navigateur) | L'ordinateur ou le téléphone de l'usager | — |
| **Client Supabase** | Objet qui envoie les demandes à Supabase | `createClient()` de `lib/supabase/server.ts` |
| **Commit** | Enregistrement d'un état des fichiers dans Git, avec un message | `git commit -m "…"` |
| **Composant** | Fonction (nom en Majuscule) qui renvoie un morceau d'écran | `components/` |
| **Composant client** | Composant qui tourne dans le navigateur (état, clics) ; fichier commençant par `"use client"` | `article-form.tsx`, `nav.tsx` |
| **Composant serveur** | Composant qui tourne sur le serveur (lit la base) ; par défaut | `page.tsx`, `article-sheet.tsx` |
| **Contrainte** (`check`, `unique`) | Règle que la base vérifie à chaque écriture | `quantity >= 0`, code unique |
| **Cookie** | Petit fichier que le navigateur garde et renvoie à chaque requête ; porte la session | cookies `sb-…` |
| **CSS** | Langage de l'apparence | écrit avec Tailwind |
| **Déstructuration** | Sortir des valeurs d'un objet : `const { id } = objet` | `const { id } = await props.params` |
| **DOM** | L'arbre des éléments de la page, en mémoire dans le navigateur | outils F12 → Éléments |
| **Edge Function** | Petit programme hébergé par Supabase (en Deno) | `supabase/functions/envoyer-notification/` |
| **Enum** | Liste fermée de valeurs en base | `user_role`, `article_famille` |
| **ESLint** | Vérificateur de style et d'erreurs courantes | `npx eslint .` |
| **Événement** | Une action de l'usager (clic, frappe) | `onClick`, `onChange` |
| **Framework** | Bibliothèque qui impose une organisation | Next.js |
| **Fonction SQL** | Programme stocké dans la base (PL/pgSQL), appelé par `supabase.rpc` | `mouvement_article`, `declarer_panne` |
| **Hook** | Fonction React commençant par `use` | `useState`, `useTransition`, `useRouter` |
| **HTML** | Langage de la structure d'une page | écrit en JSX |
| **HTTP / HTTPS** | Langue des échanges client-serveur (S = chiffré) | — |
| **Hydratation** | Le navigateur rend interactif le HTML reçu du serveur | — |
| **Index** | Accélère les recherches sur une colonne | `article_mouvements_article` |
| **JSON** | Format texte de données : `{ "nom": "valeur" }` | réponses de Supabase |
| **JSX** | Le « HTML » écrit dans le code TypeScript | tout `return ( … )` d'un composant |
| **Layout** | Cadre autour des pages d'un dossier | `app/(app)/layout.tsx` (menu, session) |
| **Lint** | Vérification automatique du style | `npm run lint` |
| **Migration** | Fichier SQL daté qui fait évoluer la base ; jamais modifié une fois appliqué en ligne | `supabase/migrations/` |
| **Module** (fonctionnel) | Une partie de l'application : base + logique + écrans | Stock, Consommables, Interventions… |
| **Module** (JavaScript) | Un fichier qui exporte et importe | `import { x } from "@/lib/…"` |
| **`node_modules`** | Dossier des bibliothèques installées par `npm install` ; jamais dans Git | — |
| **npm** | Outil qui installe les bibliothèques et lance les commandes | `npm install`, `npm run dev` |
| **`params` / `searchParams`** | Segments variables (`[id]`) / paramètres après `?` de l'adresse ; promesses en Next 16 | `await props.params` |
| **pgTAP** | Outil de tests de la base | `supabase/tests/*.sql` |
| **pg_cron** | Planificateur de tâches dans la base | `taches_quotidiennes()` à 7 h |
| **pg_net** | Permet à la base d'appeler une adresse web | trigger des notifications |
| **PostgreSQL** | Le moteur de base de données | dans Supabase |
| **Prévisualisation** (*preview*) | Adresse Vercel temporaire d'une branche autre que `main` | — |
| **Promesse** (*Promise*) | Résultat « à venir » d'une opération longue | ce que renvoie une fonction `async` |
| **Props** | Paramètres passés à un composant | `<Card padded={false}>` |
| **Proxy** | Code exécuté avant chaque requête (vérifie la session) ; s'appelait *middleware* avant Next 16 | `proxy.ts` |
| **Pull request** (PR) | Demande de fusion d'une branche dans une autre, sur GitHub | branche → `staging` → `main` |
| **Push** (Git) | Envoyer ses commits sur GitHub | `git push` |
| **Push** (notification) | Alerte qui s'affiche sur le téléphone | Firebase, `push_tokens` |
| **PWA** | Site installable comme une application | `app/manifest.ts` |
| **React** | Bibliothèque pour construire des écrans en composants | — |
| **`Record`** | Type TypeScript « dictionnaire » dont toutes les clés sont obligatoires | `ROLE_LABELS`, `FAMILLE_LABELS` |
| **`redirect()`** | Envoie l'usager vers une autre adresse (serveur) | fin des actions de création |
| **Requête** | Une demande du client au serveur (ou du code à la base) | — |
| **`revalidatePath()`** | Demande à Next de refabriquer les pages après un changement | fin des actions |
| **RLS** (*Row Level Security*) | Règles de droits ligne par ligne, appliquées par PostgreSQL | `create policy …` dans les migrations |
| **Rôle** | Ce qu'un compte peut faire : propriétaire, éditeur, commentateur (technicien), lecteur | `users.role`, `auth_role()` |
| **Route handler** | Fichier `route.ts` qui renvoie une réponse brute (pas une page) | `app/firebase-messaging-sw.js/route.ts` |
| **RPC** | Appel d'une fonction SQL depuis le code | `supabase.rpc("nom", { … })` |
| **`security definer`** | Fonction SQL qui s'exécute avec les droits de son créateur ; doit vérifier elle-même rôle et restaurant | toutes les fonctions métier |
| **Serveur** | Ordinateur qui répond aux requêtes | Vercel (Next.js), Supabase (base) |
| **Service worker** | Programme du navigateur qui tourne en arrière-plan (reçoit les push) | `firebase-messaging-sw.js` |
| **Session** | Le fait d'être connecté, portée par un cookie | `lib/supabase/` |
| **SQL** | Langage pour parler à la base | `select … from … where …` |
| **Spread** (`...`) | Recopier un objet ou un tableau en le complétant | `{ ...article, name: "…" }` |
| **Stack trace** (pile d'appels) | Liste des fonctions traversées au moment d'une erreur | dans le terminal ou F12 |
| **`staging`** | Branche de travail ; `main` = production | — |
| **État** (*state*) | Mémoire d'un composant client | `useState` |
| **Storage** | Stockage de fichiers de Supabase | photos d'intervention |
| **Studio** | Interface web de Supabase (tables, SQL) | http://127.0.0.1:54323 en local |
| **Tailwind** | Classes CSS courtes écrites dans `className` | `className="flex gap-3 bg-surface"` |
| **Template literal** | Texte avec valeurs : `` `Il reste ${n}` `` | messages des actions |
| **Terminal** | Fenêtre où l'on tape des commandes | — |
| **Transaction** | Groupe d'opérations en base : tout réussit, ou rien n'est enregistré | chaque fonction SQL |
| **Trigger** | Fonction lancée automatiquement quand une table change | `trg_notifications_envoi` |
| **Turbopack** | Le moteur qui assemble le code de Next | affiché par `npm run dev` |
| **TypeScript** | JavaScript avec des types | fichiers `.ts`, `.tsx` |
| **Union** (type) | Une valeur parmi une liste : `"a" \| "b"` | `Role` |
| **URL** | Adresse d'une page | `https://gmao-chitir.vercel.app/stock` |
| **`"use client"` / `"use server"`** | Première ligne d'un fichier : composant client / actions serveur | — |
| **UUID** | Identifiant unique aléatoire (longue suite de caractères) | les colonnes `id` |
| **Variable d'environnement** | Réglage donné au programme hors du code ; `NEXT_PUBLIC_` = visible dans le navigateur | `.env.example` |
| **Vercel** | L'hébergeur de l'application ; déploie à chaque fusion dans `main` | — |

---

🎓 **Fin de la formation.** Tu as maintenant tout ce qu'il faut pour reprendre la GMAO en main. Garde sous la main `docs/comprendre-le-projet.md` (le résumé), le [chapitre 08](08-reference-du-code.md) (qui fait quoi) et le [chapitre 09](09-ajouter-une-fonctionnalite.md) (les recettes). Et n'oublie pas : **la base d'abord, une branche par tâche, les tests avant chaque commit.**

👉 Retour au [sommaire](00-LISEZ-MOI.md)
