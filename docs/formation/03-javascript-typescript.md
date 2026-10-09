# Chapitre 03 — JavaScript et TypeScript utiles

**Objectif** : savoir **lire** n'importe quel fichier du projet et **écrire** des fonctions simples. On ne voit pas tout JavaScript : seulement ce que le projet utilise vraiment, avec ses vrais exemples.

💡 Pour essayer les exemples : ouvre la **Console** du navigateur (F12) et tape-les (sans les types, qui sont du TypeScript), ou crée un fichier `essai.mjs` et lance `node essai.mjs`.

---

## 1. TypeScript = JavaScript + des types

**JavaScript** est le langage. **TypeScript** est JavaScript avec, en plus, des **types** : on précise ce que contient chaque variable (`string` pour du texte, `number` pour un nombre…). Les fichiers du projet finissent par `.ts` (code) ou `.tsx` (code avec de l'affichage).

```ts
// JavaScript
function prixTotal(prix, quantite) { return prix * quantite; }

// TypeScript : la même chose, avec les types
function prixTotal(prix: number, quantite: number): number { return prix * quantite; }
```

**Pourquoi c'est précieux pour toi** : si tu appelles `prixTotal("douze", 3)`, l'éditeur **souligne l'erreur en rouge avant même de lancer**. Et quand tu ajoutes une colonne en base, TypeScript te montre tous les endroits à mettre à jour. C'est un filet de sécurité.

Vérifier tout le projet :
```bash
npx tsc --noEmit        # aucune sortie = aucune erreur
```

---

## 2. Variables

```ts
const restaurant = "CTR1";    // const : ne changera pas (99 % des cas dans le projet)
let total = 0;                // let : va changer
total = total + 5;
```

Règle : **utilise `const` par défaut**, `let` seulement si la valeur doit changer. (Tu croiseras parfois `var` sur Internet : c'est l'ancienne façon, à éviter.)

Les types de base :

| Type | Exemples |
|---|---|
| `string` (texte) | `"CTR1"`, `'Gobelet'`, `` `Il reste ${n}` `` |
| `number` (nombre) | `12`, `3.5`, `-1` |
| `boolean` (vrai/faux) | `true`, `false` |
| `null` | « pas de valeur », volontairement |
| `undefined` | « pas de valeur », pas encore définie |

**Le texte avec des valeurs dedans** (*template literal*), entre accents graves `` ` `` :

```ts
const n = 4;
const message = `Il reste ${n} cartons`;   // "Il reste 4 cartons"
```

Exemple réel, `app/(app)/consommables/actions.ts` :
```ts
message = `Livraison enregistrée (+${q}).`;
```

---

## 3. Fonctions

Deux façons d'écrire une fonction, **toutes deux utilisées** dans le projet :

```ts
// 1. Le mot-clé function
function uniteLabel(unit: string, n = 1) {      // n = 1 : valeur par défaut
  …
  return "cartons";
}

// 2. La « fonction fléchée » (arrow function), souvent pour les petites fonctions
const estSousSeuil = (s: { quantity: number; min_threshold: number }) => s.quantity < s.min_threshold;
```

La forme fléchée courte `(x) => expression` **renvoie directement** l'expression. Exemple réel, `lib/consommables-rules.ts` :
```ts
export const ecartInventaire = (enStock: number, comptee: number) => comptee - enStock;
// ecartInventaire(12, 15) vaut 3
```

---

## 4. Objets et tableaux

Un **objet** regroupe des valeurs nommées :

```ts
const article = { name: "Gobelet 50 cl", code: "GOB-50", unit: "carton" };
article.name;          // "Gobelet 50 cl"
```

Un **tableau** est une liste :

```ts
const familles = ["jetable", "boisson", "materiel"];
familles[0];           // "jetable" (on compte à partir de 0)
familles.length;       // 3
```

### Les méthodes de tableau, partout dans le projet

| Méthode | Ce qu'elle fait | Exemple |
|---|---|---|
| `.map(f)` | **Transforme** chaque élément → nouveau tableau | `restaurants.map((r) => r.short_code)` → `["CTR1", "CTR2"]` |
| `.filter(f)` | **Garde** les éléments qui passent le test | `stocks.filter(estSousSeuil)` → les lignes sous le seuil |
| `.find(f)` | Le **premier** élément qui passe le test (ou `undefined`) | `restaurants.find((r) => r.short_code === "CTR1")` |
| `.some(f)` | **Au moins un** passe le test ? (`true`/`false`) | `p.planned.some((m) => m.category === f.categorie)` |
| `.reduce(f, départ)` | **Cumule** (somme…) | `lignes.reduce((t, s) => t + s.quantity, 0)` → total |
| `.sort(f)` | **Trie** | `rows.sort((a, b) => a.name.localeCompare(b.name, "fr"))` |
| `.includes(x)` | Contient x ? | `["proprietaire", "editeur"].includes(role)` |
| `.join(", ")` | Colle en un texte | `["CTR1", "CTR2"].join(", ")` → `"CTR1, CTR2"` |

Exemple réel complet, `lib/consommables-rules.ts`, fonction `resumeArticle` (lis-la doucement, chaque ligne utilise une méthode ci-dessus) :

```ts
export function resumeArticle(stocks: StockLigne[], restaurantId = "") {
  // Si un restaurant est choisi, on ne garde que sa ligne ; sinon toutes.
  const lignes = restaurantId ? stocks.filter((s) => s.restaurant_id === restaurantId) : stocks;
  // Les restaurants sous le seuil (leur id seulement).
  const sousSeuil = lignes.filter(estSousSeuil).map((s) => s.restaurant_id);
  // Le statut : aucune ligne → non suivi ; une ligne sous le seuil → sous le seuil ; sinon suffisant.
  const statut: Statut = lignes.length === 0 ? "nonSuivi" : sousSeuil.length ? "sousLeSeuil" : "suffisant";
  return {
    quantite: lignes.reduce((t, s) => t + s.quantity, 0),   // somme des quantités
    …
  };
}
```

### Déstructuration et décomposition (spread)

Deux écritures très fréquentes, qui surprennent au début :

```ts
// Déstructuration : sortir des valeurs d'un objet en une ligne
const { id } = await props.params;          // équivaut à : const id = (await props.params).id;
const [email, prenom] = process.argv.slice(2);

// Spread « ... » : recopier un objet en changeant/ajoutant des valeurs
const modifie = { ...article, name: "Gobelet 33 cl" };   // copie d'article, avec un autre nom
const tous = [...listeA, ...listeB];                      // deux tableaux en un
```

Exemple réel, `lib/consommables.ts` : `({ ...a, resume: resumeArticle(a.stocks, restaurant?.id) })` = « l'article, plus un champ `resume` ».

---

## 5. Conditions

```ts
if (quantite <= 0) {
  return { ok: false, error: "La quantité doit être positive." };
} else if (quantite > 1000) {
  …
}
```

Comparer : `===` (égal), `!==` (différent), `<`, `<=`, `>`, `>=`. **Toujours `===`, jamais `==`** (le double égal a des comportements surprenants).
Combiner : `&&` (et), `||` (ou), `!` (non).

**La condition en une ligne** (*ternaire*) : `condition ? siVrai : siFaux`

```ts
const libelle = n > 1 ? "cartons" : "carton";
```

**Les raccourcis modernes**, omniprésents dans le projet :

| Écriture | Sens | Exemple réel |
|---|---|---|
| `a?.b` | « `a.b`, mais si `a` est vide, donne `undefined` au lieu de planter » | `profile?.role`, `s.articles?.name` |
| `a ?? b` | « `a`, sauf s'il est vide (`null`/`undefined`), alors `b` » | `data ?? []` (une liste vide si la base n'a rien renvoyé) |
| `a \|\| b` | « `a`, sauf s'il est « faux » (vide, 0, ""…), alors `b` » | `input.notes.trim() \|\| null` |
| `a && <Truc/>` | « affiche Truc seulement si a est vrai » (chapitre 04) | `{canEdit && <Link …>Modifier</Link>}` |

**Le `switch`** pour choisir parmi plusieurs cas, exemple réel dans `app/(app)/consommables/actions.ts` :

```ts
switch (input.operation) {
  case "livraison":
  case "consommation":
  case "perte":
    … // même traitement pour les trois
    break;
  case "inventaire":
    …
    break;
}
```

---

## 6. Modules : `import` et `export`

Chaque fichier est un **module**. Ce qu'il **exporte** peut être **importé** ailleurs.

```ts
// lib/format.ts
export function dateCourte(date: string) { … }

// components/app/consommables/article-sheet.tsx
import { dateCourte } from "@/lib/format";
```

- `@/` = la racine du projet (réglé dans `tsconfig.json`). `@/lib/format` = `lib/format.ts` (on n'écrit pas l'extension).
- `export default` : l'export « principal » d'un fichier, importé sans accolades. **Les pages de Next utilisent toujours `export default`** (chapitre 05).
- `import type { … }` : importe seulement un type (rien à l'exécution).

💡 Dans VS Code, **Ctrl + clic** (Cmd + clic sur Mac) sur un nom importé t'emmène à sa définition. C'est **la** façon de naviguer dans le projet.

---

## 7. L'asynchrone : `async` et `await`

Lire la base prend du temps (quelques millisecondes à quelques secondes). JavaScript ne **bloque** pas en attendant : une opération longue renvoie une **promesse** (*Promise*), « je te donnerai le résultat plus tard ».

On attend le résultat avec **`await`**, dans une fonction marquée **`async`** :

```ts
// lib/consommables.ts
export async function getArticle(id: string) {
  const supabase = await createClient();                                   // attend le client
  const { data } = await supabase.from("articles").select(SELECT).eq("id", id).maybeSingle(); // attend la réponse
  return data;
}
```

⚠️ **Oublier `await`** est l'erreur n° 1 : tu obtiens une promesse au lieu du résultat. TypeScript le signale souvent (« Property 'name' does not exist on type 'Promise<…>' »).

**Attendre plusieurs choses en même temps** (plus rapide que l'une après l'autre) :

```ts
// app/(app)/consommables/[id]/page.tsx
const [article, profile, list] = await Promise.all([
  getArticle(id),
  getProfile(),
  chargerListe(filters),
]);
```

---

## 8. Les types TypeScript que tu croiseras

```ts
// Un type « objet » : décrit la forme d'une donnée
type Restaurant = { id: string; name: string; short_code: string };

// Champ facultatif (?) et valeur possiblement vide (| null)
type Article = { name: string; notes: string | null; selectedId?: string };

// Union : une valeur parmi une liste fermée
type Role = "proprietaire" | "editeur" | "commentateur" | "lecteur";

// Tableau
const rows: Restaurant[] = [];

// Record : un dictionnaire « clé → valeur » où toutes les clés sont obligatoires
const ROLE_LABELS: Record<Role, string> = {
  proprietaire: "Propriétaire",
  editeur: "Éditeur",
  commentateur: "Commentateur",
  lecteur: "Lecteur",
};
ROLE_LABELS["editeur"];   // "Éditeur"
```

Le **`Record`** est un excellent garde-fou : si tu ajoutes un rôle à `Role` sans l'ajouter à `ROLE_LABELS`, TypeScript **refuse de compiler**. C'est pour cela que le projet en utilise beaucoup (libellés, couleurs, icônes par statut).

**La liste fermée « source de vérité »**, motif utilisé dans `lib/consommables-rules.ts` :

```ts
export const FAMILLES = ["jetable", "boisson", "materiel"] as const;  // la liste (utilisable à l'exécution)
export type Famille = (typeof FAMILLES)[number];                      // le type déduit : "jetable" | "boisson" | "materiel"
```

On écrit la liste **une fois**, et le type en découle : on ne peut pas les désynchroniser.

**`as`** force un type (« fais-moi confiance ») : `data as Restaurant[]`. Utilisé après une lecture en base, car TypeScript ne connaît pas la forme exacte de la réponse. À utiliser avec prudence.

---

## 9. Lire une erreur

Quand quelque chose plante, JavaScript affiche une **erreur** avec une **pile d'appels** (*stack trace*) :

```
TypeError: Cannot read properties of undefined (reading 'name')
    at ArticleSheet (components/app/consommables/article-sheet.tsx:42:18)
    at …
```

Lis-la ainsi :
1. **Le type et le message** : on a essayé de lire `.name` sur quelque chose de vide (`undefined`).
2. **La première ligne qui pointe vers TON code** (pas `node_modules`) : fichier `article-sheet.tsx`, **ligne 42**, colonne 18. Va voir.
3. La correction : souvent un `?.` manquant, ou une donnée qui n'arrive pas (vérifier la lecture en base).

Pour **voir une valeur** pendant que tu cherches :
```ts
console.log("article =", article);
```
- dans un composant **serveur** ou une action : le message s'affiche dans le **terminal** où tourne `npm run dev` ;
- dans un composant **client** : dans la **console du navigateur** (F12).

Retire tes `console.log` avant de commiter.

---

## ✅ Ce qu'il faut retenir

- `const` par défaut ; `` `…${valeur}…` `` pour le texte.
- `.map` transforme, `.filter` garde, `.find` cherche, `.reduce` cumule.
- `?.` et `??` évitent les plantages sur des valeurs vides.
- `import { x } from "@/lib/fichier"` ; Ctrl + clic pour naviguer.
- Toute lecture en base est **asynchrone** : `async` + `await`.
- Les types (`Record`, unions) sont un **filet de sécurité** : `npx tsc --noEmit`.

## 🏋️ Exercice 3

1. Ouvre `lib/format.ts`. Que renvoie `depuis()` pour une date d'il y a 90 minutes ? Et pour hier ?
2. Dans `lib/consommables-rules.ts`, écris (dans ta tête ou sur papier) ce que renvoie `uniteLabel("rouleau", 3)`, puis `uniteLabel("rouleau", 1)`.
3. Écris une fonction `totalStock(stocks)` qui renvoie la somme des `quantity` d'un tableau de lignes, avec `.reduce`.

👉 Chapitre suivant : [React](04-react.md)
