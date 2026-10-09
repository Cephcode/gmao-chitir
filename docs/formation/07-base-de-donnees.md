# Chapitre 07 — La base de données

**Objectif** : savoir lire et écrire du SQL simple, comprendre comment le code parle à la base, et maîtriser les trois outils de la base du projet : **migrations**, **droits (RLS)** et **fonctions SQL**.

La liste exhaustive des tables et fonctions est dans `docs/base-de-donnees.md`. Ici, on apprend à **s'en servir**.

---

## 1. Les tables de la GMAO, en un schéma

Les flèches montrent les **clés étrangères** (« cette colonne pointe vers une ligne de cette table »).

```
                         restaurants ◄──────────────┬──────────────────┬──────────────┐
                            ▲    ▲                   │                  │              │
                            │    │             user_restaurants         │              │
                            │    │                   │                  │              │
 categories ◄── equipments ─┘    │      users ◄──────┘ (auth.users)     │              │
 brands     ◄──┘   ▲  ▲          │        ▲                             │              │
                   │  │          │        │ (reported_by, assigned_to…) │              │
   maintenance_plans  │    interventions ─┘                             │              │
   maintenance_logs   │      ▲     ▲                                    │              │
   equipment_events ──┘      │     └── intervention_photos              │              │
                             │                                           │              │
   parts ◄── intervention_parts                                          │              │
     ▲  ◄── stock_movements                                              │              │
     └──── part_compatibilities ──► equipments                           │              │
                                                                         │              │
   articles ◄── article_stocks ──────────────────────────────────────────┘              │
       ▲   ◄── article_mouvements ──────────────────────────────────────────────────────┘

   notifications, notification_settings, push_tokens ──► users
```

Les familles de tables :

| Famille | Tables | Clé « restaurant » ? |
|---|---|---|
| Comptes | `users` (profil), `user_restaurants` (accès), `restaurants` | — |
| Machines | `equipments`, `categories`, `brands`, `maintenance_plans`, `maintenance_logs`, `equipment_events` | oui, par `equipments.restaurant_id` |
| Interventions | `interventions`, `intervention_parts`, `intervention_photos` | oui, `interventions.restaurant_id` |
| Pièces (stock commun) | `parts`, `stock_movements`, `part_compatibilities` | **non** : commun à la chaîne |
| Consommables | `articles` (catalogue commun), `article_stocks`, `article_mouvements` | oui pour les quantités |
| Alertes | `notifications`, `notification_settings`, `push_tokens` | non : par usager |

---

## 2. SQL en 15 minutes

