# Chapitre 05 — Next.js, comment ça marche

**Objectif** : comprendre **globalement** ce que fait Next.js, puis **chaque mécanisme** utilisé par la GMAO, avec le fichier où le voir. C'est le chapitre le plus important : prends ton temps, ouvre chaque fichier cité.

> ⚠️ La GMAO utilise **Next.js 16**. Beaucoup de tutoriels sur Internet décrivent les versions 12 à 14, qui fonctionnaient autrement (dossier `pages/`, `getServerSideProps`, `middleware.ts`…). **Ignore-les.** La documentation qui fait foi est celle installée avec le projet : `node_modules/next/dist/docs/` (en anglais). Ce chapitre te dit quoi y lire.

---

## 1. Next.js en une image

React (chapitre 04) sait **dessiner** des écrans. Mais il ne sait pas, seul :
- quelle page afficher pour quelle adresse ;
- lire une base de données en sécurité ;
- recevoir un formulaire côté serveur ;
- produire une version rapide pour la mise en ligne.

**Next.js ajoute tout cela autour de React.** C'est un **framework** : tu ranges ton code là où il l'attend, il fait le reste.

```
                       ┌─────────────────────── NEXT.JS ───────────────────────┐
                       │                                                       │
 navigateur ──requête──►  proxy.ts ──► routeur ──► layouts ──► page ──► HTML   ├──► navigateur
                       │ (session ?)  (quel     (cadre,      (lit la          │    (affiche,
                       │              fichier ?) menu)       base)            │     puis rend
                       │                                                       │     interactif)
 navigateur ──action──►   action serveur ("use server") ──► base ──► résultat ├──► navigateur
                       └───────────────────────────────────────────────────────┘
```

Retiens les **deux grands chemins** :
1. **Afficher** une page : requête → proxy → layouts → page (qui lit la base) → HTML.
2. **Enregistrer** quelque chose : le navigateur appelle une **action serveur** → elle écrit en base → elle renvoie un résultat et rafraîchit les pages concernées.

Tout le reste de ce chapitre détaille ces deux chemins.

---

## 2. Développement et production

| | `npm run dev` (`next dev`) | `npm run build` puis `npm run start` |
|---|---|---|
| Pour | travailler sur ton poste | la mise en ligne |
| Vitesse | fabrique chaque page à la demande, se met à jour à chaque enregistrement | tout est préparé et optimisé à l'avance |
| Erreurs | affichées en détail (terminal + panneau dans le navigateur) | messages génériques (sécurité) |
| Dossier | `.next/dev/` | `.next/` |

En ligne, **Vercel** fait `npm run build` à chaque fusion dans la branche `main`, puis sert le résultat. Tu n'as rien à lancer toi-même.

**Turbopack** (affiché au démarrage : « Next.js 16.3.7 (Turbopack) ») est le moteur qui assemble le code. Tu n'as pas à t'en occuper.

