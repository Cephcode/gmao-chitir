# Chapitre 09 — Ajouter tes fonctionnalités

**Objectif** : savoir faire évoluer la GMAO toi-même, du petit changement au module complet. D'abord **la méthode**, ensuite des **recettes** de difficulté croissante, enfin un **module complet** construit pas à pas.

> Tout le code de ce chapitre a été **testé** sur le projet (types, vérificateur, tests de la base, et essai dans le navigateur avec un propriétaire et un lecteur) avant d'être recopié ici.

---

## 1. La méthode, toujours la même

Avant d'écrire une ligne, réponds à ces **6 questions** (sur papier, ou dans `docs/journal-decisions.md`) :

1. **Quoi ?** Quelles données (champs, listes) ? Quels écrans ?
2. **Qui voit ?** Tout le monde ? Seulement son restaurant ?
3. **Qui modifie ?** Quels rôles ? Sur quels restaurants ?
4. **Quelles règles ?** (jamais négatif, unique, obligatoire…)
5. **Ça touche plusieurs tables, ou il faut un historique, une alerte ?** → fonction SQL. Sinon → écriture simple protégée par la RLS.
6. **Où dans le menu ?**

Puis code **dans cet ordre**, en vérifiant à chaque étape :

```
① BASE        migration : tables, contraintes, RLS, fonctions          supabase migration up --local
② TESTS BASE  supabase/tests/NN_xxx.sql : qui peut, qui ne peut pas    bash supabase/tests/run.sh NN_xxx
③ LOGIQUE     lib/xxx.ts (lectures, can…), lib/xxx-rules.ts (règles)   npx tsc --noEmit
④ ACTIONS     app/(app)/xxx/actions.ts                                 npx tsc --noEmit
⑤ ÉCRANS      app/(app)/xxx/…/page.tsx + components/app/xxx/           npm run dev, à la main
⑥ MENU        components/app/nav.tsx
⑦ VÉRIFIER    tsc, eslint, tous les tests, chaque rôle, mobile 360 px
⑧ DOCUMENTER  docs/base-de-donnees.md, docs/guide-developpeur.md, journal
```

**Pourquoi commencer par la base ?** Parce que c'est elle qui protège (chapitre 06), et parce que TypeScript te guidera ensuite : ce qui manque dans le code apparaîtra en erreur.

**Travaille sur une branche** (chapitre 10) : `git checkout -b ma-fonctionnalite`. Si tout part de travers, `git checkout staging` et tu retrouves l'état de départ.

---

## 2. Recette 1 — Changer un texte ou un libellé ⭐

1. Trouve le texte : `Ctrl + Maj + F` dans VS Code, ou `grep -rn "Quantité reçue" app components lib`.
2. Modifie-le, enregistre : la page se met à jour.

Les libellés « en liste » sont regroupés dans des constantes faciles à trouver :

| Je veux changer… | Fichier, constante |
|---|---|
| les noms des rôles | `lib/session.ts`, `ROLE_LABELS` |
| les statuts d'intervention | `lib/intervention-status.ts`, `STATUS_LABELS` |
| les types d'intervention | `lib/interventions.ts`, `KIND_LABELS` |
| les libellés des pastilles | `components/ui/status-badge.tsx`, `statuses` |
| les familles, unités, opérations des consommables | `lib/consommables-rules.ts` |
| les symptômes de « Déclarer une panne » | `components/app/panne/declare-form.tsx`, `SYMPTOMS` |
| les réglages de « Mes alertes » | `lib/notifications.ts`, `SETTINGS` |
| les entrées du menu | `components/app/nav.tsx`, `MAIN_ITEMS` |

Si le message vient **de la base** (un message d'erreur d'une fonction SQL), il est dans une migration : il faut une **nouvelle migration** qui redéfinit la fonction (chapitre 07, section 6).

---

## 3. Recette 2 — Ajouter un symptôme de panne ⭐

Les symptômes sont enregistrés comme du texte : **aucune migration** nécessaire.

`components/app/panne/declare-form.tsx`, la constante `SYMPTOMS` est une simple liste de textes (`"Ne démarre pas"`, `"Fuite"`…) : ajoute ta ligne, par exemple `"Odeur de brûlé",`. C'est tout.

---

## 4. Recette 3 — Ajouter une unité aux consommables ⭐⭐

