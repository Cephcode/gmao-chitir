# Chapitre 04 — React

**Objectif** : comprendre comment les écrans sont construits. Next.js est bâti sur **React** : tout écran de la GMAO est un assemblage de **composants** React.

---

## 1. L'idée de React : des briques

Au lieu d'écrire une page entière d'un bloc, on la découpe en **composants** : des briques réutilisables, qui s'emboîtent.

La fiche d'un article de consommable, par exemple :

```
<ArticlePage>                      app/(app)/consommables/[id]/page.tsx
 ├─ <ArticleList>                    la liste à gauche (ordinateur)
 └─ <ArticleSheet>                   la fiche à droite
     ├─ <SheetTitle>                   le titre
     ├─ <StatusBadge>                  la pastille « Sous le seuil »
     ├─ <Card> … </Card>               la carte « Par restaurant »
     ├─ <ArticleOperation>             le formulaire « Mettre à jour le stock »
     │   ├─ <Field><TextInput/></Field>
     │   ├─ <SegmentedControl>
     │   └─ <Button>
     └─ <Card> … </Card>               l'historique
```

Le bouton `<Button>` est le même partout dans l'application : le modifier dans `components/ui/button.tsx` change **tous** les boutons. C'est tout l'intérêt.

---

## 2. Un composant, c'est une fonction

Un composant est **une fonction qui renvoie de l'affichage**. Son nom commence **toujours par une majuscule**.

Exemple réel, simplifié : `components/app/kpi-card.tsx` (les cartes chiffrées du tableau de bord) :

```tsx
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export function KpiCard({ href, label, value, icon }: {   // ① les « props » reçues
  href: string;
  label: string;
  value: number;
  icon: IconName;
}) {
  const active = value > 0;                               // ② du code normal
  return (                                                // ③ ce qu'on affiche (JSX)
    <Link href={href} className={active ? "bg-danger-bg" : "bg-surface"}>
      <Icon name={icon} size={16} />
      {label}
      <div className="text-[32px]">{value}</div>
    </Link>
  );
}
```

Et on l'**utilise** comme une balise HTML, dans `app/(app)/page.tsx` :

```tsx
<KpiCard href="/stock?statut=sous_seuil" label="Pièces sous le seuil" value={lowParts.length} icon="down" />
```

---

## 3. JSX : du HTML dans le code

Ce qui suit `return (` ressemble à du HTML : c'est du **JSX**. Les différences à connaître :

| HTML | JSX | Pourquoi |
|---|---|---|
| `class="…"` | `className="…"` | `class` est un mot réservé de JavaScript |
| `for="…"` (label) | `htmlFor="…"` | idem |
| `<br>`, `<input>` | `<br />`, `<input />` | toute balise doit être fermée |
| `onclick="…"` | `onClick={…}` | les événements s'écrivent en camelCase et reçoivent une fonction |
| texte avec `'` | `&apos;` ou `{"'"}` | l'apostrophe seule est refusée par le vérificateur (ESLint) |

**Les accolades `{ }` insèrent du JavaScript** dans le JSX :

```tsx
<h1>{article.name}</h1>                              // une valeur
<span>{n} {n > 1 ? "cartons" : "carton"}</span>      // une expression
<div className={`p-4 ${actif ? "bg-orange" : ""}`}>  // une classe calculée
```

Un composant ne renvoie qu'**un seul** élément racine. Pour en renvoyer plusieurs sans ajouter de `<div>`, on les entoure d'un **fragment** `<> … </>` (vu dans `article-form.tsx`).

---

## 4. Les props : les paramètres d'un composant

Les **props** sont ce qu'on passe à un composant, comme les attributs d'une balise. Le composant les reçoit dans un objet, qu'on « déstructure » (chapitre 03) :

```tsx
function StatusBadge({ status, label }: { status: StatusKey; label?: string }) { … }

<StatusBadge status="sousLeSeuil" />
<StatusBadge status="enPanne" label="2 en panne" />    // label est facultatif (le « ? »)
```

**La prop spéciale `children`** = ce qu'on met **entre** les balises ouvrante et fermante. Exemple réel, `components/ui/card.tsx` :

```tsx
export function Card({ padded = true, className = "", children }) {
  return <div className={`bg-surface rounded-lg ${padded ? "p-6" : ""} ${className}`}>{children}</div>;
}

<Card>Aucun fournisseur pour le moment.</Card>       // « Aucun… » est le children
```

⚠️ Les props **descendent** (du parent vers l'enfant), jamais l'inverse. Pour qu'un enfant prévienne son parent, le parent lui passe une **fonction** en prop (`onChange={…}`), que l'enfant appelle. Exemple : `<SegmentedControl onChange={choisirOperation} />`.

---

## 5. Afficher selon une condition

```tsx
{canEdit && <Link href={editHref}>Modifier</Link>}          // seulement si canEdit est vrai

{rows.length === 0 ? (                                      // l'un OU l'autre
  <Card>Aucun article ne correspond</Card>
) : (
  <Table rows={rows} />
)}
```

Les deux sont partout dans le projet. Exemple réel : `components/app/consommables/article-sheet.tsx`, la carte « Par restaurant ».

---

## 6. Afficher une liste

On transforme un tableau de données en tableau d'éléments avec **`.map()`**. Chaque élément doit avoir une prop **`key`** unique (React s'en sert pour savoir quelle ligne a changé) :

```tsx
// components/app/consommables/article-list.tsx (simplifié)
{rows.map((a) => (
  <Link key={a.id} href={`/consommables/${a.id}`}>
    {a.name} · {a.resume.quantite} {uniteLabel(a.unit, a.resume.quantite)}
  </Link>
))}
```