À la fin de `npm run build`, Next affiche la liste des pages avec un symbole :
- `ƒ` (*Dynamic*) : fabriquée **à chaque visite** (presque toutes les pages de la GMAO, car elles dépendent de l'usager connecté et de la base) ;
- `○` (*Static*) : fabriquée **une fois** au build (la page de connexion, le manifeste…).

---

## 3. Le routage : un dossier = une adresse

📖 Doc officielle : `01-app/01-getting-started/02-project-structure.md` et `03-layouts-and-pages.md`.

Il n'y a **aucun fichier de routes** à écrire. L'arborescence de `app/` **est** la liste des adresses :

```
app/
├── layout.tsx                         cadre racine de TOUT le site
├── connexion/page.tsx                 → /connexion
├── changer-mot-de-passe/page.tsx      → /changer-mot-de-passe
├── manifest.ts                        → /manifest.webmanifest   (fichier spécial)
├── firebase-messaging-sw.js/route.ts  → /firebase-messaging-sw.js (route API)
└── (app)/                             (dossier de rangement : n'apparaît PAS dans l'adresse)
    ├── layout.tsx                     cadre des pages connectées
    ├── page.tsx                       → /
    ├── stock/
    │   ├── page.tsx                   → /stock
    │   ├── nouvelle/page.tsx          → /stock/nouvelle
    │   └── [id]/
    │       ├── page.tsx               → /stock/<n'importe quel id>
    │       └── modifier/page.tsx      → /stock/<id>/modifier
    └── consommables/ …                → /consommables, /consommables/<id>, …
```

**Trois conventions de noms de dossier :**

| Forme | Sens | Exemple |
|---|---|---|
| `stock` | segment fixe de l'adresse | `/stock` |
| `[id]` | segment **variable** : la page reçoit sa valeur | `/stock/8f3a…` → `id = "8f3a…"` |
| `(app)` | **groupe** : sert à ranger et à partager un layout, invisible dans l'adresse | `app/(app)/stock` → `/stock` |

⚠️ Un dossier **sans** `page.tsx` n'est pas une page : `/stock/[id]` existe parce que `app/(app)/stock/[id]/page.tsx` existe.

---

## 4. Les fichiers spéciaux

Dans un dossier de `app/`, Next reconnaît ces noms :

| Fichier | Rôle | Dans la GMAO |
|---|---|---|
| `page.tsx` | **La page** de cette adresse. Doit faire `export default` d'un composant | 32 pages (`find app -name page.tsx`) |
| `layout.tsx` | **Le cadre** qui entoure la page **et toutes les pages des sous-dossiers**. Il reste affiché quand on navigue entre ces pages | `app/layout.tsx` (balise `<html>`, polices), `app/(app)/layout.tsx` (session, menu), `app/(app)/admin/layout.tsx` (réservé aux admins) |
| `loading.tsx` | Affiché **pendant** que la page lit la base | `app/(app)/stock/loading.tsx`, etc. |
| `error.tsx` | Affiché **si la page plante** (avec un bouton « Réessayer ») | `app/(app)/error.tsx` |
| `route.ts` | Pas une page, mais une **réponse brute** (fichier, JSON…) | `app/firebase-messaging-sw.js/route.ts` génère le script des notifications |
| `manifest.ts`, `apple-icon.png`, `favicon.ico` | **Fichiers de métadonnées** : Next les sert à la bonne adresse | application installable |

Tout autre nom (`actions.ts` par exemple) est un fichier ordinaire : Next l'ignore pour le routage. `actions.ts` est **notre convention** pour ranger les actions serveur d'un écran.

---

## 5. Les layouts s'emboîtent

Quand tu ouvres `/consommables/8f3a…`, Next **emboîte** tous les layouts du chemin, puis la page :

```
app/layout.tsx                         <html lang="fr"> + polices
└── app/(app)/layout.tsx               session vérifiée, menu latéral, barre du bas
    └── app/(app)/consommables/[id]/page.tsx    la fiche de l'article
```

Le layout reçoit la page dans sa prop `children`. Voici, simplifié, `app/(app)/layout.tsx` :

```tsx
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();                         // qui est connecté ?
  if (!profile) redirect("/connexion");                       // personne : vers la connexion
  if (profile.must_change_password) redirect("/changer-mot-de-passe");

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar firstName={profile.first_name ?? ""} … />      {/* menu ordinateur */}
      <main>{children}</main>                                  {/* ← LA PAGE s'insère ici */}
      <BottomNav />                                            {/* barre du bas mobile */}
    </div>
  );
}
```

**Conséquence** : toute page que tu crées dans `app/(app)/` a **automatiquement** le menu et la vérification de session. Tu ne t'en occupes jamais.

---

## 6. Une page, ligne par ligne

📖 Doc : `01-app/01-getting-started/03-layouts-and-pages.md`.

Voici la vraie page de la liste des consommables, `app/(app)/consommables/page.tsx`, commentée :

```tsx
// ① Imports : les fonctions de lecture (lib/) et le composant d'affichage (components/).
import { getNavCounts, getProfile } from "@/lib/session";
import { canEditConsommables, chargerListe } from "@/lib/consommables";
import { lireFiltres } from "@/lib/consommables-rules";
import { ArticleList } from "@/components/app/consommables/article-list";

// ② « export default » : c'est CE composant que Next affiche pour /consommables.
//    « async » : il a le droit d'attendre (await) la base.
//    PageProps<"/consommables"> : le type des props, fourni par Next (vérifie l'adresse).
export default async function ConsommablesPage(props: PageProps<"/consommables">) {
  // ③ Les paramètres d'adresse (?restaurant=CTR1&famille=boisson), transformés en filtres.
  //    ⚠️ Next 16 : searchParams est une PROMESSE → await obligatoire.
  const filters = lireFiltres(await props.searchParams);

  // ④ Trois lectures EN MÊME TEMPS (Promise.all), plus rapide qu'une par une.
  const [list, profile, { unread }] = await Promise.all([
    chargerListe(filters),   // les articles, filtrés
    getProfile(),            // l'usager connecté (pour savoir s'il peut créer)
    getNavCounts(),          // le nombre de notifications non lues (cloche)
  ]);

  // ⑤ L'affichage : on passe les données au composant, en props.
  return (
    <div className="max-w-6xl mx-auto">
      <ArticleList {...list} filters={filters} unread={unread} canCreate={canEditConsommables(profile?.role)} />
    </div>
  );
}
```

**Le motif de TOUTES les pages du projet** : lire les paramètres → lire les données (`lib/`) → passer les données à un composant (`components/`). Une page fait rarement plus de 30 lignes.

### `params` et `searchParams`

| Prop | Contient | Exemple pour `/consommables/8f3a?restaurant=CTR1` |
|---|---|---|
| `props.params` | les segments variables `[…]` | `{ id: "8f3a" }` |
| `props.searchParams` | les paramètres après `?` | `{ restaurant: "CTR1" }` |

Les deux sont des **promesses** en Next 16 : `const { id } = await props.params;`. Pour lire les deux en parallèle :
```tsx
const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
```

---

## 7. Composants serveur et composants client

📖 Doc : `01-app/01-getting-started/05-server-and-client-components.md` (à lire absolument).

C'est **la** grande idée de Next moderne. Chaque composant tourne **à un seul endroit** :

```
              SERVEUR (Vercel)                         NAVIGATEUR (téléphone)
   ┌───────────────────────────────────┐      ┌───────────────────────────────────┐
   │ Composants SERVEUR (par défaut)   │      │ Composants CLIENT ("use client")  │
   │ • page.tsx, layout.tsx            │ HTML │ • formulaires, boutons, filtres   │
   │ • article-sheet.tsx, *-list.tsx   │ ───► │ • article-form.tsx, nav.tsx       │
   │ ✅ lisent la base, les secrets    │      │ ✅ useState, onClick, onChange    │
   │ ❌ pas de clic, pas de useState   │      │ ❌ pas d'accès direct à la base   │
   └───────────────────────────────────┘      └───────────────────────────────────┘
```

**Comment Next sait lequel est lequel ?** Par **défaut, tout est serveur**. Un fichier qui commence par la ligne :

```tsx
"use client";
```

devient un composant client, **ainsi que tout ce qu'il importe**.

**Quand mettre `"use client"` ?** Seulement si le composant a besoin :
- d'un **état** (`useState`, `useTransition`…) ;
- d'**événements** (`onClick`, `onChange`, `onSubmit`) ;
- d'outils du **navigateur** (`window`, `localStorage`, appareil photo…) ;
- des hooks de navigation (`useRouter`, `usePathname`, `useSearchParams`).

**Le découpage type dans la GMAO** — exemple de la fiche article :

```
consommables/[id]/page.tsx        SERVEUR : lit l'article
  └─ article-sheet.tsx            SERVEUR : lit l'historique, affiche les quantités
       └─ article-operation.tsx   CLIENT  : formulaire « Mettre à jour le stock »
```

Les données descendent du serveur vers le client **en props**. Elles doivent être « transportables » : textes, nombres, objets, tableaux. **Pas de fonction**, sauf les **actions serveur** (section 9), que Next sait transmettre.

### Et l'« hydratation » ?

Quand la page arrive, le navigateur affiche d'abord le **HTML** (instantané, même les parties client). Puis le JavaScript des composants client se charge et les **rend interactifs** : c'est l'**hydratation**. Si ce que le serveur a dessiné diffère de ce que le client dessine (une date calculée différemment, par exemple), React affiche une erreur d'« hydration mismatch ». Rare dans le projet.

---

## 8. Lire des données

📖 Doc : `01-app/01-getting-started/06-fetching-data.md`.

Dans un composant **serveur**, on lit la base **directement**, avec `await`. Pas d'API intermédiaire. Toutes les lectures du projet sont rangées dans `lib/` :

```ts
// lib/consommables.ts
export async function getArticle(id: string) {
  const supabase = await createClient();            // client Supabase AVEC la session de l'usager
  const { data } = await supabase.from("articles").select(SELECT).eq("id", id).maybeSingle();
  return data;
}
```

`createClient()` (de `lib/supabase/server.ts`) lit le **cookie de session** : la base sait qui demande et ne renvoie **que ce qu'il a le droit de voir** (RLS, chapitre 07).

### Ne lire qu'une fois par requête : `cache`

Le layout **et** la page ont besoin du profil de l'usager. Pour ne pas le lire deux fois, `lib/session.ts` l'enveloppe dans `cache()` de React :

```ts
export const getProfile = cache(async () => { … });   // 1re fois : lit la base ; ensuite : réutilise
```

Ce cache ne dure que **le temps d'une requête** : à la page suivante, le profil est relu.

---

## 9. Écrire des données : les actions serveur

📖 Doc : `01-app/01-getting-started/07-mutating-data.md`, puis `01-app/02-guides/server-actions.md` et `data-security.md`.

Une **action serveur** est une fonction `async` placée dans un fichier qui commence par **`"use server"`**. Le navigateur peut l'appeler **comme une fonction normale** ; en coulisse, Next envoie une requête `POST` au serveur, exécute la fonction là-bas, et renvoie le résultat.

```
 article-operation.tsx (navigateur)         actions.ts (serveur)                 Supabase
 ──────────────────────────────────         ────────────────────                 ────────
 const res = await operationArticle({…}) ─► vérifie la saisie
                                            supabase.rpc("mouvement_article") ─► vérifie droits,
                                                                              ◄─ écrit
                                            revalidatePath("/", "layout")
 setResult(res)  ◄───────────────────────── return { ok: true, message }
```

La structure de **toutes** les actions du projet (`app/(app)/consommables/actions.ts`) :

```ts
"use server";                                                // ① tout le fichier = actions serveur

export async function operationArticle(input: OperationInput): Promise<ConsoResult> {
  const invalide = verifierOperation(input);                 // ② vérifier la saisie (message clair)
  if (invalide) return { ok: false, ...invalide };

  const supabase = await createClient();                     // ③ écrire, avec la session de l'usager
  const { error } = await supabase.rpc("mouvement_article", { p_article: input.articleId, … });

  if (error) return { ok: false, error: sqlMessage(error, "…") };   // ④ erreur : on la renvoie
  revalidatePath("/", "layout");                             // ⑤ rafraîchir les pages
  return { ok: true, message: "Livraison enregistrée." };    // ⑥ succès
}
```

### Les trois fonctions de Next utilisées dans les actions

| Fonction | Effet | Quand |
|---|---|---|
| `revalidatePath("/", "layout")` | « Les données ont changé : refabrique les pages ». Le projet rafraîchit tout (`"/"` + `"layout"`), ce qui met aussi à jour les compteurs du menu | Après **toute** écriture réussie |
| `redirect("/consommables/" + id)` | Envoie l'usager vers une autre page | Après une **création** ou une **suppression** |
| `notFound()` | Affiche la page 404 | Dans une page, quand la donnée n'existe pas |

⚠️ `redirect()` fonctionne en **interrompant** la fonction (techniquement, il « lance » une exception spéciale). Ne le mets jamais dans un `try { … } catch`, et place-le **en dernier**.

### 🔒 Sécurité des actions

Une action serveur est une **porte ouverte** sur le serveur : n'importe qui de connecté peut l'appeler avec n'importe quelles données, sans passer par ton formulaire. D'où les règles du projet :
- l'action **revérifie toujours la saisie** (la vérification du formulaire n'est qu'un confort) ;
- l'action utilise le client **avec la session de l'usager**, jamais la clé secrète (sauf administration des comptes) ;
- **la base vérifie les droits** (RLS, fonctions SQL). Même si l'action avait un bug, la base refuserait.

---

## 10. Naviguer entre les pages

| Outil | Où | Usage dans la GMAO |
|---|---|---|
| `<Link href="/stock">` (de `next/link`) | partout | **Tous** les liens internes. Next précharge la page et navigue sans recharger tout le site |
| `redirect("/…")` (de `next/navigation`) | serveur (page, layout, action) | après une création, garde de rôle en haut d'une page |
| `useRouter()` → `router.push("/…")` | client | aller ailleurs après une action (`panne/declare-form.tsx`) |
| `router.replace("/…?q=…")` | client | changer les filtres sans ajouter d'entrée dans l'historique (`url-filters.tsx`) |
| `router.refresh()` | client | relire les données de la page actuelle (`intervention-photos.tsx`) |
| `usePathname()` | client | savoir sur quelle page on est (onglet actif du menu, `nav.tsx`) |

⚠️ Utilise `<Link>`, pas `<a href>`, pour les liens internes : sinon chaque clic recharge toute l'application.

---

## 11. Chargement et erreurs

📖 Doc : `01-app/01-getting-started/10-error-handling.md`.

- **`loading.tsx`** : pendant que la page lit la base, Next affiche ce fichier à la place. Dans le projet, ils utilisent tous `<LoadingState>` (`components/app/loading-state.tsx`), un squelette gris animé.
- **`error.tsx`** : si une page plante, Next affiche ce fichier (doit être un composant client). Il reçoit l'`error` et une fonction **`retry`** (bouton « Réessayer »). ⚠️ Les vieux tutoriels l'appellent `reset` : en Next 16, c'est `retry`.

---

## 12. Le proxy : la porte d'entrée

📖 Doc : `01-app/01-getting-started/16-proxy.md`.

`proxy.ts`, à la racine, s'exécute **avant chaque requête** (avant même le layout). *Avant Next 16, ce fichier s'appelait `middleware.ts` : tu verras ce nom partout sur Internet.*

```ts
// proxy.ts
export async function proxy(request: NextRequest) {
  return await updateSession(request);       // lib/supabase/middleware.ts
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|…).*)"],   // toutes les adresses, sauf les fichiers statiques
};
```

`updateSession` (dans `lib/supabase/middleware.ts`) :
1. rafraîchit la session (le jeton expire régulièrement, il le renouvelle) ;
2. **pas connecté et page privée → redirection vers `/connexion`** ;
3. connecté et sur `/connexion` → redirection vers l'accueil.

Les pages accessibles **sans** connexion sont listées dans `PUBLIC_PATHS` (aujourd'hui : `/connexion` seulement).

---

## 13. Variables d'environnement

Les réglages hors du code (chapitre 01) se lisent avec `process.env.NOM`.

| Préfixe | Visible où | Exemple |
|---|---|---|
| `NEXT_PUBLIC_…` | serveur **et navigateur** (recopiée dans le JavaScript envoyé) | `NEXT_PUBLIC_SUPABASE_URL` |
| sans préfixe | **serveur seulement** | `SUPABASE_SECRET_KEY` |

🔒 **Ne jamais** mettre un secret dans une variable `NEXT_PUBLIC_`. Et ne jamais importer `lib/supabase/admin.ts` (qui utilise la clé secrète) dans un composant client.

⚠️ Les `NEXT_PUBLIC_` sont **figées au moment du build** : si tu en changes une sur Vercel, il faut **redéployer**.

---

## 14. Le reste du décor

| Élément | Fichier | Rôle |
|---|---|---|
| Titre de l'onglet, métadonnées iPhone | `app/layout.tsx` (`export const metadata`) | `title: "GMAO Chitir Chicken"` |
| Polices | `app/layout.tsx` (`next/font/google`) | Figtree (texte), Poppins (titres), téléchargées au build |
| Images optimisées | `<Image>` de `next/image` | le logo (`nav.tsx`, `connexion/page.tsx`) |
| Styles globaux et couleurs | `app/globals.css` | Tailwind + les couleurs du thème (chapitre 06) |
| Réglages de Next | `next.config.ts` | `allowedDevOrigins` : tester depuis un téléphone sur le réseau local |
| Réglages TypeScript | `tsconfig.json` | l'alias `@/` = la racine |
| Types générés | `next-env.d.ts`, `.next/types` | `PageProps`, `LayoutProps` (régénérés par `next dev`, `next build` ou `npx next typegen`) |
| Instructions pour les assistants | `AGENTS.md`, `CLAUDE.md` | réécrits par `next dev` ; à laisser tels quels |

---

## 15. Next 16 : ce qui diffère des tutoriels

| Tu lis sur Internet… | Dans ce projet (Next 16) |
|---|---|
| dossier `pages/`, `getServerSideProps`, `getStaticProps` | dossier **`app/`**, lecture directe dans les composants serveur |
| `middleware.ts`, fonction `middleware` | **`proxy.ts`**, fonction `proxy` |
| `params.id` directement | **`(await props.params).id`** |
| `error.tsx` reçoit `reset` | reçoit **`retry`** |
| routes API `pages/api/…` pour les formulaires | **actions serveur** (`"use server"`) |
| `next dev` écrit dans `.next/` | écrit dans **`.next/dev/`** (on peut lancer `next build` en même temps) |

---

## ✅ Ce qu'il faut retenir

- **Un dossier de `app/` = une adresse**, `page.tsx` = la page, `layout.tsx` = le cadre, `[id]` = variable, `(app)` = rangement.
- **Par défaut, serveur** (lit la base). **`"use client"`** seulement pour l'interactif.
- **Lire** : dans la page serveur, via `lib/`. **Écrire** : action serveur `"use server"` → base → `revalidatePath`.
- `proxy.ts` + `app/(app)/layout.tsx` protègent **toutes** les pages de `app/(app)/`.
- `params` et `searchParams` sont des **promesses** : `await`.

## 🏋️ Exercice 5

1. Quel fichier affiche l'adresse `/admin/categories/nouveau` ? Et quel layout vérifie qu'on a le droit d'y être ?
2. Ouvre `components/app/stock/stock-controls.tsx` : est-ce un composant serveur ou client ? Pourquoi doit-il l'être ?
3. Dans `app/(app)/stock/actions.ts`, trouve l'action appelée par le bouton « Enregistrer une livraison », et la fonction SQL qu'elle appelle.
4. Crée une page `app/(app)/essai/page.tsx` qui affiche « Bonjour » et le prénom de l'usager (indice : `getProfile()`). Ouvre `/essai`. Puis supprime-la.

👉 Chapitre suivant : [L'architecture du projet](06-architecture.md)
