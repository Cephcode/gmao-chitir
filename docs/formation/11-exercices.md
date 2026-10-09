# Chapitre 11 — Exercices et solutions

**Comment faire** : essaie **vraiment** avant d'ouvrir la solution (clique sur « Solution » pour la déplier). Chercher dans le code, se tromper, relancer : c'est comme ça qu'on apprend. Travaille sur ta **base locale** et sur une **branche** (`git checkout -b exercices`), pour pouvoir tout jeter à la fin (`git checkout staging`).

---

## Partie A — Les exercices des chapitres

### Exercice 1 (chapitre 01) — Installer et explorer

1. Lance l'application sur ta base locale et connecte-toi.
2. Crée un compte éditeur limité à CTR1 ; connecte-toi avec lui dans une fenêtre privée ; compare les **Équipements** des deux comptes.
3. Retrouve tes comptes dans la table `users` du Studio.

<details><summary>Solution</summary>

1. `supabase start`, `node scripts/creer-proprietaire.mjs …` (avec les variables, voir chapitre 01), puis `bash scripts/dev-local.sh`.
2. Administration → Comptes → Nouveau compte, rôle « Éditeur », restaurant CTR1. Le propriétaire voit les machines de CTR1 **et** CTR2 ; l'éditeur ne voit que celles de CTR1. **Personne n'a écrit de filtre dans le code** pour cela : c'est la RLS de la table `equipments` (`has_restaurant(restaurant_id)`) qui ne renvoie que les lignes autorisées.
3. Studio → Table Editor → `users`. La colonne `role` vaut `proprietaire` ou `editeur` ; l'accès de l'éditeur à CTR1 est une ligne de `user_restaurants`.
</details>

### Exercice 2 (chapitre 02) — Le web

1. Stock → onglet « Sous le seuil » : qu'est-ce qui change dans l'adresse ?
2. F12 → Réseau : code de réponse de `/stock` ?
3. Supprimer le cookie `sb-…` et recharger : que se passe-t-il ?

<details><summary>Solution</summary>

1. L'adresse devient `/stock?statut=sous_seuil` : le filtre est un **paramètre d'adresse**. La page le lit dans `searchParams` (`readFilters` de `lib/stock.ts`).
2. `200` (succès).
3. Tu es renvoyé vers `/connexion` : sans cookie, plus de session. C'est `proxy.ts` → `updateSession` (`lib/supabase/middleware.ts`) qui redirige.
</details>

### Exercice 3 (chapitre 03) — JavaScript

1. Que renvoie `depuis()` pour il y a 90 minutes ? Pour hier ?
2. `uniteLabel("rouleau", 3)` ? `uniteLabel("rouleau", 1)` ?
3. Écrire `totalStock(stocks)`.

<details><summary>Solution</summary>