⚠️ Oublier `key` donne un avertissement dans la console. Utilise l'`id` de la donnée, pas la position dans le tableau.

---

## 7. L'état : la mémoire d'un composant (`useState`)

Un composant **client** (chapitre 05) peut **se souvenir** de valeurs qui changent : ce qui est tapé dans un champ, l'onglet choisi, un message. C'est l'**état**, géré par **`useState`** :

```tsx
"use client";
import { useState } from "react";

function Compteur() {
  const [n, setN] = useState(0);            // n = valeur actuelle, setN = fonction pour la changer, 0 = départ
  return <button onClick={() => setN(n + 1)}>Cliqué {n} fois</button>;
}
```

**Règle fondamentale** : on ne modifie **jamais** l'état directement (`n = 5` ne marche pas). On appelle **`setN(5)`**, et React **redessine** le composant avec la nouvelle valeur. Tout l'affichage découle de l'état.

Exemple réel, `components/app/consommables/article-operation.tsx` :

```tsx
const [operation, setOperation] = useState<Operation>("livraison");   // opération choisie
const [quantite, setQuantite] = useState("");                         // ce qui est tapé
const [result, setResult] = useState<ConsoResult>(null);              // message après envoi
```

Quand l'usager clique « Consommation », `setOperation("consommation")` est appelé ; React redessine ; le libellé du champ devient « Quantité utilisée ».

Les fonctions qui commencent par **`use`** (`useState`, `useTransition`, `useEffect`…) s'appellent des **hooks**. Règle : on les appelle **tout en haut** du composant, jamais dans un `if` ou une boucle.

---

## 8. Les formulaires

### Le champ « contrôlé »

Un champ dont la valeur vient de l'état, et qui met l'état à jour à chaque frappe :

```tsx
<TextInput
  id="op-quantite"
  value={quantite}                                  // la valeur affichée = l'état
  onChange={(e) => setQuantite(e.target.value)}     // chaque frappe met l'état à jour
/>
```

`e` est l'**événement** ; `e.target.value` est le texte du champ. ⚠️ C'est **toujours du texte**, même pour `type="number"` : il faut le convertir avec `Number(quantite)`.

### Envoyer : deux façons dans le projet

**Façon 1 — appel direct de l'action serveur avec `useTransition`** (la plupart des formulaires : consommables, stock, équipements…) :

```tsx
const [pending, startTransition] = useTransition();   // pending = « envoi en cours »

const submit = (e: React.FormEvent) => {
  e.preventDefault();                                 // empêche le navigateur de recharger la page
  startTransition(async () => {
    const res = await operationArticle({ articleId, operation, quantite: Number(quantite), … });
    setResult(res);                                   // affiche le message renvoyé
  });
};

<form onSubmit={submit}>
  …
  <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
</form>
```

**Façon 2 — `<form action>` avec `useActionState`** (formulaires simples : connexion, « entretien fait ») :

```tsx
// components/app/equipements/maintenance-done-button.tsx
const [state, action, pending] = useActionState(noterEntretienFait, null);

<form action={action}>
  <input type="hidden" name="equipmentId" value={equipmentId} />
  <Button type="submit" disabled={pending}>Noter l'entretien comme fait</Button>
  {state?.ok === false && <span className="text-danger">{state.error}</span>}
</form>
```

Ici, l'action reçoit un objet **`FormData`** (les champs du formulaire, lus par leur `name`). Pratique pour un formulaire de 1 à 3 champs. Pour un formulaire riche, préfère la façon 1.

Dans les deux cas : **le bouton est désactivé pendant l'envoi** (`disabled={pending}`), pour éviter le double clic, et **le résultat (succès ou erreur) s'affiche** sous le formulaire.

---

## 9. `useEffect` : réagir à un changement

`useEffect` lance du code **après** l'affichage, quand une valeur change. Il est rare dans le projet. Exemple réel, `components/app/url-filters.tsx` : 300 ms après la dernière frappe dans la recherche, il met l'adresse à jour.

```tsx
useEffect(() => {
  const t = setTimeout(() => setFilter("q", q.trim()), 300);
  return () => clearTimeout(t);      // si on retape avant 300 ms, on annule le précédent
}, [q]);                             // se relance chaque fois que q change
```

💡 Si tu as envie d'utiliser `useEffect` pour **charger des données**, c'est presque toujours une erreur dans ce projet : les données se lisent dans la **page serveur** (chapitre 05).

---

## ✅ Ce qu'il faut retenir

- Un **composant** = une fonction (nom en Majuscule) qui renvoie du **JSX**.
- Les **props** descendent du parent vers l'enfant ; `children` = le contenu entre les balises.
- `{cond && …}` et `{cond ? a : b}` pour afficher selon une condition ; `.map()` + `key` pour les listes.
- **`useState`** = la mémoire ; on change l'état avec la fonction `set…`, React redessine.
- Formulaire : champs contrôlés + action serveur, bouton désactivé pendant `pending`.

## 🏋️ Exercice 4

1. Ouvre `components/ui/status-badge.tsx`. Combien de statuts existent ? Où est défini le texte « Sous le seuil » ?
2. Ouvre `components/app/consommables/article-operation.tsx` et repère les 6 `useState`. Pour chacun, dis ce qu'il mémorise.
3. Dans `components/app/kpi-card.tsx`, la carte devient colorée quand… ? Trouve la ligne qui le décide.

👉 Chapitre suivant : [Next.js, comment ça marche](05-nextjs.md)
