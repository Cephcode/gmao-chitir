# Plan d'implémentation : module « Consommables » (stock des restaurants)

Rédigé le 2026-10-09, branche `feature/stock-consommables`. Ce plan se suit de haut en bas, sans assistant. Chaque étape dit **quoi créer, où, et comment vérifier**. Le code de référence est sur la branche : en cas de doute, comparer avec lui.

---

## 0. La demande et ce qu'on construit

> Le client veut gérer **le stock des restaurants** : plats et emballages jetables, boissons, et matériel acheté en gros pour la chaîne.

Le stock existant (`/stock`) gère les **pièces détachées** de maintenance : un stock **commun à toute la chaîne**, sans restaurant. Le nouveau besoin est différent : **chaque restaurant a ses propres quantités** (CTR1 a 40 cartons de gobelets, CTR2 en a 3). On crée donc un **second module, séparé**, appelé **Consommables**, sans toucher au stock de pièces.

| | Stock de pièces (existant) | Consommables (nouveau) |
|---|---|---|
| Adresse | `/stock` | `/consommables` |
| Quantité | une seule, pour la chaîne | **une par restaurant** |
| Seuil d'alerte | un par pièce | **un par article et par restaurant** (valeur par défaut sur l'article) |
| Opérations | livraison, correction, sortie par intervention | **livraison, consommation, perte/casse, inventaire, transfert entre restaurants** |
| Qui modifie | propriétaire, éditeur | propriétaire, éditeur **du restaurant concerné** |
| Qui voit | tous | tous, **seulement leurs restaurants** |