1. 90 minutes : `"1 h"` (les heures sont arrondies à l'entier inférieur : `Math.floor(90 / 60)`). Entre 24 et 47 heures : `"hier"`.
2. `"rouleaux"`, puis `"rouleau"` (pluriel seulement au-delà de 1).
3.
```ts
function totalStock(stocks: { quantity: number }[]) {
  return stocks.reduce((total, s) => total + s.quantity, 0);
}
totalStock([{ quantity: 3 }, { quantity: 10 }]);   // 13
```
</details>

### Exercice 4 (chapitre 04) — React

1. Combien de statuts dans `components/ui/status-badge.tsx` ? Où est le texte « Sous le seuil » ?
2. Les `useState` d'`article-operation.tsx` : que mémorise chacun ?
3. Quand une `KpiCard` devient-elle colorée ?

<details><summary>Solution</summary>

1. **16** statuts, dans l'objet `statuses`. « Sous le seuil » : `sousLeSeuil: { label: "Sous le seuil", icon: "down", family: "warning" }`. Changer ce texte le change dans **toutes** les pastilles de l'application.
2. `restaurantId` (le restaurant choisi), `operation` (livraison, consommation…), `quantite` (le texte tapé), `versId` (le restaurant d'arrivée d'un transfert), `note` (la remarque), `result` (le message de succès ou d'erreur renvoyé par l'action).
3. Quand `value > 0` : la ligne `const active = value > 0;`, puis `active ? t.bg : "bg-surface …"` dans le `className`.
</details>

### Exercice 5 (chapitre 05) — Next.js

1. Quel fichier affiche `/admin/categories/nouveau` ? Quel layout vérifie le droit d'y être ?
2. `stock-controls.tsx` : serveur ou client ? Pourquoi ?
3. Quelle action et quelle fonction SQL derrière « Enregistrer une livraison » (pièces) ?
4. Créer une page `/essai` qui dit bonjour.

<details><summary>Solution</summary>

1. `app/(app)/admin/categories/nouveau/page.tsx`. Le droit est vérifié par `app/(app)/admin/layout.tsx` (`canAccessAdmin`, sinon `redirect("/")`), après `app/(app)/layout.tsx` (connecté, profil).
2. **Client** (`"use client"` en première ligne) : il a un état (`useState` pour la quantité de livraison, `useTransition` pour l'envoi) et des `onClick`.
3. L'action `mouvementStock` (`app/(app)/stock/actions.ts`), qui appelle la fonction SQL `mouvement_stock` avec la raison `livraison`.
4. `app/(app)/essai/page.tsx` :
```tsx
import { getProfile } from "@/lib/session";

export default async function EssaiPage() {
  const profile = await getProfile();
  return <h1 className="p-8 text-[24px]">Bonjour {profile?.first_name ?? "inconnu"} !</h1>;
}
```
Ouvre http://localhost:3000/essai : le menu est là tout seul (layout de `(app)`), et la page est protégée. Supprime ensuite le dossier `app/(app)/essai`.
</details>

### Exercice 6 (chapitre 06) — Architecture

1. Les fichiers du module Équipements, couche par couche.
2. Où est définie la couleur orange ?
3. Déclaration de panne : quelle fonction SQL crée la notification ? Quels types partent aussi par e-mail ?

<details><summary>Solution</summary>

1. **Base** : `supabase/migrations/` (table `equipments` dans `20260929173837_schema.sql`, fonction `enregistrer_equipement`…). **Logique** : `lib/equipements.ts`, `lib/equipment-icon.ts`. **Routes** : `app/(app)/equipements/` (`page.tsx`, `[id]/page.tsx`, `nouveau/page.tsx`, `[id]/modifier/page.tsx`, `actions.ts`, `loading.tsx`). **Affichage** : `components/app/equipements/` (`equipment-list`, `equipment-filters`, `equipment-sheet`, `equipment-form`, `maintenance-done-button`).
2. `app/globals.css`, bloc `@theme`, ligne `--color-orange: #f88f1f;`. Toutes les classes `bg-orange`, `text-orange`… en découlent.
3. `declarer_panne` (version en vigueur : `20260930230100_statuts_intervention_fonctions.sql`) insère une ligne `notifications` de type `urgence` ou `panne` pour chaque responsable et technicien du restaurant. E-mails : `urgence`, `panne` et `attribution` (`EMAIL_TYPES` de l'Edge Function).
</details>

### Exercice 7 (chapitre 07) — Base de données

1. Pour chaque restaurant : son code et son nombre de machines en panne.
2. Qui peut supprimer un article ? Pourquoi est-ce refusé s'il a des mouvements ?
3. Le fichier de la version en vigueur de `declarer_panne`.

<details><summary>Solution</summary>

1.
```sql
select r.short_code, count(e.id) filter (where e.state = 'en_panne') as en_panne
from restaurants r
left join equipments e on e.restaurant_id = r.id
group by r.short_code
order by r.short_code;
```
`left join` garde aussi les restaurants sans machine ; `filter (where …)` ne compte que les pannes.
2. Le **propriétaire** (règle `articles_delete` : `auth_role() = 'proprietaire'`). La colonne `article_mouvements.article_id` est déclarée `references articles (id) on delete restrict` : PostgreSQL refuse de supprimer un article tant qu'un mouvement le désigne (erreur `23503`, traduite par `supprimerArticle`).
3. `grep -l "function declarer_panne" supabase/migrations/* | tail -1` → `20260930230100_statuts_intervention_fonctions.sql`.
</details>

### Exercice 10 (chapitre 10) — Tester et Git

<details><summary>Solution</summary>

1. `TOTAL : 801 réussis, 0 échoués` (au 2026-10-09 ; le nombre augmente quand on ajoute des tests).
2. Sur `staging`, le libellé est **l'ancien** : ton commit n'existe que sur `essai-git`. En revenant sur `essai-git`, il réapparaît. Chaque branche a sa propre version des fichiers.
3. Le test **node** « écart d'inventaire = compté − en stock » de `tests/consommables-rules.test.ts` échoue. Les tests SQL ne bougent pas : ils testent la fonction SQL `inventaire_article`, qui a sa propre copie de la règle. Remets la fonction avec `git checkout -- lib/consommables-rules.ts`.
</details>

---

## Partie B — Petits projets

Chacun se fait sur une branche, se vérifie (`tsc`, `eslint`, tests, essai à la main), puis se jette ou se garde.

### Projet 1 ⭐ — Un nouveau symptôme de panne

Ajoute le symptôme « Odeur de brûlé » dans « Déclarer une panne ».

<details><summary>Solution</summary>

`components/app/panne/declare-form.tsx`, constante `SYMPTOMS` (une liste de textes) : ajoute la ligne `"Odeur de brûlé",`. Aucune migration : les symptômes sont enregistrés comme du texte.
</details>

### Projet 2 ⭐⭐ — L'unité « boîte »

Rends possible l'unité « boîte » pour les consommables.

<details><summary>Solution</summary>

Chapitre 09, recette 3 : une migration qui remplace la contrainte `articles_unit_check`, puis `UNITES` et `UNITE_LABELS` dans `lib/consommables-rules.ts`.
</details>

### Projet 3 ⭐⭐ — « Dernière livraison » sur la fiche d'un article

Sur la fiche d'un consommable, affiche « Dernière livraison : 6 oct. (CTR1) » sous l'unité, ou rien s'il n'y en a jamais eu.

<details><summary>Solution</summary>

Tout est déjà lu : `article-sheet.tsx` charge les mouvements (`listMouvementsArticle`), du plus récent au plus ancien. Il suffit de chercher la première livraison avec `.find()`.

Dans `components/app/consommables/article-sheet.tsx`, après les autres `const` :
```tsx
const derniereLivraison = mouvements.find((m) => m.raison === "livraison");
```
Puis dans la carte d'informations, après la ligne « Unité » :
```tsx
{derniereLivraison && (
  <div className="flex justify-between gap-3 py-3">
    <span className="text-text-muted text-[15px]">Dernière livraison</span>
    <span className="font-semibold text-[15px]">
      {dateCourte(derniereLivraison.created_at)} ({codeOf.get(derniereLivraison.restaurant_id)})
    </span>
  </div>
)}
```
`dateCourte` et `codeOf` existent déjà dans ce fichier. Limite : seuls les 40 derniers mouvements sont lus ; pour un article très mouvementé, il faudrait une lecture dédiée dans `lib/consommables.ts` (`.eq("raison", "livraison").order("created_at", { ascending: false }).limit(1)`).
</details>

### Projet 4 ⭐⭐ — Un indicateur « Consommables sous le seuil »

<details><summary>Solution</summary>

Chapitre 09, recette 6.
</details>

### Projet 5 ⭐⭐⭐ — Le module Fournisseurs

Construis le module complet du chapitre 09 (section 10), **en tapant le code toi-même** plutôt qu'en le copiant : c'est le meilleur entraînement. Puis, en bonus, relie un article à son fournisseur (tableau « Pour aller plus loin »).

### Projet 6 ⭐⭐⭐ — Le lecteur enregistre ses consommations

<details><summary>Solution</summary>

Chapitre 09, recette 7. Le point délicat : la **base d'abord** (sinon le bouton s'affiche mais l'enregistrement est refusé), puis les tests, puis l'écran (n'afficher au lecteur que « Consommation » et « Perte ou casse »).
</details>

---

## Partie C — Questions de compréhension

<details><summary>1. Pourquoi ne met-on jamais la vérification des droits seulement dans l'écran ?</summary>

Parce que l'écran tourne dans le navigateur de l'usager, qui peut le modifier, et que les actions serveur peuvent être appelées directement. Seule la base (RLS, fonctions SQL) est hors de portée. L'écran ne fait que **cacher** ce qui serait refusé, par confort.
</details>

<details><summary>2. Pourquoi deux fichiers lib/xxx.ts et lib/xxx-rules.ts ?</summary>

`xxx.ts` lit la base : il ne peut tourner que sur le serveur. `xxx-rules.ts` ne contient que des calculs : un composant client peut l'importer (par exemple pour afficher un libellé ou valider une saisie avant l'envoi), et on peut le tester sans base.
</details>

<details><summary>3. Une lecture interdite renvoie-t-elle une erreur ?</summary>

Non : la RLS filtre les lignes, la lecture renvoie simplement **moins de lignes** (souvent zéro). Une écriture interdite renvoie une erreur `42501` (ajout) ou ne modifie **aucune ligne** (mise à jour, suppression) : d'où les tests `if (!data?.length)` dans les actions.
</details>

<details><summary>4. Pourquoi met-on la base en ligne AVANT le code ?</summary>

Le nouveau code utilise les nouvelles tables ou colonnes : s'il partait en premier, il planterait. Et la migration est écrite pour rester compatible avec l'ancien code (on ajoute, on ne renomme pas), qui tourne encore quelques minutes.
</details>

<details><summary>5. Quand faut-il "use client" ?</summary>

Seulement quand le composant a un état (`useState`…), réagit à des événements (`onClick`, `onChange`), utilise le navigateur (`window`, appareil photo) ou les hooks de navigation (`useRouter`…). Tout le reste reste serveur : c'est plus rapide et ça peut lire la base.
</details>

👉 Dernier chapitre : [Lexique](12-lexique.md)