Une liste fermée existe **à deux endroits** qui doivent rester égaux : la base (qui refuse les autres valeurs) et le code (qui les affiche).

**① La base** — `supabase migration new unite_boite`, puis dans le fichier :

```sql
-- Nouvelle unité « boîte » pour les consommables.
alter table articles drop constraint articles_unit_check;
alter table articles add constraint articles_unit_check
  check (unit in ('piece', 'paquet', 'carton', 'bouteille', 'casier', 'sac', 'rouleau', 'litre', 'kg', 'boite'));
```

`supabase migration up --local`.

**② Le code** — `lib/consommables-rules.ts` :

```ts
export const UNITES = ["piece", "paquet", "carton", "bouteille", "casier", "sac", "rouleau", "litre", "kg", "boite"] as const;
…
const UNITE_LABELS: Record<Unite, [string, string]> = {
  …
  boite: ["boîte", "boîtes"],
};
```

Remarque : si tu ajoutes `"boite"` à `UNITES` sans l'ajouter à `UNITE_LABELS`, **`npx tsc --noEmit` refuse** (c'est le `Record` du chapitre 03 qui te protège).

**③ Vérifier** : la nouvelle unité apparaît dans la liste du formulaire « Nouvel article ».

---

## 5. Recette 4 — Ajouter un champ (« fournisseur habituel » d'un article) ⭐⭐

Ordre : **base → lecture → action → formulaire → affichage**.