Ouvre le **Studio** de ta base locale (adresse donnée par `supabase status`, en général http://127.0.0.1:54323), menu **SQL Editor**, et essaie :

```sql
-- LIRE : quelles colonnes, de quelle table, avec quel filtre, dans quel ordre
select code, name, state from equipments where state = 'en_panne' order by code;

-- Compter
select count(*) from equipments;

-- Grouper : nombre de machines par restaurant
select restaurant_id, count(*) from equipments group by restaurant_id;

-- JOINDRE deux tables : le code du restaurant de chaque machine
select e.code, e.name, r.short_code
from equipments e
join restaurants r on r.id = e.restaurant_id
limit 10;

-- AJOUTER une ligne
insert into brands (name) values ('Ma marque');

-- MODIFIER
update brands set name = 'Ma marque bis' where name = 'Ma marque';

-- SUPPRIMER
delete from brands where name = 'Ma marque bis';
```

⚠️ Un `update` ou `delete` **sans `where`** touche **toutes** les lignes. Relis toujours avant d'exécuter, et **jamais sur la base hébergée** pour t'entraîner.

Quelques mots de vocabulaire :

| Mot | Sens | Exemple dans le projet |
|---|---|---|
| **clé primaire** | identifiant unique de la ligne | `id uuid primary key default gen_random_uuid()` |
| **clé étrangère** | pointe vers une autre table | `restaurant_id uuid references restaurants (id)` |
| `on delete cascade` | si la ligne visée est supprimée, celle-ci aussi | supprimer un article supprime ses lignes de stock |
| `on delete restrict` | interdit de supprimer la ligne visée tant que celle-ci existe | un article qui a des mouvements ne se supprime pas |
| **contrainte** `check` | règle vérifiée à chaque écriture | `quantity integer check (quantity >= 0)` : jamais négatif |
| `unique` | pas de doublon | `code text unique` |
| **index** | accélère les recherches sur une colonne | `create index … on article_mouvements (article_id, created_at desc)` |
| **enum** | liste fermée de valeurs | `create type user_role as enum ('proprietaire', 'editeur', …)` |

---

## 3. Comment le code parle à la base

Le code n'écrit **presque jamais de SQL**. Il utilise la bibliothèque `@supabase/supabase-js`, qui fabrique la requête pour lui :

```ts
const supabase = await createClient();          // lib/supabase/server.ts

// select … from parts order by name
const { data, error } = await supabase.from("parts").select("id, name, quantity").order("name");

// … where id = '…', une seule ligne (ou null)
await supabase.from("articles").select("*").eq("id", id).maybeSingle();

// insert … returning id
await supabase.from("articles").insert({ name, code, famille }).select("id").single();

// update … where id = …
await supabase.from("articles").update({ name }).eq("id", id);

// delete … where id = …
await supabase.from("articles").delete().eq("id", id);

// appeler une FONCTION SQL
await supabase.rpc("mouvement_article", { p_article: id, p_restaurant: rid, p_raison: "livraison", p_quantite: 5 });
```

| Méthode | Équivalent SQL |
|---|---|
| `.eq("col", v)`, `.neq(…)` | `where col = v`, `<> v` |
| `.in("col", [a, b])` | `where col in (a, b)` |
| `.lte`, `.gte`, `.lt`, `.gt` | `<=`, `>=`, `<`, `>` |
| `.is("col", null)` | `where col is null` |
| `.order("col", { ascending: false })` | `order by col desc` |
| `.limit(30)` | `limit 30` |
| `.single()` / `.maybeSingle()` | une seule ligne (erreur / `null` si aucune) |

**Lire des tables liées en une requête** : on écrit le nom de la table liée dans le `select`. Exemple réel, `lib/consommables.ts` :

```ts
.select("id, name, unit, stocks:article_stocks(restaurant_id, quantity, min_threshold)")
//                         └──┬─┘ └─────┬──────┘
//                    nom choisi   table liée (via sa clé étrangère vers articles)
```

Résultat : chaque article arrive avec un tableau `stocks`.

**Toujours regarder `error`** : chaque appel renvoie `{ data, error }`. Si `error` n'est pas `null`, l'opération a échoué (`error.code`, `error.message`).

---

## 4. Les migrations : l'historique de la base

**Toute la structure de la base** (tables, droits, fonctions) est écrite dans les fichiers de `supabase/migrations/`, **exécutés dans l'ordre de leur nom** (le nom commence par une date : `20261009090000_consommables.sql`).

```
supabase/migrations/
  20260929173837_schema.sql             ← tables de départ
  20260929181001_rls.sql                ← droits
  20260929182000_functions.sql          ← premières fonctions
  …
  20261009090000_consommables.sql       ← le module consommables
  2026xxxxxxxxxx_ton_changement.sql     ← ton prochain changement
```

**Le cycle d'une modification de base :**

```bash
supabase migration new ajout_fournisseur_article   # crée un fichier vide daté dans supabase/migrations/
# … écrire le SQL dans ce fichier …
supabase migration up --local                      # l'appliquer à ta base locale
# en cas d'erreur dans ta migration :
supabase db reset                                  # recrée la base locale depuis zéro (efface les données locales)
```

**Les règles d'or :**

1. 🚫 **Ne jamais modifier une migration déjà appliquée sur la base hébergée.** On en ajoute une nouvelle qui corrige.
2. **Ajouter plutôt que renommer ou supprimer** : pendant la mise en ligne, l'ancien code tourne quelques minutes avec la nouvelle base. Une colonne renommée le casserait.
3. **Une valeur ajoutée à un enum** (`alter type … add value`) doit être **seule dans sa migration** : PostgreSQL ne permet pas de l'utiliser dans la même transaction.
4. Mettre la base hébergée à jour : `supabase db push` (chapitre 10), **avant** de mettre le code en production.

---

## 5. La RLS : les droits, ligne par ligne

**RLS** = *Row Level Security*. Sur chaque table, des **règles** (*policies*) disent, **pour chaque ligne**, qui peut la lire, l'ajouter, la modifier, la supprimer. PostgreSQL les applique **à toutes les requêtes**, quel que soit le code qui les envoie.

Exemple réel, `supabase/migrations/20261009090000_consommables.sql` :

```sql
alter table articles enable row level security;          -- ① active la RLS : tout est REFUSÉ par défaut

create policy articles_select on articles for select to authenticated
  using (auth_role() is not null);                       -- ② lire : tout compte qui a un profil

create policy articles_insert on articles for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));   -- ③ ajouter : propriétaire, éditeur

create policy articles_delete on articles for delete to authenticated
  using (auth_role() = 'proprietaire');                  -- ④ supprimer : propriétaire

create policy article_stocks_select on article_stocks for select to authenticated
  using (has_restaurant(restaurant_id));                 -- ⑤ lire le stock : ses restaurants seulement
```

- `using (…)` : la condition pour **voir / toucher** une ligne existante ;
- `with check (…)` : la condition que doit respecter une ligne **ajoutée ou modifiée** ;
- `to authenticated` : pour les usagers connectés (les anonymes n'ont rien).

**Les fonctions d'aide** utilisables dans les règles :

| Fonction | Renvoie |
|---|---|
| `auth.uid()` | l'identifiant de l'usager connecté |
| `auth_role()` | son rôle (`'proprietaire'`, `'editeur'`, `'commentateur'`, `'lecteur'`), ou `null` s'il n'a pas de profil |
| `has_restaurant(id)` | `true` s'il a accès à ce restaurant |
| `equipment_restaurant(id)`, `intervention_restaurant(id)` | le restaurant d'une machine, d'une intervention |

**Ce que ça change pour le code** : une lecture interdite ne renvoie **pas d'erreur**, elle renvoie **zéro ligne**. Une écriture interdite renvoie une erreur `42501` (insertion) ou modifie **zéro ligne** (mise à jour, suppression). C'est pourquoi les actions vérifient :

```ts
const { data, error } = await supabase.from("articles").delete().eq("id", id).select("id");
if (!data?.length) return { ok: false, error: "Seul un propriétaire peut supprimer un article." };
```

💡 **« Mes données n'apparaissent pas »** : 9 fois sur 10, c'est la RLS qui fait son travail (mauvais restaurant, mauvais rôle). Vérifie avec quel compte tu es connecté.

---

## 6. Les fonctions SQL : les écritures importantes

Quand une écriture doit **toucher plusieurs tables d'un coup** ou **respecter des règles métier** (stock jamais négatif, historique, alerte), on l'écrit en **fonction SQL** (langage **PL/pgSQL**). Avantages :
- **tout ou rien** : si une étape échoue, rien n'est enregistré (une *transaction*) ;
- les règles sont **au plus près des données**, impossibles à contourner.

Le code l'appelle avec `supabase.rpc("nom", { paramètres })`.

Lisons une vraie fonction, simplifiée, `mouvement_article` :

```sql
create function mouvement_article(
  p_article uuid,                          -- les paramètres commencent par p_ (convention)
  p_restaurant uuid,
  p_raison article_mouvement_raison,
  p_quantite integer,
  p_note text default null
)
returns integer                            -- ce qu'elle renvoie : la nouvelle quantité
language plpgsql
security definer                           -- s'exécute avec les droits du créateur (contourne la RLS)…
set search_path = public, pg_temp          -- (sécurité : toujours le mettre)
as $$
declare                                    -- variables locales (préfixe v_)
  v_avant integer;
  v_apres integer;
  v_delta integer;
begin
  perform consommable_controle(p_article, p_restaurant);   -- …DONC elle vérifie elle-même : connecté, rôle, restaurant

  if p_quantite is null or p_quantite <= 0 then
    raise exception 'La quantité doit être un nombre entier positif' using errcode = '22023';
  end if;
  v_delta := case when p_raison = 'livraison' then p_quantite else -p_quantite end;

  select quantity into v_avant from article_stocks
  where article_id = p_article and restaurant_id = p_restaurant
  for update;                              -- verrouille la ligne : deux saisies simultanées ne se mélangent pas

  v_apres := v_avant + v_delta;
  if v_apres < 0 then
    raise exception 'Stock insuffisant (reste %, retrait %)', v_avant, -v_delta using errcode = '23514';
  end if;

  insert into article_mouvements (…) values (…);           -- l'historique
  update article_stocks set quantity = v_apres where …;    -- la quantité
  perform alerte_article_bas(…);                           -- la notification si on passe sous le seuil
  return v_apres;
end;
$$;

-- OBLIGATOIRE : qui peut l'appeler
revoke execute on function mouvement_article(uuid, uuid, article_mouvement_raison, integer, text) from public, anon;
grant  execute on function mouvement_article(uuid, uuid, article_mouvement_raison, integer, text) to authenticated;
```

**Les messages d'erreur** : `raise exception 'message' using errcode = 'code'`. Pour les codes `42501` (droits), `22023` (saisie), `23514` (stock), `P0002` (introuvable), **le message s'affiche tel quel à l'usager** (fonction `sqlMessage` des actions) : écris-le en bon français.

**Modifier une fonction existante** : une fonction peut avoir été redéfinie dans plusieurs migrations ; **c'est la plus récente qui compte**. Pour la retrouver :
```bash
grep -l "function declarer_panne" supabase/migrations/* | tail -1
```
Recopie-la **entière** dans une nouvelle migration, en remplaçant `create function` par `create or replace function`, et modifie seulement ce qu'il faut. Si tu changes ses paramètres : `drop function nom(anciens types);` d'abord, puis remets les `grant`.

---

## 7. Triggers et tâche planifiée

Un **trigger** lance une fonction **automatiquement** quand une table change :

| Trigger | Sur | Effet |
|---|---|---|
| `trg_notifications_envoi` | ajout dans `notifications` | appelle l'Edge Function (push + e-mail) |
| `trg_interventions_attribution` | ajout/modification d'`interventions` | prévient le technicien attribué |
| `trg_equipments_avant_ecriture` | écriture dans `equipments` | date d'installation par défaut, message si nom en double |
| `trg_…_updated` | modification de plusieurs tables | remplit `updated_at` |

**`pg_cron`** lance `taches_quotidiennes()` **chaque jour à 7 h** (rappels d'entretien). Voir les exécutions : `select * from cron.job_run_details order by start_time desc limit 10;`

---

## 8. Les tests de la base

Les fichiers `supabase/tests/*.sql` testent les droits et les règles avec **pgTAP**. Chaque fichier :
1. ouvre une transaction (`begin;`) ;
2. charge un jeu de données commun (`\ir _fixture.sql` : restaurants TSTA et TSTB, un compte par rôle `prop`, `ed1`, `com1`, `lec1`…) ;
3. vérifie des affirmations (`select is(…, …, 'description')`) ;
4. **annule tout** (`rollback;`) : rien ne reste.

La fonction la plus utile : **`tests.essai('compte', 'requête')`** joue la requête **en tant que** ce compte et renvoie `'autorisé'` ou `'refusé'` :

```sql
select is(tests.essai('lec1', $$ select mouvement_article(tests.id('A1'), tests.id('R1'), 'consommation', 1) + 1 $$),
          'refusé', 'lecteur : consommation refusée');
```

```bash
bash supabase/tests/run.sh                    # tout (base locale démarrée)
bash supabase/tests/run.sh 13_consommables    # un seul fichier
```

---

## 9. Regarder la base pour de vrai

| Je veux… | Comment |
|---|---|
| Voir les tables et leurs lignes (local) | Studio local → **Table Editor** |
| Lancer une requête (local) | Studio local → **SQL Editor**, ou `docker exec -it supabase_db_gmao-chitir psql -U postgres` |
| Voir la définition **en vigueur** d'une fonction | dans psql : `\sf public.mouvement_article` |
| Voir les colonnes d'une table | dans psql : `\d+ articles` |
| Voir toutes les règles RLS | `select * from pg_policies where schemaname = 'public';` |
| Voir la base **hébergée** (lecture) | supabase.com → projet → Table Editor / SQL Editor. ⚠️ Vraies données : lecture seulement, sauf geste voulu |

---

## ✅ Ce qu'il faut retenir

- Le code lit et écrit avec `supabase.from(…)` et appelle les fonctions avec `supabase.rpc(…)` ; toujours tester `error`.
- **Migrations** : un fichier daté par changement, jamais modifié une fois en ligne ; `supabase migration new` puis `supabase migration up --local`.
- **RLS** : chaque table refuse tout par défaut, des règles ouvrent ce qu'il faut ; une lecture interdite renvoie **zéro ligne**.
- **Fonctions SQL** `security definer` : elles **doivent** vérifier connexion + rôle + restaurant, et recevoir un `grant execute`.

## 🏋️ Exercice 7

1. Dans le SQL Editor local, écris la requête qui affiche, pour chaque restaurant, son code et son nombre de machines en panne.
2. Ouvre `supabase/migrations/20261009090000_consommables.sql` : qui peut supprimer un article ? Pourquoi est-ce refusé quand l'article a des mouvements ? (indice : `restrict`)
3. Trouve la version en vigueur de la fonction `declarer_panne` (le nom du fichier).

👉 Chapitre suivant : [Référence du code : qui fait quoi](08-reference-du-code.md)
