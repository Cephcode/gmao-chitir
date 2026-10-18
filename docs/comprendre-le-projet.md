# Comprendre le projet et le faire évoluer

**Pour qui ?** Pour un développeur qui ne travaille pas d'habitude avec Next.js et qui doit reprendre la GMAO Chitir : comprendre comment elle marche, s'y retrouver, modifier un écran, ajouter un module.

**Comment le lire ?** Dans l'ordre la première fois (une heure environ). Ensuite, comme un aide-mémoire : la [section 9](#9-aide-mémoire--je-veux-) répond à « je veux faire X, je touche à quoi ? ».

Les autres documents vont plus loin sur un sujet précis :
- `docs/guide-developpeur.md` : la carte détaillée (chaque écran, chaque fichier, pièges déjà rencontrés) ;
- `docs/base-de-donnees.md` : toutes les tables, fonctions et droits ;
- `docs/plan-module-consommables.md` : un exemple complet de module ajouté de A à Z.

---

## Sommaire

1. [L'application en 2 minutes](#1-lapplication-en-2-minutes)
2. [Next.js expliqué simplement (les 7 notions à connaître)](#2-nextjs-expliqué-simplement)
3. [Où se trouve quoi](#3-où-se-trouve-quoi)
4. [Le trajet d'un clic, de l'écran à la base](#4-le-trajet-dun-clic-de-lécran-à-la-base)
5. [La base de données : Supabase en clair](#5-la-base-de-données--supabase-en-clair)
6. [L'apparence : Tailwind et les composants](#6-lapparence--tailwind-et-les-composants)
7. [Modifier un module existant (exemples pas à pas)](#7-modifier-un-module-existant)
8. [Ajouter un nouveau module (modèle complet à recopier)](#8-ajouter-un-nouveau-module)
9. [Aide-mémoire : « je veux… »](#9-aide-mémoire--je-veux-)
10. [Lancer, tester, mettre en ligne](#10-lancer-tester-mettre-en-ligne)
11. [Quand ça ne marche pas](#11-quand-ça-ne-marche-pas)
12. [Petit lexique](#12-petit-lexique)

---

## 1. L'application en 2 minutes

La GMAO Chitir sert à **suivre la maintenance et le stock** des restaurants Chitir Chicken : machines, pannes, interventions, entretiens, pièces détachées, consommables, alertes. Elle s'utilise surtout sur téléphone.

Elle est faite de **trois morceaux** :

```
  ┌──────────────────────────┐
  │  Le navigateur           │   téléphone ou ordinateur
  │  (ce que voit l'usager)  │
  └────────────┬─────────────┘
               │  1. demande une page / envoie un formulaire
               ▼
  ┌──────────────────────────┐
  │  Next.js (sur Vercel)    │   le CODE de ce dépôt :
  │  fabrique les pages,     │   app/, components/, lib/
  │  reçoit les formulaires  │
  └────────────┬─────────────┘
               │  2. lit / écrit les données
               ▼
  ┌──────────────────────────┐
  │  Supabase                │   la BASE : supabase/migrations/
  │  base PostgreSQL,        │   (tables, droits, fonctions)
  │  comptes, photos         │
  └──────────────────────────┘
```

Autour, deux services envoient les alertes : **Firebase** (notifications sur le téléphone) et **Resend** (e-mails). Ils sont appelés par la base, vous n'y toucherez presque jamais.

**La règle la plus importante du projet :**

> 🔒 **La sécurité est dans la base, pas dans l'écran.**
> L'écran *cache* les boutons qu'un rôle ne peut pas utiliser, par confort. Mais c'est la base qui *refuse* vraiment. Toute nouvelle règle de droits s'écrit donc **d'abord en base**, puis on adapte l'écran.

Les **4 rôles** :

| Rôle | Qui c'est | Ce qu'il peut faire |
|---|---|---|
| Propriétaire | le patron | tout, sur tous les restaurants |
| Éditeur | un responsable | gérer machines, stock, comptes de **ses** restaurants |
| Commentateur | un technicien | traiter les interventions de ses restaurants |
| Lecteur | le personnel | consulter, déclarer une panne |

**« Le restaurant décide ce qu'on voit, le rôle décide ce qu'on fait. »**

---

## 2. Next.js expliqué simplement

Next.js est un outil pour faire des sites avec **React**. Si vous venez de PHP, Laravel, Django ou Express, voici l'équivalence en une phrase : **Next.js = le routeur + les contrôleurs + les vues, dans les mêmes fichiers, en TypeScript.**

Il n'y a que **7 notions** à connaître pour ce projet.

### Notion 1 : un dossier = une adresse

Pas de fichier de routes à écrire. **L'arborescence du dossier `app/` EST la liste des adresses du site.**

```
app/(app)/page.tsx                          →  /
app/(app)/stock/page.tsx                    →  /stock
app/(app)/stock/nouvelle/page.tsx           →  /stock/nouvelle
app/(app)/stock/[id]/page.tsx               →  /stock/8f3a…   (n'importe quel id)
app/(app)/stock/[id]/modifier/page.tsx      →  /stock/8f3a…/modifier
app/connexion/page.tsx                      →  /connexion
```

Deux conventions dans les noms de dossier :
- **`[id]`** entre crochets = une partie **variable** de l'adresse. La page reçoit sa valeur (voir notion 2).
- **`(app)`** entre parenthèses = un dossier de **rangement**, invisible dans l'adresse. Ici, il regroupe toutes les pages réservées aux comptes connectés, pour leur donner le même cadre (menu, vérification de session).

### Notion 2 : les fichiers aux noms réservés

Dans chaque dossier de `app/`, certains noms de fichier ont un rôle précis :

| Fichier | Rôle | Exemple dans le projet |
|---|---|---|
| `page.tsx` | **La page** affichée à cette adresse | `app/(app)/stock/page.tsx` |
| `layout.tsx` | **Le cadre** autour de toutes les pages du dossier et des sous-dossiers (menu, en-tête) | `app/(app)/layout.tsx` : vérifie la session, affiche le menu |
| `loading.tsx` | Ce qui s'affiche **pendant le chargement** | `app/(app)/stock/loading.tsx` |
| `error.tsx` | Ce qui s'affiche **en cas d'erreur** | `app/(app)/error.tsx` |
| `actions.ts` | **Pas un nom réservé** : c'est notre convention pour ranger les actions serveur (notion 5) | `app/(app)/stock/actions.ts` |

Une page ressemble à ceci (version simplifiée de `app/(app)/consommables/[id]/page.tsx`) :

```tsx
// Next appelle cette fonction quand quelqu'un ouvre /consommables/<id>.
// props.params contient la partie variable de l'adresse ; props.searchParams, ce qui suit le « ? ».
export default async function ArticlePage(props: PageProps<"/consommables/[id]">) {
  const { id } = await props.params;          // ⚠️ en Next 16, params est une promesse : toujours « await »
  const article = await getArticle(id);       // lecture en base (lib/consommables.ts)
  if (!article) notFound();                   // page 404
  return <ArticleSheet article={article} />;  // ce qu'on affiche (du HTML écrit en JSX)
}
```

Le « HTML dans le code » s'appelle **JSX**. Deux différences à retenir avec le HTML : `class` s'écrit `className`, et on insère une valeur avec des accolades : `<h1>{article.name}</h1>`.

### Notion 3 : code serveur et code navigateur

C'est **la** notion qui déroute au début. Chaque fichier de composant tourne **soit sur le serveur, soit dans le navigateur** :

| | **Composant serveur** (par défaut) | **Composant client** (`"use client"` en 1re ligne) |
|---|---|---|
| Où il tourne | sur le serveur (Vercel), une seule fois par requête | dans le navigateur de l'usager |
| Peut lire la base ? | ✅ oui, directement | ❌ non |
| Peut réagir à un clic, une saisie ? | ❌ non | ✅ oui (`onClick`, `useState`…) |
| Exemples | toutes les `page.tsx`, `article-sheet.tsx`, `article-list.tsx` | formulaires : `article-form.tsx`, `article-operation.tsx`, `nav.tsx` |

**La règle pratique :** une page (serveur) **lit** les données, puis les **passe** à un composant client pour tout ce qui est interactif.

```
page.tsx (serveur)                       article-operation.tsx ("use client")
  lit l'article en base        ───────►    affiche le formulaire, réagit aux clics,
  <ArticleOperation stocks={…} />          appelle une action serveur à l'envoi
```

Si vous oubliez `"use client"` dans un fichier qui utilise `useState` ou `onClick`, Next affiche une erreur claire au lancement : ajoutez la ligne.

### Notion 4 : lire des données

Dans un composant serveur, on lit la base **directement**, avec `await`. Pas d'API intermédiaire à écrire. Ici, toutes les lectures sont rangées dans `lib/` :

```ts
// lib/consommables.ts
export async function getArticle(id: string) {
  const supabase = await createClient();                // client Supabase AVEC la session de l'usager
  const { data } = await supabase.from("articles").select("id, name, code").eq("id", id).maybeSingle();
  return data;
}
```

Comme le client utilise **la session de l'usager**, la base ne renvoie que ce qu'il a le droit de voir (voir section 5, « RLS »). Un éditeur de CTR1 ne recevra jamais les lignes de CTR2, même si le code oublie de filtrer.

### Notion 5 : écrire des données (les « actions serveur »)

Pour enregistrer (formulaire, bouton), on écrit une **action serveur** : une fonction `async` dans un fichier qui commence par `"use server"`. Le composant client l'appelle **comme une fonction normale** ; Next se charge de l'envoyer au serveur.

```ts
// app/(app)/consommables/actions.ts
"use server";

export async function operationArticle(input: OperationInput) {
  const invalide = verifierOperation(input);           // 1. vérifier la saisie
  if (invalide) return { ok: false, ...invalide };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mouvement_article", { … }); // 2. écrire en base

  if (error) return { ok: false, error: "…" };
  revalidatePath("/", "layout");                        // 3. rafraîchir les pages concernées
  return { ok: true, message: "Livraison enregistrée." };
}
```

```tsx
// components/app/consommables/article-operation.tsx  ("use client")
const res = await operationArticle({ articleId, operation, quantite, … });
setResult(res);   // affiche le message ou l'erreur
```

Trois fonctions de Next reviennent tout le temps dans les actions :
- **`revalidatePath("/", "layout")`** : « les données ont changé, recalcule les pages ». Sans lui, l'écran montre l'ancienne valeur.
- **`redirect("/consommables/123")`** : envoie l'usager vers une autre page (après une création, par exemple).
- **`notFound()`** : affiche la page 404.

⚠️ Une action serveur peut être appelée **par n'importe qui** qui connaît son existence, pas seulement depuis vos écrans. C'est pour cela qu'on ne s'appuie jamais sur l'écran pour la sécurité : la base vérifie.

### Notion 6 : le « proxy » (la porte d'entrée)

`proxy.ts`, à la racine, s'exécute **avant chaque page**. Dans d'autres outils, on appelle ça un *middleware* (c'était aussi son nom avant Next 16). Ici, il fait une seule chose : vérifier que l'usager est connecté, sinon le renvoyer vers `/connexion`. Le détail est dans `lib/supabase/middleware.ts` (liste `PUBLIC_PATHS` des pages accessibles sans connexion).

Ensuite, `app/(app)/layout.tsx` fait un second contrôle : profil existant, mot de passe temporaire à changer.

**Conséquence pratique : toute page créée dans `app/(app)/` est protégée d'office.** Vous n'avez rien à faire.

### Notion 7 : les filtres sont dans l'adresse

Les listes (machines, interventions, stock, consommables) gardent leurs filtres **dans l'adresse** : `/consommables?restaurant=CTR1&famille=boisson`. La page les lit dans `props.searchParams`. Avantages : le bouton « retour » les garde, et on peut envoyer le lien à quelqu'un.

Chaque module a dans `lib/` une fonction `readFilters` (ou `lireFiltres`) qui lit l'adresse, et `filtersQuery` (ou `filtresQuery`) qui la reconstruit. Le composant `components/app/url-filters.tsx` affiche la recherche et les puces de filtre.

### Et le reste ?

- **TypeScript** : du JavaScript avec des types (`name: string`). L'éditeur souligne les erreurs avant même de lancer. `npx tsc --noEmit` vérifie tout le projet.
- **`@/`** au début d'un import = la racine du projet. `@/lib/stock` = le fichier `lib/stock.ts`.
- **Documentation officielle** de la version installée : `node_modules/next/dist/docs/` (en anglais). Lire en priorité `01-app/01-getting-started/` : 03 (pages), 05 (serveur et client), 06 (lire), 07 (écrire), 16 (proxy). C'est la seule qui fait foi : beaucoup de tutoriels sur Internet décrivent d'anciennes versions.

---

## 3. Où se trouve quoi

```
gmao-chitir/
├── app/                        LES PAGES (une adresse = un dossier)
│   ├── (app)/                    pages réservées aux comptes connectés
│   │   ├── layout.tsx              cadre commun : session, menu
│   │   ├── page.tsx                tableau de bord  (/)
│   │   ├── equipements/            machines         (/equipements)
│   │   ├── interventions/          interventions    (/interventions)
│   │   ├── panne/                  déclarer une panne
│   │   ├── stock/                  pièces détachées (/stock)
│   │   ├── consommables/           stock des restaurants (/consommables)
│   │   ├── notifications/          alertes
│   │   └── admin/                  comptes, restaurants, catégories
│   ├── connexion/                page de connexion (publique)
│   ├── layout.tsx                cadre racine : polices, titre de l'onglet
│   └── globals.css               COULEURS, polices, arrondis
│
├── components/                 LES MORCEAUX D'ÉCRAN
│   ├── ui/                       briques génériques : bouton, champ, carte, badge…
│   ├── app/<module>/             morceaux propres à un module (liste, fiche, formulaire)
│   ├── app/nav.tsx               menu latéral et barre du bas
│   └── icons.tsx                 toutes les icônes
│
├── lib/                        LA LOGIQUE
│   ├── <module>.ts               lectures en base + droits d'affichage (canEdit…)
│   ├── <module>-rules.ts         règles pures, sans base (testables)
│   ├── session.ts                usager connecté, son rôle
│   └── supabase/                 connexion à Supabase
│
├── supabase/                   LA BASE
│   ├── migrations/               tout le schéma, fichier par fichier, dans l'ordre
│   ├── tests/                    tests SQL (droits, règles métier)
│   └── functions/                Edge Function d'envoi des alertes
│
├── tests/                      tests des règles pures (lib/*-rules.ts)
├── docs/                       documentation
└── proxy.ts                    vérification de connexion avant chaque page
```

**Un module = toujours les mêmes 4 endroits.** Exemple avec les consommables :

| Rôle | Fichier(s) |
|---|---|
| 🗄️ Base (tables, droits, fonctions) | `supabase/migrations/20261009090000_consommables.sql` |
| 🧠 Logique (lecture, règles) | `lib/consommables.ts`, `lib/consommables-rules.ts` |
| 📄 Pages et actions | `app/(app)/consommables/` : `page.tsx`, `[id]/page.tsx`, `nouveau/page.tsx`, `[id]/modifier/page.tsx`, `loading.tsx`, `actions.ts` |
| 🧩 Morceaux d'écran | `components/app/consommables/` : `article-list.tsx`, `article-sheet.tsx`, `article-form.tsx`, `article-operation.tsx` |
| ✅ Tests | `supabase/tests/13_consommables.sql`, `tests/consommables-rules.test.ts` |

**Astuce pour trouver un fichier** : partez de ce que vous voyez à l'écran.
- Un **texte** visible ? `grep -rn "le texte" app components lib`
- Une **adresse** ? Suivez les dossiers de `app/`.
- Un **message d'erreur** en français venant de la base ? `grep -rn "le message" supabase/migrations` (prendre le fichier le plus récent).

---

## 4. Le trajet d'un clic, de l'écran à la base

Suivons un cas réel : **un éditeur enregistre une consommation de 16 cartons de gobelets à CTR1.**

```
 NAVIGATEUR                     SERVEUR NEXT                       BASE SUPABASE
 ──────────                     ────────────                       ─────────────
 1. Ouvre /consommables/<id>
                       ───────► proxy.ts : connecté ? oui
                                layout.tsx : profil, menu
                                [id]/page.tsx :
                                  getArticle(id) ───────────────►  RLS : ne renvoie que
                                                 ◄───────────────  les restaurants de l'usager
                                  rend <ArticleSheet>
                       ◄─────── page HTML

 2. Choisit « Consommation »,
    tape 16, clique Enregistrer
    (article-operation.tsx)
                       ───────► actions.ts : operationArticle()
                                  verifierOperation()  (saisie)
                                  supabase.rpc("mouvement_article") ►  fonction SQL :
                                                                       - rôle ? restaurant ?
                                                                       - stock suffisant ?
                                                                       - écrit le mouvement
                                                                       - met à jour la quantité
                                                                       - sous le seuil ?
                                                                         → crée une notification
                                                 ◄───────────────
                                  revalidatePath()
                       ◄─────── { ok: true, message }
 3. Affiche « Consommation
    enregistrée (−16) »,
    la fiche se met à jour                                         4. La notification déclenche
                                                                      l'envoi du push (Edge Function)
```

Tous les modules suivent ce schéma : **composant client → action serveur → fonction SQL (ou écriture simple protégée par la RLS) → éventuelles notifications.**

---

## 5. La base de données : Supabase en clair

Supabase = **une base PostgreSQL** + la gestion des comptes + le stockage des photos. On y accède depuis le code avec la bibliothèque `@supabase/supabase-js`.

### 5.1 Les migrations : l'historique de la base

**Toute la base est décrite par les fichiers de `supabase/migrations/`**, exécutés dans l'ordre de leur nom (la date en tête). Pour changer la base, on **ajoute** un fichier ; on ne modifie **jamais** un fichier déjà appliqué en production.

```bash
supabase migration new mon_changement     # crée un fichier vide daté
# … écrire le SQL dedans …
supabase migration up --local             # l'appliquer à la base locale
```

### 5.2 La RLS : les droits ligne par ligne

**RLS** (Row Level Security) = des règles attachées à chaque table, que PostgreSQL applique **à chaque requête**, quel que soit le code qui la fait. Exemple :

```sql
-- « Un usager ne voit les lignes de stock que des restaurants auxquels il a accès. »
create policy article_stocks_select on article_stocks for select to authenticated
  using (has_restaurant(restaurant_id));
```

Fonctions d'aide disponibles dans les règles :
- `auth_role()` : le rôle de l'usager connecté (`'proprietaire'`, `'editeur'`…) ;
- `has_restaurant(id)` : l'usager a-t-il accès à ce restaurant ?
- `auth.uid()` : l'identifiant de l'usager connecté.

Si une requête ne renvoie **rien** alors que la donnée existe, c'est presque toujours la RLS qui filtre : c'est voulu.

### 5.3 Les fonctions SQL : les écritures importantes

Quand une écriture touche **plusieurs tables** ou suit des **règles métier** (stock jamais négatif, alerte au seuil, historique), on l'écrit en **fonction SQL**. Le code l'appelle par `supabase.rpc("nom_de_la_fonction", { p_param: valeur })`.

Le modèle à recopier (il est aussi dans `docs/guide-developpeur.md`, section 9) :

```sql
create function ma_fonction(p_restaurant uuid, p_quantite integer)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role user_role := auth_role();
begin
  -- 1. Connecté ?
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  -- 2. Bon rôle ?  (écrire « v_role is null or … » : un compte sans profil doit être refusé)
  if v_role is null or v_role not in ('proprietaire', 'editeur') then
    raise exception 'Votre rôle ne permet pas cette action' using errcode = '42501';
  end if;
  -- 3. Bon restaurant ?
  if not has_restaurant(p_restaurant) then
    raise exception 'Restaurant non autorisé' using errcode = '42501';
  end if;
  -- 4. Saisie correcte ?
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'La quantité doit être positive' using errcode = '22023';
  end if;
  -- 5. Le travail
  …
end;
$$;

-- OBLIGATOIRE : sans ces deux lignes, l'appel est refusé (« permission denied »).
revoke execute on function ma_fonction(uuid, integer) from public, anon;
grant execute on function ma_fonction(uuid, integer) to authenticated;
```

**Les messages d'erreur** écrits dans `raise exception` s'affichent **tels quels** à l'usager, pour ces codes : `42501` (droits), `22023` (saisie), `23514` (stock), `P0002` (introuvable). Écrivez-les donc en bon français. Les autres erreurs donnent un message générique.

**Une fonction peut être redéfinie** dans plusieurs migrations : c'est **la plus récente** qui compte. Pour la modifier, recopiez-la entièrement dans une nouvelle migration (`create or replace function …`) et changez seulement ce qu'il faut.

### 5.4 Écriture simple ou fonction SQL ?

| Cas | Choix | Exemple |
|---|---|---|
| Créer, modifier, supprimer **une ligne** d'une table, droits simples | Écriture directe (`supabase.from("t").insert(…)`), protégée par une règle RLS | fiche d'un article, catégorie de machine |
| Plusieurs tables, règle métier, historique, notification | **Fonction SQL** | mouvement de stock, clôture d'intervention, transfert |

---

## 6. L'apparence : Tailwind et les composants

Le style s'écrit **directement dans le `className`**, avec des classes courtes de **Tailwind CSS** :

```tsx
<div className="flex items-center gap-3 px-4 py-3 rounded bg-surface text-text">
```

Se lit : boîte flexible, éléments centrés verticalement, espacement 3, marges intérieures 4 et 3, coins arrondis, fond « surface », texte couleur « text ».

À savoir :
- **`lg:`** devant une classe = « seulement sur grand écran » (ordinateur). Sans préfixe = mobile et ordinateur. Exemple : `hidden lg:block` = caché sur mobile, visible sur ordinateur. **On écrit d'abord pour le mobile.**
- **Les couleurs du projet** (`bg-orange`, `text-danger`, `bg-surface`…) sont définies dans `app/globals.css`, bloc `@theme`. **Ne jamais écrire une couleur en dur** : changer une couleur là-bas la change partout.
- Liste des classes : https://tailwindcss.com/docs (version 4).

**Réutilisez les briques** de `components/ui/` plutôt que de refaire un bouton ou un champ :

| Brique | Usage |
|---|---|
| `<Button variant="primary" icon="plus">` | bouton ; une seule action orange (`primary`) par écran |
| `<Field label="…" error="…"><TextInput … /></Field>` | champ de formulaire avec libellé et message d'erreur |
| `<Card>` | encadré blanc |
| `<Alert variant="danger">` | bandeau de message |
| `<StatusBadge status="sousLeSeuil" />` | pastille de statut (couleur + icône + texte) |
| `<SegmentedControl options={…} />` | choix parmi quelques boutons |
| `<Icon name="box" />` | icône (liste dans `components/icons.tsx`) |

Une page de démonstration de toutes ces briques existe : **`/design-system`** (une fois connecté).

---

## 7. Modifier un module existant

Avant toute modification : `git checkout staging && git pull`, puis une **branche** : `git checkout -b ma-modification`.

### Exemple A — Changer un texte, un libellé

1. Chercher le texte : `grep -rn "Quantité reçue" app components lib`
2. Le modifier dans le fichier trouvé (ici `lib/consommables-rules.ts`, `QUANTITE_LABELS`).
3. Recharger la page. C'est tout.

Si le texte vient de la base (message d'erreur), il est dans une migration : créer une nouvelle migration qui redéfinit la fonction (section 5.3).

### Exemple B — Ajouter une unité aux consommables (« boîte »)

Une liste fermée existe **à deux endroits** qui doivent rester égaux : la base et le code.

1. **Base** : nouvelle migration qui remplace la contrainte
   ```sql
   alter table articles drop constraint articles_unit_check;
   alter table articles add constraint articles_unit_check
     check (unit in ('piece','paquet','carton','bouteille','casier','sac','rouleau','litre','kg','boite'));
   ```
2. **Code** : `lib/consommables-rules.ts`, ajouter `"boite"` à `UNITES` et `boite: ["boîte", "boîtes"]` à `UNITE_LABELS`.
3. TypeScript signale tout oubli : `npx tsc --noEmit`.

### Exemple C — Ajouter un champ (« fournisseur habituel » sur un article)

Toujours dans cet ordre : **base → lecture → action → formulaire → affichage**.

| Étape | Fichier | Quoi |
|---|---|---|
| 1. Base | nouvelle migration | `alter table articles add column fournisseur text;` |
| 2. Lecture | `lib/consommables.ts` | ajouter `fournisseur` dans `SELECT` et dans le type `Article` |
| 3. Action | `app/(app)/consommables/actions.ts` | ajouter `fournisseur` à `ArticleInput` et à l'objet `fields` |
| 4. Formulaire | `components/app/consommables/article-form.tsx` | un `<Field>` + `<TextInput>` de plus |
| 5. Pages | `…/nouveau/page.tsx`, `…/[id]/modifier/page.tsx` | valeur initiale du champ |
| 6. Affichage | `components/app/consommables/article-sheet.tsx` | une ligne dans la carte d'informations |

Après l'étape 2, `npx tsc --noEmit` liste les endroits qui attendent le nouveau champ : c'est votre fil conducteur.

### Exemple D — Changer qui a le droit de faire quelque chose

Exemple : laisser le **lecteur** saisir une consommation.

1. **En base d'abord** : redéfinir la fonction qui contrôle le rôle (ici `consommable_controle`, et limiter le lecteur aux raisons `consommation` et `perte` dans `mouvement_article`). Nouvelle migration.
2. **Les tests** : `supabase/tests/13_consommables.sql`, changer les lignes « lecteur : … refusé » en « autorisé » pour les cas voulus, et ajouter les refus qui restent (le lecteur ne fait pas de livraison).
3. **L'écran** : `canEditConsommables` dans `lib/consommables.ts` (qui voit le bloc « Mettre à jour le stock »).
4. `bash supabase/tests/run.sh` : tout doit passer.

---

## 8. Ajouter un nouveau module

Exemple : un module **« Fournisseurs »** (carnet d'adresses des fournisseurs de la chaîne). Le modèle complet et plus riche est le module Consommables : ouvrez ses fichiers à côté.

### Étape 0 — Écrire en 10 lignes ce que fait le module

Avant le code : **quoi** (données), **qui voit**, **qui modifie**, **quels écrans**. Pour les fournisseurs : un nom, un téléphone, une remarque ; tout le monde voit ; propriétaire et éditeur modifient ; une liste et un formulaire. Notez-le dans `docs/journal-decisions.md`.

### Étape 1 — La base (migration)

`supabase migration new fournisseurs`, puis :

```sql
-- Carnet des fournisseurs de la chaîne. Lu par tous, tenu par propriétaire et éditeur.
create table fournisseurs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table fournisseurs enable row level security;
grant select, insert, update, delete on fournisseurs to authenticated;

create policy fournisseurs_select on fournisseurs for select to authenticated
  using (auth_role() is not null);
create policy fournisseurs_insert on fournisseurs for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy fournisseurs_update on fournisseurs for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'));
create policy fournisseurs_delete on fournisseurs for delete to authenticated
  using (auth_role() = 'proprietaire');
```

Puis `supabase migration up --local`.

**À ne pas oublier** : `enable row level security` (sinon la table est ouverte à tous les connectés) et les quatre règles.
Si les données dépendent d'un restaurant : une colonne `restaurant_id uuid not null references restaurants (id)`, et `has_restaurant(restaurant_id)` dans les règles.

### Étape 2 — Les tests de la base

Copier un test court (par exemple `supabase/tests/09_categories.sql`) en `supabase/tests/14_fournisseurs.sql`. Le jeu de données commun (`_fixture.sql`) fournit un compte par rôle ; `tests.essai('compte', 'requête')` renvoie `'autorisé'` ou `'refusé'` :

```sql
begin;
\ir _fixture.sql
select * from no_plan();

select is(tests.essai('ed1', $$ with t as (insert into fournisseurs (name) values ('Sahel Emballages') returning 1) select count(*) from t $$),
          'autorisé', 'éditeur : ajout autorisé');
select is(tests.essai('lec1', $$ with t as (insert into fournisseurs (name) values ('X') returning 1) select count(*) from t $$),
          'refusé', 'lecteur : ajout refusé');
select is(tests.essai('anon', $$ select count(*) from fournisseurs $$),
          'refusé', 'anonyme : aucun accès');

select * from finish();
rollback;
```

`bash supabase/tests/run.sh 14_fournisseurs` pour le lancer seul.

### Étape 3 — La lecture (`lib/fournisseurs.ts`)

```ts
// Fournisseurs : lecture côté serveur, avec les droits de l'usager (RLS).
import { createClient } from "@/lib/supabase/server";

export type Fournisseur = { id: string; name: string; phone: string | null; notes: string | null };

export const canEditFournisseurs = (role: string | undefined) => role === "proprietaire" || role === "editeur";

export async function listFournisseurs(): Promise<Fournisseur[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("fournisseurs").select("id, name, phone, notes").order("name");
  return (data ?? []) as Fournisseur[];
}
```

### Étape 4 — L'action (`app/(app)/fournisseurs/actions.ts`)

```ts
"use server";

// Actions des fournisseurs. Droits vérifiés en base (RLS).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FournisseurResult = { ok: false; error: string } | null;

export async function ajouterFournisseur(input: { name: string; phone: string; notes: string }): Promise<FournisseurResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donnez un nom au fournisseur." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fournisseurs")
    .insert({ name, phone: input.phone.trim() || null, notes: input.notes.trim() || null });
  if (error) {
    return { ok: false, error: error.code === "42501" ? "Votre rôle ne permet pas d'ajouter un fournisseur." : "L'enregistrement a échoué." };
  }

  revalidatePath("/fournisseurs");
  redirect("/fournisseurs");
}
```

### Étape 5 — La page de liste (`app/(app)/fournisseurs/page.tsx`)

```tsx
// Fournisseurs : liste. Visible par tous ; « Ajouter » pour propriétaire et éditeur.
import Link from "next/link";
import { getProfile } from "@/lib/session";
import { canEditFournisseurs, listFournisseurs } from "@/lib/fournisseurs";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function FournisseursPage() {
  const [fournisseurs, profile] = await Promise.all([listFournisseurs(), getProfile()]);
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0">Fournisseurs</h1>
        {canEditFournisseurs(profile?.role) && (
          <Link href="/fournisseurs/nouveau" className={buttonClass({ variant: "secondary" })}>
            <Icon name="plus" /> Ajouter
          </Link>
        )}
      </header>
      {fournisseurs.length === 0 ? (
        <Card>Aucun fournisseur pour le moment.</Card>
      ) : (
        <Card padded={false} className="divide-y divide-surface-2">
          {fournisseurs.map((f) => (
            <div key={f.id} className="px-4 py-3">
              <div className="font-semibold">{f.name}</div>
              <div className="text-text-muted text-[14px]">{[f.phone, f.notes].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
```

### Étape 6 — Le formulaire (client) et sa page

`components/app/fournisseurs/fournisseur-form.tsx` :

```tsx
"use client";

// Formulaire « Ajouter un fournisseur ». Envoie à l'action serveur, affiche l'erreur éventuelle.
import { useState, useTransition } from "react";
import { ajouterFournisseur, type FournisseurResult } from "@/app/(app)/fournisseurs/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export function FournisseurForm() {
  const [v, setV] = useState({ name: "", phone: "", notes: "" });
  const [result, setResult] = useState<FournisseurResult>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await ajouterFournisseur(v)));
      }}
      className="flex flex-col gap-5"
    >
      {result && <Alert variant="danger">{result.error}</Alert>}
      <Field label="Nom" htmlFor="f-name">
        <TextInput id="f-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="Téléphone" htmlFor="f-phone" optional>
        <TextInput id="f-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Field label="Remarque" htmlFor="f-notes" optional>
        <TextInput id="f-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
```

`app/(app)/fournisseurs/nouveau/page.tsx` :

```tsx
// Ajouter un fournisseur. Propriétaire et éditeur (les autres sont renvoyés vers la liste).
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { canEditFournisseurs } from "@/lib/fournisseurs";
import { FournisseurForm } from "@/components/app/fournisseurs/fournisseur-form";

export default async function NouveauFournisseurPage() {
  const profile = await getProfile();
  if (!canEditFournisseurs(profile?.role)) redirect("/fournisseurs");
  return (
    <div className="max-w-xl mx-auto px-4 pt-5 lg:pt-10 flex flex-col gap-4">
      <h1 className="font-display text-[22px] font-semibold m-0">Nouveau fournisseur</h1>
      <FournisseurForm />
    </div>
  );
}
```

### Étape 7 — Le menu

`components/app/nav.tsx` :
- **ordinateur** : ajouter une entrée à la liste du menu latéral, sur le modèle de `CONSOMMABLES_ITEM` :
  `{ href: "/fournisseurs", label: "Fournisseurs", short: "Fournisseurs", icon: "store" }` ;
- **mobile** : la barre du bas n'a que **4 onglets** (place limitée). Soit le module est accessible depuis une autre page (lien, sélecteur comme `stock-switch.tsx`), soit il remplace un onglet. Ne pas en ajouter un cinquième sans vérifier l'affichage à 360 px.

### Étape 8 — Vérifier, documenter, livrer

```bash
npx tsc --noEmit              # types
npx eslint .                  # style
bash supabase/tests/run.sh    # tous les tests
npm run dev                   # essai à la main : chaque rôle, mobile (390 et 360 px) et ordinateur
```

Puis : ajouter le module dans `docs/base-de-donnees.md` (table, droits, migration) et dans `docs/guide-developpeur.md` (tableau des écrans), et livrer (section 10).

### Liste de contrôle d'un nouveau module

- [ ] Migration : table(s), `enable row level security`, règles de lecture **et** d'écriture
- [ ] Fonctions SQL éventuelles : contrôle connexion + rôle + restaurant, `revoke` puis `grant execute`
- [ ] Tests SQL : au moins un « autorisé » et un « refusé » par rôle et par action
- [ ] `lib/<module>.ts` : lectures et `canEdit…`
- [ ] `app/(app)/<module>/` : `page.tsx`, `actions.ts` (`"use server"`), `loading.tsx` si la lecture est lente
- [ ] Pages réservées : `redirect()` en tête si le rôle ne convient pas
- [ ] `components/app/<module>/` : composants ; `"use client"` seulement pour l'interactif
- [ ] Menu (`nav.tsx`)
- [ ] Textes en français, briques de `components/ui/`, couleurs du thème uniquement
- [ ] Essai sur mobile 360 px : rien ne déborde
- [ ] Documentation mise à jour

---

## 9. Aide-mémoire : « je veux… »

| Je veux… | Je vais dans… |
|---|---|
| Changer un texte | `grep -rn "le texte" app components lib` |
| Changer une couleur, une police | `app/globals.css`, bloc `@theme` |
| Ajouter une icône | `components/icons.tsx` (un nom + un tracé SVG 24×24) |
| Changer le menu | `components/app/nav.tsx` |
| Ajouter une page | un dossier dans `app/(app)/` avec `page.tsx` |
| Rendre une page publique | `PUBLIC_PATHS` dans `lib/supabase/middleware.ts`, et la sortir de `app/(app)/` |
| Ajouter une colonne | nouvelle migration, puis lecture (`lib/`), action, formulaire, affichage (section 7, exemple C) |
| Changer une règle métier en base | copier la fonction SQL la plus récente dans une nouvelle migration et la modifier |
| Changer qui peut faire quoi | base (règle RLS ou fonction), tests, puis `can…` dans `lib/` (section 7, exemple D) |
| Ajouter une famille ou une unité de consommable | `docs/guide-developpeur.md`, section 8 |
| Ajouter un type de notification | `docs/guide-developpeur.md`, section 8 |
| Changer le contenu d'un e-mail | `supabase/functions/envoyer-notification/index.ts`, puis redéployer la fonction |
| Retrouver la version en vigueur d'une fonction SQL | `grep -l "function nom" supabase/migrations/* \| tail -1` |
| Savoir pourquoi c'est fait comme ça | `docs/journal-decisions.md` |

---

## 10. Lancer, tester, mettre en ligne

### Sur son poste

```bash
npm install                     # une fois (installe les bibliothèques dans node_modules/)
supabase start                  # base locale dans Docker (toutes les migrations)
npm run dev                     # http://localhost:3000, se recharge à chaque enregistrement
```

⚠️ `npm run dev` lit `.env.development.local`, qui pointe sur la **vraie base du client**. Pour travailler sur la base locale sans risque : `docs/guide-developpeur.md`, section 7.

### Avant de commiter

```bash
npx tsc --noEmit                # aucune erreur de type
npx eslint .                    # aucune erreur de style
bash supabase/tests/run.sh      # 0 échec
```

### Mettre en ligne (ordre obligatoire)

```
 1. Branche → pull request vers « staging » → fusion
 2. Pousser staging : Vercel construit une adresse de PRÉVISUALISATION → tester sur téléphone
 3. Si la base change : supabase db push   (vérifier d'abord le projet : cat supabase/.temp/project-ref)
 4. Pull request « staging » → « main » → fusion : Vercel met en PRODUCTION
```

**La base avant le code** : le nouveau code a besoin des nouvelles tables. Et une migration doit rester compatible avec le code encore en production pendant quelques minutes : **ajouter** plutôt que renommer ou supprimer.

---

## 11. Quand ça ne marche pas

| Ce que je vois | La cause probable | Que faire |
|---|---|---|
| La page ne montre pas une donnée qui existe | La RLS filtre (pas le bon restaurant ou rôle) | Vérifier les droits de l'usager ; c'est souvent normal |
| « permission denied for function » | `grant execute … to authenticated` oublié | L'ajouter dans une nouvelle migration |
| « You're importing a component that needs useState… » | `"use client"` manquant | L'ajouter en 1re ligne du composant |
| Après un enregistrement, l'écran montre l'ancienne valeur | `revalidatePath` oublié dans l'action | L'ajouter avant le `return` |
| « params should be awaited » | Next 16 : `params` et `searchParams` sont des promesses | `const { id } = await props.params` |
| `Cannot find name 'PageProps'` | Types de Next pas encore générés | `npx next typegen` (ou lancer `npm run dev` une fois) |
| Une nouvelle classe Tailwind n'a pas d'effet | Feuille de style pas à jour | Relancer `npm run dev` |
| La page déborde à droite sur mobile | Grille ou texte trop large | `grid-cols-1` sur la grille, `min-w-0` sur les enfants |
| « unsafe use of new value » (enum) | Valeur d'enum ajoutée et utilisée dans la même migration | Deux migrations séparées |
| Erreur 500 en ligne | — | Vercel → Deployments → Logs ; Supabase → Logs |

Liste complète des pièges déjà rencontrés : `docs/guide-developpeur.md`, section 12.

---

## 12. Petit lexique

| Mot | Sens |
|---|---|
| **App Router** | La façon dont Next.js range les pages : un dossier par adresse, dans `app/` |
| **Composant** | Une fonction qui renvoie un morceau d'écran (JSX). Nom en majuscule : `<ArticleSheet />` |
| **Props** | Les paramètres qu'on passe à un composant : `<Card padded={false}>` |
| **JSX** | Le « HTML » écrit dans le code TypeScript |
| **Composant serveur / client** | Tourne sur le serveur (lit la base) / dans le navigateur (réagit aux clics, `"use client"`) |
| **Action serveur** | Fonction `"use server"` appelée depuis l'écran pour écrire |
| **`useState`** | Mémoire d'un composant client (la valeur d'un champ, un message) |
| **`useTransition`** | Indique qu'une action est en cours (`pending`), pour désactiver le bouton |
| **Proxy** | Code exécuté avant chaque page (vérifie la connexion) ; ex-« middleware » |
| **Migration** | Fichier SQL qui fait évoluer la base, jamais modifié une fois appliqué |
| **RLS** | Règles de droits ligne par ligne, appliquées par PostgreSQL lui-même |
| **RPC** | Appel d'une fonction SQL depuis le code : `supabase.rpc("nom", {…})` |
| **`security definer`** | Une fonction SQL qui s'exécute avec les droits de son créateur ; elle doit donc vérifier elle-même rôle et restaurant |
| **Tailwind** | Bibliothèque de classes CSS courtes, écrites dans `className` |
| **Vercel** | L'hébergeur de l'application ; déploie tout seul à chaque fusion dans `main` |
| **Prévisualisation** | Adresse Vercel temporaire pour une branche autre que `main` : on y teste avant la production |