**① Base** — nouvelle migration :
```sql
alter table articles add column fournisseur text check (fournisseur is null or length(fournisseur) <= 120);
```
(Les droits de la table s'appliquent automatiquement à la nouvelle colonne.)

**② Lecture** — `lib/consommables.ts` : ajoute `fournisseur` à la chaîne `SELECT` **et** au type `Article` (`fournisseur: string | null;`).

**③ Action** — `app/(app)/consommables/actions.ts` : ajoute `fournisseur: string;` au type `ArticleInput`, et `fournisseur: input.fournisseur.trim() || null,` dans l'objet `fields` de `enregistrerArticle`.

**④ Pages** — lance `npx tsc --noEmit` : il signale les deux pages qui créent un `ArticleInput` sans `fournisseur` (`nouveau/page.tsx` → ajoute `fournisseur: ""` ; `[id]/modifier/page.tsx` → ajoute `fournisseur: article.fournisseur ?? ""`). **TypeScript est ton fil conducteur.**

**⑤ Formulaire** — `components/app/consommables/article-form.tsx`, à côté du champ « Remarque » :
```tsx
<Field label="Fournisseur habituel" htmlFor="article-fournisseur" optional>
  <TextInput id="article-fournisseur" value={v.fournisseur} maxLength={120}
    onChange={(e) => set("fournisseur", e.target.value)} />
</Field>
```

**⑥ Affichage** — `components/app/consommables/article-sheet.tsx`, dans la carte d'informations, sur le modèle de la ligne « Remarque » :
```tsx
{a.fournisseur && (
  <div className="flex justify-between gap-3 py-3">
    <span className="text-text-muted text-[15px]">Fournisseur</span>
    <span className="font-semibold text-[15px]">{a.fournisseur}</span>
  </div>
)}
```

---

## 6. Recette 5 — Ajouter un filtre à une liste ⭐⭐

Exemple : filtrer les consommables **par unité** (`/consommables?unite=carton`).

Les filtres vivent dans l'adresse (chapitre 05). Trois endroits à toucher, tous dans `lib/consommables-rules.ts`, plus la puce à l'écran :

**① Le type et la lecture** :
```ts
export type Filtres = { q: string; restaurant: string; famille: string; statut: string; unite: string };

export function lireFiltres(sp: …): Filtres {
  …
  return {
    …,
    unite: isUnite(get("unite")) ? get("unite") : "",
  };
}
```

**② L'application du filtre** (le type de `rows` doit connaître `unit`) :
```ts
export function appliquerFiltres<T extends { name: string; code: string; famille: string; unit: string }>(rows: T[], f: Filtres) {
  …
  return rows.filter((a) => {
    if (f.famille && a.famille !== f.famille) return false;
    if (f.unite && a.unit !== f.unite) return false;          // ← nouveau
    …
  });
}
```

`filtresQuery` n'a rien à changer : elle recopie tous les champs remplis.

**③ La puce** — `components/app/consommables/article-list.tsx`, dans `chips` de `<UrlFilters>` :
```tsx
{
  name: "unite",
  label: "Unité",
  options: UNITES.map((u) => ({ value: u, label: uniteLabel(u, 1) })),
},
```
(importe `UNITES` et `uniteLabel` depuis `@/lib/consommables-rules`).

**④ Les tests** — `npx tsc --noEmit` signale alors `tests/consommables-rules.test.ts` : ses objets de filtres n'ont pas de champ `unite`, et ses lignes d'exemple pas de champ `unit`. C'est normal, mets-les à jour :
- dans le test de `lireFiltres`, le résultat attendu gagne `unite: ""` ;
- dans « adresse » et « recherche… », l'objet `f` devient `{ q: "", restaurant: "", famille: "", statut: "", unite: "" }` ;
- les lignes d'exemple gagnent une unité : `{ name: "Thé glacé", code: "THE-01", famille: "boisson", unit: "bouteille" }`.

Ajoute aussi un test du nouveau filtre, puis lance :
```bash
npx tsc --noEmit
node --test --import ./tests/register.mjs tests/consommables-rules.test.ts
```

---

## 7. Recette 6 — Ajouter un indicateur au tableau de bord ⭐⭐

Exemple : une carte « Consommables sous le seuil ».

`app/(app)/page.tsx` calcule déjà `lowArticles` (les lignes de stock sous le seuil, filtrées par le restaurant choisi). Il suffit d'ajouter une `KpiCard` dans la grille des indicateurs :

```tsx
<KpiCard
  href={`/consommables?statut=sous_seuil${selected ? `&restaurant=${selected.short_code}` : ""}`}
  label="Consommables sous le seuil"
  value={lowArticles.length}
  icon="cup"
  tone="warning"
/>
```

La grille est `grid-cols-2 lg:grid-cols-4` : avec 5 cartes, passe-la en `lg:grid-cols-5`, ou remplace une carte existante. Vérifie l'affichage à 360 px.

---

## 8. Recette 7 — Changer une règle de droits ⭐⭐⭐

Exemple : permettre au **lecteur** (personnel du restaurant) d'enregistrer une **consommation** et une **perte**, mais pas une livraison.

1. **Base d'abord** — nouvelle migration qui redéfinit `mouvement_article` : copie la fonction entière depuis `20261009090000_consommables.sql` et remplace l'appel `perform consommable_controle(…)` par un contrôle qui accepte le lecteur pour ces deux raisons :
   ```sql
   -- Le lecteur ne peut que consommer ou déclarer une perte, dans ses restaurants.
   if auth_role() = 'lecteur' and p_raison in ('consommation', 'perte') then
     if not has_restaurant(p_restaurant) then
       raise exception 'Restaurant non autorisé' using errcode = '42501';
     end if;
     if not exists (select 1 from articles where id = p_article) then
       raise exception 'Article introuvable' using errcode = 'P0002';
     end if;
   else
     perform consommable_controle(p_article, p_restaurant);
   end if;
   ```
2. **Tests** — `supabase/tests/13_consommables.sql` : la ligne « lecteur : consommation refusée » devient « autorisée » ; ajoute « lecteur : livraison refusée ». Lance `bash supabase/tests/run.sh 13_consommables`.
3. **Écran** — le bloc « Mettre à jour le stock » n'apparaît que si `canEditConsommables(role)`. Il faut l'afficher aussi au lecteur, avec seulement les opérations permises : passe le rôle à `ArticleOperation` et filtre `OPERATIONS` en conséquence.
4. **Tout relancer** : `bash supabase/tests/run.sh`.

---

## 9. Recette 8 — Ajouter un type de notification ⭐⭐⭐

1. **Migration seule** : `alter type notification_type add value 'mon_type';` (seule dans son fichier, chapitre 07).
2. **Migration suivante** : la fonction SQL qui crée la notification (`insert into notifications (user_id, type, title, body, link) …`), en respectant les réglages (`notification_settings`, voir `alerte_article_bas` comme modèle).
3. **`lib/notifications.ts`** : ajoute le type à `NotificationType`, à `TYPE_STYLE` (icône, couleur), à `CATEGORIES` (filtre) et à `SETTINGS` (interrupteur de « Mes alertes »). TypeScript te signale les oublis.
4. **E-mail aussi ?** Ajoute le type à `EMAIL_TYPES` dans `supabase/functions/envoyer-notification/index.ts`, puis `supabase functions deploy envoyer-notification`.

---

## 10. Le grand tutoriel : un module « Fournisseurs » complet ⭐⭐⭐

**Le besoin** : un carnet d'adresses des fournisseurs de la chaîne. Un nom (obligatoire, unique), un téléphone, une remarque.
**Qui voit** : tout le monde. **Qui ajoute et modifie** : propriétaire et éditeur. **Qui supprime** : propriétaire.
**Écrans** : la liste, « Nouveau fournisseur », « Modifier le fournisseur » (avec « Supprimer »).

Pas de règle multi-tables : **écritures simples protégées par la RLS**, pas de fonction SQL.

### Étape ① — La base

```bash
supabase migration new fournisseurs
```

Dans le fichier créé (`supabase/migrations/<date>_fournisseurs.sql`) :

```sql
-- Module « Fournisseurs » : carnet d'adresses des fournisseurs de la chaîne.
-- Lu par tout compte avec profil ; tenu par propriétaire et éditeur ; supprimé par le propriétaire.
create table fournisseurs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text check (phone is null or length(phone) <= 30),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now()
);
create unique index fournisseurs_nom_unique on fournisseurs (lower(btrim(name)));

alter table fournisseurs enable row level security;
grant select, insert, update, delete on fournisseurs to authenticated;

create policy fournisseurs_select on fournisseurs for select to authenticated
  using (auth_role() is not null);
create policy fournisseurs_insert on fournisseurs for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy fournisseurs_update on fournisseurs for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'))
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy fournisseurs_delete on fournisseurs for delete to authenticated
  using (auth_role() = 'proprietaire');
```

Ligne par ligne :
- `check (length(btrim(name)) between 1 and 120)` : un nom non vide, 120 caractères au plus ;
- `create unique index … (lower(btrim(name)))` : pas deux fois le même nom, **sans tenir compte des majuscules ni des espaces** ;
- `enable row level security` : **tout est refusé** tant qu'aucune règle n'ouvre ;
- `grant … to authenticated` : les usagers connectés peuvent *tenter* ces opérations… que les **quatre règles** filtrent ensuite.

```bash
supabase migration up --local
```

### Étape ② — Les tests de la base

`supabase/tests/14_fournisseurs.sql` (numérote à la suite des fichiers existants) :

```sql
-- 14. Fournisseurs : droits par rôle et unicité du nom.
begin;
\ir _fixture.sql
select * from no_plan();

insert into fournisseurs (name) values ('Sahel Emballages');

-- Lecture
select is(tests.essai('lec1', $$ select count(*) from fournisseurs $$), 'autorisé', 'lecteur : lecture autorisée');
select is(tests.essai('anon', $$ select count(*) from fournisseurs $$), 'refusé', 'anonyme : aucun accès');

-- Ajout
select is(tests.essai('ed1', $$ with t as (insert into fournisseurs (name) values ('Boissons du Faso') returning 1) select count(*) from t $$),
          'autorisé', 'éditeur : ajout autorisé');
select is(tests.essai('com1', $$ with t as (insert into fournisseurs (name) values ('X') returning 1) select count(*) from t $$),
          'refusé', 'commentateur : ajout refusé');
select is(tests.essai('lec1', $$ with t as (insert into fournisseurs (name) values ('X') returning 1) select count(*) from t $$),
          'refusé', 'lecteur : ajout refusé');

-- Modification
select is(tests.essai('ed1', $$ with t as (update fournisseurs set phone = '70 00 00 00' returning 1) select count(*) from t $$),
          'autorisé', 'éditeur : modification autorisée');
select is(tests.essai('lec1', $$ with t as (update fournisseurs set phone = '1' returning 1) select count(*) from t $$),
          'refusé', 'lecteur : modification refusée');

-- Suppression
select is(tests.essai('ed1', $$ with t as (delete from fournisseurs returning 1) select count(*) from t $$),
          'refusé', 'éditeur : suppression refusée');
select is(tests.essai('prop', $$ with t as (delete from fournisseurs returning 1) select count(*) from t $$),
          'autorisé', 'propriétaire : suppression autorisée');

-- Unicité du nom (casse et espaces ignorés)
select throws_ok($$ insert into fournisseurs (name) values ('  sahel EMBALLAGES ') $$, '23505', null,
                 'nom déjà pris refusé');

select * from finish();
rollback;
```

```bash
bash supabase/tests/run.sh 14_fournisseurs      # 10 réussis, 0 échoué
```

💡 Écris ces tests **avant** les écrans : si un test « refusé » passe en « autorisé », tu as une faille, et tu le sais tout de suite.

### Étape ③ — La logique : `lib/fournisseurs.ts`

```ts
// Fournisseurs : lectures côté serveur, avec les droits de l'usager (RLS).
import { createClient } from "@/lib/supabase/server";

export type Fournisseur = { id: string; name: string; phone: string | null; notes: string | null };

// Propriétaire et éditeur ajoutent et modifient (même règle en base). Seul le propriétaire supprime.
export const canEditFournisseurs = (role: string | undefined) => role === "proprietaire" || role === "editeur";

export async function listFournisseurs(): Promise<Fournisseur[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("fournisseurs").select("id, name, phone, notes").order("name");
  return (data ?? []) as Fournisseur[];
}

export async function getFournisseur(id: string): Promise<Fournisseur | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("fournisseurs").select("id, name, phone, notes").eq("id", id).maybeSingle();
  return data as Fournisseur | null;
}
```

### Étape ④ — Les actions : `app/(app)/fournisseurs/actions.ts`

```ts
"use server";

// Actions des fournisseurs. Droits vérifiés en base (RLS) : ajout et modification par
// propriétaire et éditeur, suppression par le propriétaire.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FournisseurInput = { id: string | null; name: string; phone: string; notes: string };
export type FournisseurResult = { ok: false; error: string; field?: string } | null;

export async function enregistrerFournisseur(input: FournisseurInput): Promise<FournisseurResult> {
  // 1. Vérifier la saisie (la base revérifie de toute façon).
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donnez un nom au fournisseur.", field: "name" };
  if (name.length > 120) return { ok: false, error: "Nom trop long (120 caractères au plus).", field: "name" };
  const fields = { name, phone: input.phone.trim() || null, notes: input.notes.trim() || null };

  // 2. Écrire, avec la session de l'usager.
  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from("fournisseurs").update(fields).eq("id", input.id).select("id")
    : await supabase.from("fournisseurs").insert(fields).select("id");

  // 3. Traduire les erreurs en messages clairs.
  if (error?.code === "23505") return { ok: false, error: "Ce fournisseur existe déjà.", field: "name" };
  if (error?.code === "42501" || (!error && !data?.length)) {
    return { ok: false, error: "Votre rôle ne permet pas de modifier les fournisseurs." };
  }
  if (error) return { ok: false, error: "L'enregistrement a échoué." };

  // 4. Rafraîchir et revenir à la liste.
  revalidatePath("/fournisseurs");
  redirect("/fournisseurs");
}

export async function supprimerFournisseur(id: string): Promise<FournisseurResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fournisseurs").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: "La suppression a échoué." };
  // Aucune ligne supprimée : la RLS a refusé (seul le propriétaire supprime).
  if (!data?.length) return { ok: false, error: "Seul un propriétaire peut supprimer un fournisseur." };
  revalidatePath("/fournisseurs");
  redirect("/fournisseurs");
}
```

À remarquer :
- une seule action pour **créer et modifier** (`input.id` vide = création) ;
- `!data?.length` : si la RLS refuse une mise à jour ou une suppression, il n'y a pas d'erreur, juste **zéro ligne** (chapitre 07) ;
- `redirect` est **à la fin**, hors de tout `try` (chapitre 05).

### Étape ⑤ — La liste : `app/(app)/fournisseurs/page.tsx`

```tsx
// Fournisseurs : la liste. Visible par tous ; « Ajouter » pour propriétaire et éditeur.
import Link from "next/link";
import { getProfile } from "@/lib/session";
import { canEditFournisseurs, listFournisseurs } from "@/lib/fournisseurs";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function FournisseursPage() {
  const [fournisseurs, profile] = await Promise.all([listFournisseurs(), getProfile()]);
  const canEdit = canEditFournisseurs(profile?.role);

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-5 lg:pt-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 font-display text-[22px] lg:text-[32px] font-semibold m-0">Fournisseurs</h1>
        {canEdit && (
          <Link href="/fournisseurs/nouveau" className={buttonClass({ variant: "secondary" })}>
            <Icon name="plus" /> Ajouter
          </Link>
        )}
      </header>

      {fournisseurs.length === 0 ? (
        <Card>Aucun fournisseur pour le moment.</Card>
      ) : (
        <Card padded={false} className="divide-y divide-surface-2 overflow-hidden">
          {fournisseurs.map((f) => {
            const content = (
              <>
                <div className="font-semibold">{f.name}</div>
                <div className="text-text-muted text-[14px]">{[f.phone, f.notes].filter(Boolean).join(" · ")}</div>
              </>
            );
            // Propriétaire et éditeur ouvrent la fiche pour la modifier ; les autres lisent seulement.
            return canEdit ? (
              <Link key={f.id} href={`/fournisseurs/${f.id}`} className="block px-4 py-3 min-h-14 text-text hover:bg-background">
                {content}
              </Link>
            ) : (
              <div key={f.id} className="px-4 py-3">
                {content}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
```

### Étape ⑥ — Le formulaire : `components/app/fournisseurs/fournisseur-form.tsx`

```tsx
"use client";

// Formulaire d'un fournisseur (ajout ou modification). Envoie à l'action serveur et
// affiche l'erreur éventuelle. « Supprimer » seulement pour le propriétaire, en modification.
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  enregistrerFournisseur,
  supprimerFournisseur,
  type FournisseurInput,
  type FournisseurResult,
} from "@/app/(app)/fournisseurs/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

export function FournisseurForm({ initial, canDelete }: { initial: FournisseurInput; canDelete: boolean }) {
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<FournisseurResult>(null);
  const [pending, startTransition] = useTransition();
  const fieldError = (f: string) => (result?.field === f ? result.error : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => setResult(await enregistrerFournisseur(v)));
  };
  const remove = () => {
    if (!confirm("Supprimer définitivement ce fournisseur ?")) return;
    startTransition(async () => setResult(await supprimerFournisseur(v.id!)));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {result && !result.field && <Alert variant="danger">{result.error}</Alert>}

      <Field label="Nom" htmlFor="f-name" error={fieldError("name")}>
        <TextInput id="f-name" value={v.name} maxLength={120} invalid={Boolean(fieldError("name"))}
          onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="Téléphone" htmlFor="f-phone" optional>
        <TextInput id="f-phone" type="tel" value={v.phone} maxLength={30}
          onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Field label="Remarque" htmlFor="f-notes" optional>
        <TextInput id="f-notes" value={v.notes} maxLength={500} placeholder="Ex. emballages, livre le lundi"
          onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>

      <div className="flex items-center gap-3">
        {canDelete && v.id && (
          <Button variant="ghost" icon="trash" className="!text-danger" onClick={remove} disabled={pending}>
            Supprimer
          </Button>
        )}
        <div className="flex-1" />
        <Link href="/fournisseurs" className={buttonClass({ variant: "secondary" })}>Annuler</Link>
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
```

C'est un composant **client** (`"use client"`) : il a un état (`useState`) et réagit aux saisies. Il appelle les actions serveur comme des fonctions.

### Étape ⑦ — Les deux pages du formulaire

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
      <FournisseurForm initial={{ id: null, name: "", phone: "", notes: "" }} canDelete={false} />
    </div>
  );
}
```

`app/(app)/fournisseurs/[id]/page.tsx` :

```tsx
// Modifier un fournisseur. Propriétaire et éditeur ; « Supprimer » pour le propriétaire.
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { canEditFournisseurs, getFournisseur } from "@/lib/fournisseurs";
import { FournisseurForm } from "@/components/app/fournisseurs/fournisseur-form";