**Familles d'articles** (fixées en base, extensibles) :
- `jetable` : « Emballages et jetables » (boîtes, gobelets, serviettes, couverts…) ;
- `boisson` : « Boissons » ;
- `materiel` : « Matériel et fournitures en gros » (huile en fût, produits d'entretien, ustensiles…).

### Décisions prises (et pourquoi)

1. **Module séparé** plutôt qu'une colonne « restaurant » ajoutée aux pièces : les pièces sont volontairement communes (journal, 2026-09-29) et la clôture d'intervention les décompte ; mélanger les deux casserait ces règles.
2. **Catalogue commun, quantités par restaurant** : un article (« Gobelet 50 cl », code `GOB-50`) est créé une fois pour la chaîne ; chaque restaurant a sa ligne de stock (`article_stocks`).
3. **Un article n'est « suivi » dans un restaurant qu'à partir de sa première opération** (livraison, inventaire, transfert reçu ou réglage du seuil). Sinon, chaque nouvel article serait « sous le seuil » dans tous les restaurants.
4. **Les quantités ne bougent que par des fonctions SQL** (comme les pièces) : aucune écriture directe, chaque mouvement est tracé, jamais de stock négatif, et l'alerte part au franchissement du seuil.
5. **Alerte = type `stock_bas` existant** : le réglage « Stock sous le seuil » de « Mes alertes » couvre aussi les consommables. Pas de nouvelle valeur d'enum, pas de redéploiement de l'Edge Function. Destinataires : propriétaires et éditeurs **qui ont accès au restaurant**.
6. **Menu** : une entrée « Consommables » dans le menu latéral (ordinateur). Sur mobile, la barre du bas garde 4 onglets ; l'onglet « Stock » ouvre les deux modules, avec un sélecteur « Pièces détachées | Consommables » en haut de page.

### À faire valider par le client (sans bloquer la livraison)

- Les **3 familles** et la liste des **unités** (`piece`, `paquet`, `carton`, `bouteille`, `casier`, `sac`, `rouleau`, `litre`, `kg`).
- **Qui** enregistre une consommation : aujourd'hui propriétaire et éditeur. Si les gérants de restaurant sont des « lecteurs » et doivent saisir, ouvrir la consommation au lecteur (une ligne dans `mouvement_article`, section 2.3).
- Un **dépôt central** (entrepôt de la chaîne) : non prévu. Si besoin, le créer comme un restaurant à part (code `DEPOT`) suffit, les transferts font le reste.

---

## 1. Préparer le poste

```bash
git checkout staging && git pull
git checkout -b feature/stock-consommables
npm install
supabase start                 # base locale (Docker)
bash supabase/tests/run.sh     # tout doit passer AVANT de commencer
```

Lire `node_modules/next/dist/docs/` pour les points Next 16 (voir `AGENTS.md`) : `PageProps<"/chemin">`, `params` et `searchParams` sont des promesses, middleware = `proxy.ts`.

---

## 2. Base de données (migration unique)

Fichier : `supabase/migrations/20261009090000_consommables.sql` (créé avec `supabase migration new consommables`, puis renommé si besoin).

### 2.1 Types

```sql
create type article_famille as enum ('jetable', 'boisson', 'materiel');
create type article_mouvement_raison as enum ('livraison', 'consommation', 'perte', 'inventaire', 'transfert');
```
Les deux types sont **nouveaux** : on peut les créer et les utiliser dans la même migration (la règle « migration à part » ne vaut que pour `alter type … add value`).

### 2.2 Tables

| Table | Colonnes | Remarques |
|---|---|---|
| `articles` | `id`, `code!` (unique, majuscules, chiffres, tirets), `name!` (unique sans casse), `famille!`, `unit!` (liste fermée), `default_threshold!` (≥ 0), `notes`, `created_at`, `updated_at` | Catalogue commun. Trigger `set_updated_at`. |
| `article_stocks` | `article_id!`, `restaurant_id!` (clé primaire double), `quantity!` (≥ 0), `min_threshold!` (≥ 0), `updated_at` | Une ligne = l'article est suivi dans ce restaurant. Suppression en cascade avec l'article ou le restaurant. |
| `article_mouvements` | `id`, `article_id!` (**restrict**), `restaurant_id!`, `delta!` (≠ 0), `raison!`, `transfert_id`, `autre_restaurant_id`, `note` (300 car.), `user_id`, `created_at` | Historique. `restrict` : un article qui a des mouvements ne peut pas être supprimé (on garde l'historique). Index `(article_id, created_at desc)` et `(restaurant_id, created_at desc)`. |

### 2.3 Fonctions (toutes `security definer set search_path = public, pg_temp`)

Modèle à suivre : `docs/guide-developpeur.md`, section 9. Chacune vérifie **connexion, rôle (`v_role is null or …`), restaurant (`has_restaurant`)**, puis verrouille la ligne de stock (`for update`).

| Fonction | Rôle | Règles |
|---|---|---|
| `mouvement_article(p_article, p_restaurant, p_raison, p_quantite, p_note)` | Propriétaire, éditeur | `p_quantite` > 0 ; `livraison` ajoute, `consommation` et `perte` retirent ; `inventaire` et `transfert` refusés ici (fonctions dédiées). Crée la ligne de stock à la première livraison (seuil = seuil par défaut). Jamais négatif (`23514`). Renvoie la nouvelle quantité. |
| `inventaire_article(p_article, p_restaurant, p_quantite, p_note)` | Propriétaire, éditeur | `p_quantite` = **quantité comptée** (≥ 0). L'écart avec le stock est enregistré en mouvement `inventaire` (rien si l'écart est nul). Calculé **sous verrou** : deux comptages simultanés ne se mélangent pas. |
| `transferer_article(p_article, p_de, p_vers, p_quantite, p_note)` | Propriétaire, éditeur des **deux** restaurants | Deux restaurants différents ; stock suffisant au départ ; deux mouvements `transfert` (−q, +q) avec le même `transfert_id` ; lignes verrouillées dans un ordre fixe (pas d'interblocage). |
| `regler_seuil_article(p_article, p_restaurant, p_seuil)` | Propriétaire, éditeur | Seuil ≥ 0. Crée la ligne si besoin (l'article devient suivi). |
| `ne_plus_suivre_article(p_article, p_restaurant)` | Propriétaire, éditeur | Seulement si la quantité est 0. Supprime la ligne de stock ; les mouvements restent. |
| `alerte_article_bas(…)` | (interne, non appelable) | Notification `stock_bas` aux propriétaires et éditeurs ayant accès au restaurant, selon leur réglage, au **franchissement** du seuil vers le bas. |

Pour chaque fonction appelable : `revoke execute … from public, anon; grant execute … to authenticated;`.

Messages d'erreur **en français** et codes connus de l'application : `42501` (droits), `22023` (saisie), `23514` (stock), `P0002` (introuvable).

### 2.4 Droits (RLS)

| Table | Lecture | Ajout | Modification | Suppression |
|---|---|---|---|---|
| `articles` | tout compte avec profil | propriétaire, éditeur | propriétaire, éditeur | propriétaire |
| `article_stocks` | restaurant accessible | — (fonctions) | — | — |
| `article_mouvements` | restaurant accessible | — (fonctions) | — | — |

En plus des politiques : `revoke insert, update, delete on article_stocks, article_mouvements from authenticated` (seconde barrière).

### 2.5 Appliquer et vérifier

```bash
supabase migration up --local
docker exec -it supabase_db_gmao-chitir psql -U postgres -c '\d+ article_stocks'
```

---

## 3. Tests de la base

Fichier : `supabase/tests/13_consommables.sql` (copie du squelette d'un test existant : `begin;`, `\ir _fixture.sql`, `select * from no_plan();` … `select * from finish(); rollback;`).

À couvrir (le fichier de la branche en contient une soixantaine) :
1. livraison, consommation, perte : quantités, traces, auteur ; quantité = somme des mouvements ;
2. jamais négatif, quantité nulle ou négative refusée, raison incohérente refusée ;
3. inventaire : écart positif, négatif, nul (pas de mouvement) ;
4. transfert : deux mouvements liés, stock insuffisant refusé, même restaurant refusé, restaurant non accessible refusé ;
5. seuil : alerte au franchissement seulement, destinataires limités au restaurant, réglage « stock_bas » respecté ;
6. droits : matrice rôle × restaurant (propriétaire, éditeur de R1 sur R1 et R2, commentateur, lecteur, anonyme) ; lecture limitée au restaurant ; aucune écriture directe ;
7. suppression : article avec mouvements refusé, article neuf accepté (propriétaire seulement).

```bash
bash supabase/tests/run.sh 13_consommables   # le nouveau fichier
bash supabase/tests/run.sh                   # toute la suite : 0 échec
```

---

## 4. Logique côté application (`lib/`)

| Fichier | Contenu |
|---|---|
| `lib/consommables-rules.ts` | **Règles pures**, sans base (testables) : `FAMILLES` et libellés, `UNITES` et `uniteLabel` (singulier/pluriel), `OPERATIONS` (livraison, consommation, perte, inventaire, transfert, seuil), `estSousSeuil`, `resumeArticle` (quantité et statut selon le restaurant choisi), `verifierArticle` et `verifierOperation` (validation des saisies), filtres d'adresse (`lireFiltres`, `filtresQuery`, `appliquerFiltres`), `normaliserCode`. |
| `lib/consommables.ts` | **Lectures** (serveur, droits de l'utilisateur) : `listArticles`, `getArticle`, `listMouvementsArticle`, `listRestaurantsAccessibles`, `chargerListe`, `canEditConsommables`. |
| `tests/consommables-rules.test.ts` | Tests `node --test` des règles pures. |

---

## 5. Actions serveur

Fichier : `app/(app)/consommables/actions.ts` (`"use server"`).

| Action | Appelle | Après succès |
|---|---|---|
| `enregistrerArticle(input)` | insert / update direct sur `articles` (RLS) | `revalidatePath("/", "layout")` puis `redirect("/consommables/{id}")` |
| `supprimerArticle(id)` | delete direct (RLS, `23503` = a des mouvements) | redirect `/consommables` |
| `operationArticle(input)` | selon l'opération : `mouvement_article`, `inventaire_article`, `transferer_article`, `regler_seuil_article` | message de confirmation |
| `arreterSuivi(articleId, restaurantId)` | `ne_plus_suivre_article` | message |

Chaque action **revalide la saisie** (`verifierArticle`, `verifierOperation`) avant d'appeler la base, et n'affiche tel quel que les messages SQL des codes connus (`sqlMessage`, comme `stock/actions.ts`).

---

## 6. Écrans

| Adresse | Fichier | Contenu |
|---|---|---|
| `/consommables` | `app/(app)/consommables/page.tsx` | Liste : recherche, puces **Restaurant**, **Famille** ; onglets mobile « Tous / Sous le seuil » ; bandeau ordinateur des articles sous le seuil. Cartes sur mobile, tableau sur ordinateur. |
| `/consommables/[id]` | `…/[id]/page.tsx` | Fiche article : **une ligne par restaurant** (quantité, seuil, statut), **bloc « Mettre à jour le stock »** (restaurant, opération, quantité, destination, remarque), historique des mouvements. Ordinateur : liste à gauche, fiche à droite (comme le stock). |
| `/consommables/nouveau`, `/consommables/[id]/modifier` | `…/nouveau/page.tsx`, `…/[id]/modifier/page.tsx` | Formulaire article (désignation, code, famille, unité, seuil par défaut, remarque). Supprimer : propriétaire. Réservé propriétaire et éditeur (`redirect` sinon). |
| — | `…/loading.tsx` | Écran de chargement. |

Composants : `components/app/consommables/` → `article-list.tsx`, `article-sheet.tsx`, `article-form.tsx`, `article-operation.tsx` (client), et `components/app/stock/stock-switch.tsx` (sélecteur mobile Pièces | Consommables, affiché aussi sur `/stock`).

Filtres dans l'adresse : `/consommables?q=&restaurant=CODE&famille=&statut=sous_seuil`.

Règles d'interface à respecter (maquettes et `docs/recette/3-conformite.md`) : cibles tactiles de 44 px, statut = couleur + icône + texte (`StatusBadge`, nouvelle clé `nonSuivi`), une seule action orange par écran, `grid-cols-1` + `min-w-0` contre le débordement mobile, texte en français.

---

## 7. Intégrations

1. **Menu** (`components/app/nav.tsx`) : entrée « Consommables » (icône `cup`, ajoutée à `components/icons.tsx`) dans le menu latéral ; l'onglet mobile « Stock » reste actif sur `/consommables`.
2. **Tableau de bord** (`app/(app)/page.tsx`) : les articles sous le seuil (du restaurant choisi, ou de tous) entrent dans « À traiter en priorité », après les pièces.
3. **Mes alertes** (`lib/notifications.ts`) : texte d'aide de « Stock sous le seuil » → « Pièces et consommables, une fois par passage sous le seuil ».

---

## 8. Vérifications avant de pousser

```bash
npx tsc --noEmit
npx eslint .
bash supabase/tests/run.sh          # toute la suite, 0 échec
npx next build
```

Parcours à la main (base locale, section 7 du guide développeur) avec **deux comptes** (propriétaire, éditeur de CTR1) :
1. Propriétaire : créer « Gobelet 50 cl », `GOB-50`, Emballages et jetables, carton, seuil par défaut 5.
2. Livraison de 20 à CTR1 → 20 cartons, « Suffisant ». CTR2 reste « Non suivi ».
3. Consommation de 16 à CTR1 → 4, « Sous le seuil » ; l'éditeur de CTR1 reçoit l'alerte.
4. Transfert de 3 de CTR1 vers CTR2 → CTR1 : 1, CTR2 : 3 ; deux lignes dans l'historique.
5. Inventaire CTR2 : 2 comptés → mouvement −1.
6. Éditeur de CTR1 : ne voit pas CTR2 ; ne peut pas supprimer l'article.
7. Lecteur : voit les quantités, aucun bouton d'action.
8. Mobile (390 px et 360 px) : pas de débordement, sélecteur « Pièces | Consommables ».

---

## 9. Livraison

Ordre obligatoire (`docs/guide-developpeur.md`, section 6) : **migration, puis code**.

1. Commiter sur la branche, pousser : `git push -u origin feature/stock-consommables`. Vercel donne une adresse de prévisualisation ; refaire le parcours sur téléphone.
2. Pull request `feature/stock-consommables` → `staging`, relecture, fusion.
3. Base hébergée : `cat supabase/.temp/project-ref` (bon projet ?), `supabase db push --dry-run` (une seule migration : `20261009090000_consommables.sql`), puis `supabase db push`, puis `supabase migration list`.
   La migration **ne touche à aucune table existante** : le code en production continue de fonctionner pendant le délai.
4. Pas d'Edge Function à redéployer (type `stock_bas` déjà géré).
5. Pull request `staging` → `main`, fusion : Vercel met en production.
6. Avec le client : créer le catalogue (articles), puis un **inventaire** par restaurant pour démarrer les quantités.

---

## 10. Documentation à tenir à jour

- `docs/base-de-donnees.md` : types, tables, fonctions, droits, migration.
- `docs/guide-developpeur.md` : carte du projet (`lib/`), tableau des écrans, filtres, recette « ajouter une famille ou une unité ».
- `docs/journal-decisions.md` : entrée du 2026-10-09 (décisions de la section 0).
- `docs/taches-restantes.md` : la livraison de ce module (section 9) tant qu'elle n'est pas faite.

### Ajouter plus tard une famille ou une unité

- **Famille** : migration seule `alter type article_famille add value 'nouvelle';`, puis `FAMILLES` dans `lib/consommables-rules.ts`.
- **Unité** : migration qui remplace la contrainte `articles_unit_check`, puis `UNITES` dans `lib/consommables-rules.ts`.