export default async function FournisseurPage(props: PageProps<"/fournisseurs/[id]">) {
  const { id } = await props.params;
  const [fournisseur, profile] = await Promise.all([getFournisseur(id), getProfile()]);
  if (!fournisseur) notFound();
  if (!canEditFournisseurs(profile?.role)) redirect("/fournisseurs");

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 lg:pt-10 flex flex-col gap-4">
      <h1 className="font-display text-[22px] font-semibold m-0">Modifier le fournisseur</h1>
      <FournisseurForm
        initial={{ id: fournisseur.id, name: fournisseur.name, phone: fournisseur.phone ?? "", notes: fournisseur.notes ?? "" }}
        canDelete={profile?.role === "proprietaire"}
      />
    </div>
  );
}
```

Le `redirect()` en haut de page empêche un lecteur d'afficher le formulaire en tapant l'adresse. Ce n'est **qu'un confort** : même s'il y arrivait, la base refuserait l'enregistrement.

### Étape ⑧ — Le menu

`components/app/nav.tsx`, sous la ligne `const CONSOMMABLES_ITEM = …` :

```ts
const FOURNISSEURS_ITEM: NavItem = { href: "/fournisseurs", label: "Fournisseurs", short: "Fournisseurs", icon: "store" };
```

puis, dans la liste `items` du composant `Sidebar`, après `CONSOMMABLES_ITEM,` :

```ts
    FOURNISSEURS_ITEM,
```

Sur mobile, la barre du bas n'a que **4 onglets**. Pour y accéder sur téléphone, ajoute par exemple un lien depuis une autre page (comme le sélecteur `stock-switch.tsx`) plutôt qu'un 5e onglet (qui déborderait à 360 px).

### Étape ⑨ — Vérifier

```bash
npx tsc --noEmit
npx eslint .
bash supabase/tests/run.sh
bash scripts/dev-local.sh
```

À la main, dans le navigateur :
- en **propriétaire** : ajouter (nom vide → message ; nom en double → « Ce fournisseur existe déjà. »), modifier, supprimer ;
- en **lecteur** (fenêtre privée) : la liste est visible, pas de bouton « Ajouter », et `/fournisseurs/nouveau` renvoie à la liste ;
- en largeur **360 px** : rien ne déborde.

### Étape ⑩ — Documenter et livrer

- `docs/base-de-donnees.md` : la table `fournisseurs`, ses droits, la migration ;
- `docs/guide-developpeur.md` : les trois adresses dans le tableau des écrans ;
- `docs/journal-decisions.md` : pourquoi ce module, ce qui a été décidé ;
- livraison : chapitre 10.

### Pour aller plus loin

| Variante | Comment |
|---|---|
| Des fournisseurs **par restaurant** | colonne `restaurant_id uuid not null references restaurants (id)`, et `has_restaurant(restaurant_id)` dans les règles `using` et `with check` (modèle : `article_stocks`) |
| Relier un article à son fournisseur | colonne `fournisseur_id uuid references fournisseurs (id) on delete set null` dans `articles`, puis une liste de choix dans `article-form.tsx` |
| Une liste avec recherche et filtres | modèle : `article-list.tsx` + `UrlFilters` + `lireFiltres` |
| Une fiche « liste à gauche, détail à droite » sur ordinateur | modèle : `app/(app)/consommables/[id]/page.tsx` |
| Une opération qui touche plusieurs tables | une fonction SQL `security definer` (modèle : `mouvement_article`) |

---

## 11. La liste de contrôle d'une nouvelle fonctionnalité

- [ ] Les 6 questions de la méthode ont une réponse écrite
- [ ] Migration : tables, contraintes, `enable row level security`, règles de lecture **et** d'écriture
- [ ] Fonctions SQL éventuelles : contrôle connexion + rôle + restaurant, `revoke` puis `grant execute`
- [ ] Tests SQL : un « autorisé » et un « refusé » par rôle et par action
- [ ] `lib/` : lectures, `can…` ; règles pures dans `-rules.ts`, testées
- [ ] Actions : saisie revérifiée, erreurs traduites en français, `revalidatePath`, `redirect` à la fin
- [ ] Pages : `redirect()` en tête si le rôle ne convient pas ; `notFound()` si l'élément n'existe pas
- [ ] Composants : briques de `components/ui/`, couleurs du thème, `"use client"` seulement si nécessaire
- [ ] Menu
- [ ] `tsc`, `eslint`, tous les tests : 0 erreur
- [ ] Essai à la main : chaque rôle, mobile 360 px et ordinateur
- [ ] Documentation à jour

👉 Chapitre suivant : [Tester, déboguer, livrer](10-tester-deboguer-livrer.md)
