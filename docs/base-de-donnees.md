# Référence de la base de données

Mise à jour le 2026-10-08, à partir de la base locale après les 26 migrations (identique à l'hébergée), plus la migration des consommables du 2026-10-09 (branche `feature/stock-consommables`, pas encore sur l'hébergée).
Pour **modifier** la base (nouvelle migration, redéfinir une fonction, droits) : `docs/guide-developpeur.md`, section 6. Ici, on trouve **ce qui existe** et **où c'est défini**.

Afficher soi-même l'état réel (base locale, après `supabase start`) :

```bash
docker exec -it supabase_db_gmao-chitir psql -U postgres
\dt public.*            -- tables
\d+ interventions       -- colonnes, index, triggers d'une table
\df public.*            -- fonctions
\sf public.declarer_panne   -- source de la version EN VIGUEUR d'une fonction
select * from pg_policies where schemaname = 'public';   -- politiques RLS
```

Sur l'hébergé : Supabase → Table Editor (données), Database → Functions, Authentication → Policies, ou SQL Editor avec les mêmes requêtes.

---

## 1. Principe

- **Le restaurant décide ce qu'on voit, le rôle décide ce qu'on fait.** Chaque table a la RLS activée.
- `has_restaurant(id)` = l'utilisateur a accès à ce restaurant : propriétaire (`all_restaurants`), ou ligne dans `user_restaurants`.
- `auth_role()` = le rôle du profil (`users.role`). **NULL si le compte n'a pas de profil** : un tel compte ne lit ni n'écrit rien (migrations `20260930210000` et `20260930220000`).
- Les écritures qui touchent plusieurs tables passent par des **fonctions `SECURITY DEFINER`** (elles contournent la RLS et vérifient elles-mêmes rôle et restaurant). L'application les appelle par `supabase.rpc("nom", {...})`.
- Les droits par défaut sont **fermés** (`20260930220000`) : une nouvelle fonction n'est appelable que si elle reçoit `grant execute … to authenticated`.

---

## 2. Types (enums)

| Type | Valeurs | Sens |
|---|---|---|
| `user_role` | `proprietaire`, `editeur`, `commentateur`, `lecteur` | Rôle d'un compte. Commentateur = technicien. |
| `equipment_state` | `operationnel`, `en_panne`, `en_maintenance`, `hors_service` | État d'une machine. |
| `maintenance_frequency` | `journalier`, `hebdomadaire`, `mensuel`, `trimestriel`, `semestriel`, `annuel` | Fréquence d'entretien. Calcul de l'échéance : `next_due_date()`. Les deux premières datent du 2026-10-06. |
| `intervention_type` | `normal`, `urgence`, `alerte` | **Priorité** affichée « Priorité » (Normal, Urgence, Alerte). `alerte` ne compte pas comme entretien à la clôture. |
| `intervention_kind` | `correctif`, `preventif`, `controle`, `amelioration` | **Type** d'intervention affiché « Type » : Réparation, Entretien préventif, Contrôle, Installation ou amélioration. Libellés : `KIND_LABELS` dans `lib/interventions.ts`. |
| `intervention_status` | `a_planifier`, `en_cours`, `en_attente_piece`, `terminee` | Statut. `terminee` ne s'obtient que par la clôture. Libellés : `lib/intervention-status.ts`. |
| `equipment_event_type` | `panne_declaree`, `entretien`, `reparation`, `modification` | Ligne de la fiche de vie d'une machine. |
| `stock_movement_reason` | `livraison`, `intervention`, `ajustement` | Raison d'un mouvement de stock. |
| `notification_type` | `urgence`, `panne`, `entretien_prevu`, `entretien_retard`, `stock_bas`, `reparation`, `statut_intervention`, `attribution` | Type d'alerte, réglable dans « Mes alertes » (`SETTINGS` dans `lib/notifications.ts`). Mails : `urgence`, `panne`, `attribution` (`EMAIL_TYPES` dans l'Edge Function). |
| `photo_kind` | `avant`, `apres` | Photo de la panne ou du travail fait. |
| `article_famille` | `jetable`, `boisson`, `materiel` | Famille d'un consommable : emballages et jetables, boissons, matériel et fournitures en gros. Libellés : `FAMILLE_LABELS` (`lib/consommables-rules.ts`). |
| `article_mouvement_raison` | `livraison`, `consommation`, `perte`, `inventaire`, `transfert` | Raison d'un mouvement de consommable. |

Ajouter une valeur : `alter type … add value '…';` dans une migration **seule** (voir le guide).

---

## 3. Tables

`!` = obligatoire. Toutes les clés primaires `id` sont des `uuid` générés (sauf `article_stocks` : clé double article + restaurant).

### Comptes et restaurants

| Table | Colonnes | Rôle |
|---|---|---|
| `restaurants` | `name!`, `short_code!` (unique, ex. `CTR1`), `address`, `created_at` | Un restaurant. Le code court préfixe les codes machines (`CTR1-FRG-02`). |
| `users` | `id!` (= `auth.users.id`, suppression en cascade), `first_name`, `email`, `phone`, `role!` (défaut `lecteur`), `all_restaurants!`, `must_change_password!` (défaut vrai), `created_by` (→ `users`, `on delete set null`), `last_seen_at`, `created_at` | Profil applicatif d'un compte. Contraintes : e-mail ou téléphone ; un propriétaire a toujours `all_restaurants`. **Pas de politique d'écriture** : les écritures passent par la clé secrète côté serveur (`app/(app)/admin/actions.ts`, connexion, changement de mot de passe). |
| `user_restaurants` | `user_id!`, `restaurant_id!` | Restaurants accessibles d'un compte qui n'a pas `all_restaurants`. |

Les comptes de connexion eux-mêmes (e-mail, mot de passe) sont dans `auth.users`, gérés par Supabase Auth.

### Machines et entretien

| Table | Colonnes | Rôle |
|---|---|---|
| `categories` | `name!` (unique sans casse), `code!` (unique, `^[A-Z]{3}[0-9]*$`), `icon`, `created_at` | Catégorie de machine (Réfrigération, Cuisson…). `icon` = nom d'une icône de `components/icons.tsx`. Suppression refusée si une machine l'utilise. |
| `brands` | `name!` (unique), `created_at` | Marques. |
| `equipments` | `restaurant_id!`, `code!` (unique), `name!`, `category_id`, `brand_id`, `model`, `serial_number`, `installed_at`, `state!`, `notes`, `created_at`, `updated_at` | Une machine. **Nom unique par restaurant** (casse, accents, espaces ignorés : index `equipments_nom_restaurant_unique` sur `nom_equipement_normalise(name)`). `installed_at` = date du jour si vide (trigger). |
| `maintenance_plans` | `equipment_id!` (unique : **un plan par machine**), `task`, `frequency!`, `last_done_at`, `next_due_at`, `assigned_to`, `created_at`, `updated_at` | Plan d'entretien. `next_due_at` alimente les retards et la tâche du matin. |
| `maintenance_logs` | `plan_id`, `equipment_id!`, `done_at!`, `done_by`, `notes`, `created_at` | Journal des entretiens faits (bouton « Noter l'entretien comme fait », ou clôture d'une intervention). |
| `equipment_events` | `equipment_id!`, `type!`, `ref_id`, `summary!`, `user_id`, `created_at` | **Fiche de vie** de la machine (panne, réparation, entretien, modification). Écrite seulement par les fonctions. |

### Interventions

| Table | Colonnes | Rôle |
|---|---|---|
| `interventions` | `equipment_id` **ou** `equipment_free_text` (machine hors liste), `restaurant_id!`, `type!` (priorité), `kind` (type), `status!`, `symptoms!` (tableau de textes), `description`, `photo_url` (ancienne colonne, inutilisée), `reported_by`, `reported_at!`, `assigned_to` (technicien), `work_done`, `state_after`, `closed_by`, `closed_at`, `created_at` | Une panne déclarée ou une intervention créée. Modifiable en direct seulement sur certaines colonnes et tant qu'elle est ouverte (migration `20260930200000`). |
| `intervention_parts` | `intervention_id!`, `part_id!`, `quantity!` (> 0) | Pièces consommées à la clôture. |
| `intervention_photos` | `intervention_id!` (cascade), `kind!`, `storage_path!` (unique), `created_by`, `created_at` | Photos. Le fichier est dans le bucket `photos`, au chemin `{restaurant_id}/{intervention_id}/{uuid}.jpg`. |

### Stock

| Table | Colonnes | Rôle |
|---|---|---|
| `parts` | `code!` (unique), `name!`, `unit!`, `quantity!` (≥ 0), `min_threshold!` (≥ 0), `notes`, `created_at`, `updated_at` | Pièce détachée. **Stock commun à toute la chaîne.** La quantité ne change que par `mouvement_stock` ou la clôture (une pièce se crée à 0, migration `20260930200100`). |
| `stock_movements` | `part_id!`, `delta!` (≠ 0), `reason!`, `intervention_id`, `user_id`, `created_at` | Historique des entrées et sorties. |
| `part_compatibilities` | `part_id!`, `equipment_id!` | « Va avec » : machines pour lesquelles la pièce est prévue. Elles remontent en premier à la clôture. |

### Consommables (stock des restaurants)

Plan et règles : `docs/plan-module-consommables.md`. Migration : `20261009090000_consommables.sql`.

| Table | Colonnes | Rôle |
|---|---|---|
| `articles` | `code!` (unique, `^[A-Z0-9][A-Z0-9-]{0,29}$`), `name!` (unique sans casse : index `articles_nom_unique`), `famille!`, `unit!` (liste fermée `articles_unit_check`), `default_threshold!` (≥ 0), `notes`, `created_at`, `updated_at` | Catalogue **commun à la chaîne** (gobelets, boissons, huile en gros…). Le seuil par défaut est donné à un restaurant quand il commence à suivre l'article. |
| `article_stocks` | `article_id!`, `restaurant_id!` (clé double), `quantity!` (≥ 0), `min_threshold!` (≥ 0), `updated_at` | Quantité et seuil **par restaurant**. Ligne présente = article suivi dans ce restaurant. Ne s'écrit que par les fonctions. |
| `article_mouvements` | `article_id!` (**restrict**), `restaurant_id!`, `delta!` (≠ 0), `raison!`, `transfert_id` (obligatoire pour un transfert, sinon vide), `autre_restaurant_id`, `note`, `user_id`, `created_at` | Historique. Un transfert = deux lignes (−q, +q) de même `transfert_id`. |

### Notifications

| Table | Colonnes | Rôle |
|---|---|---|
| `notifications` | `user_id!`, `type!`, `title!`, `body`, `link`, `read_at`, `created_at`, `delivered_at` | Une alerte pour une personne. La cloche lit cette table. `delivered_at` = remise au mail et au push (réservée par l'Edge Function). Le destinataire ne peut modifier que `read_at`. |
| `notification_settings` | `user_id!`, `type!`, `enabled!` | Réglages « Mes alertes ». **Pas de ligne = activé.** |
| `push_tokens` | `token!` (clé), `user_id!`, `user_agent`, `created_at`, `last_seen_at` | Un appareil qui reçoit les push. |

---

## 4. Fonctions SQL

Une fonction peut être redéfinie par plusieurs migrations : **c'est la dernière qui compte**. La colonne « Version en vigueur » donne le fichier à recopier pour la modifier. Toutes celles marquées « oui » sont appelables par un utilisateur connecté (`authenticated`), aucune par un anonyme.

### Fonctions métier (appelées par l'application)

| Fonction | Qui | Ce qu'elle fait | Appelée depuis | Version en vigueur |
|---|---|---|---|---|
| `declarer_panne(p_equipment_id, p_type, p_symptoms, p_description, p_photo_url, p_restaurant_id, p_equipment_free_text, p_status)` | Tous les rôles, sur un restaurant accessible | Crée l'intervention (priorité normale ou urgente ; statut imposé « À planifier » pour le lecteur), met la machine **en panne**, ajoute la panne à la fiche de vie, prévient propriétaires, éditeurs et commentateurs du restaurant (sauf le déclarant), selon leurs réglages (`urgence` ou `panne`). | `app/(app)/panne/actions.ts` | `20260930230100` |
| `creer_intervention(p_kind, p_description, p_equipment_id, p_restaurant_id, p_equipment_free_text, p_type, p_status, p_assigned_to)` | Propriétaire, éditeur, commentateur | Crée une intervention de n'importe quel type. **Réparation** : mêmes effets qu'une panne déclarée. Autres types : la machine garde son état, seule la fiche de vie est complétée. Le technicien doit avoir accès au restaurant. | `app/(app)/interventions/actions.ts` (`creerIntervention`) | `20261006090200` |
| `changer_statut_intervention(p_intervention, p_statut)` | Propriétaire, éditeur, commentateur | Change le statut d'une intervention ouverte (jamais vers `terminee`), complète la fiche de vie, prévient le déclarant (`statut_intervention`). | `app/(app)/interventions/actions.ts` | `20260930230100` |
| `cloturer_intervention(p_intervention_id, p_work_done, p_state_after, p_assigned_to, p_parts)` | Propriétaire, éditeur, commentateur | Passe en `terminee` ; décompte les pièces (`p_parts` = `[{"part_id","quantity"}]`, refus si stock insuffisant) avec alerte `stock_bas` au franchissement du seuil ; met l'état de la machine ; fiche de vie ; **compte comme entretien** (sauf priorité `alerte`) : dernier entretien = aujourd'hui, échéance recalculée, journal ; prévient le déclarant (`reparation`). | `app/(app)/interventions/actions.ts` | `20260930210000` |
| `ajouter_photo_intervention(p_intervention, p_kind, p_path)` | Avant : tous, intervention ouverte. Après : propriétaire, éditeur, commentateur, intervention terminée | Enregistre une photo déjà déposée dans le bucket. Verrouille l'intervention puis compte : 3 par type au plus, même en cas d'ajouts simultanés. | `app/(app)/interventions/photos-actions.ts` | `20260930230300` |
| `enregistrer_equipement(p_id, p_restaurant_id, p_name, p_code, p_state, p_category_id, p_new_category, p_new_brand, …, p_frequency, p_task)` | Propriétaire, éditeur | Crée ou modifie une machine, crée au besoin la catégorie et la marque, crée ou met à jour le plan d'entretien, trace la modification dans la fiche de vie. | `app/(app)/equipements/actions.ts` | `20260930210000` |
| `prochain_code_equipement(p_restaurant_id, p_category_id)` | Connecté | Propose le prochain code libre (`CTR1-CUI-02`). | `app/(app)/equipements/actions.ts` (`suggererCode`) | `20260930090000` |
| `noter_entretien_fait(p_equipment_id, p_done_at, p_notes)` | Propriétaire, éditeur, commentateur | Entretien fait (pas de date future) : plan recalé, journal, fiche de vie. | `app/(app)/equipements/actions.ts` | `20260930210300` |
| `mouvement_stock(p_part_id, p_delta, p_reason)` | Propriétaire, éditeur | Livraison (+) ou correction ; jamais négatif ; la sortie « intervention » passe par la clôture ; alerte `stock_bas` au franchissement du seuil. | `app/(app)/stock/actions.ts` | `20260930210300` |
| `mouvement_article(p_article, p_restaurant, p_raison, p_quantite, p_note)` | Propriétaire, éditeur du restaurant | Livraison (+), consommation ou perte (−) ; quantité toujours positive ; première livraison = l'article devient suivi (seuil par défaut) ; jamais négatif ; alerte `stock_bas` au franchissement du seuil. Renvoie la nouvelle quantité. | `app/(app)/consommables/actions.ts` | `20261009090000` |
| `inventaire_article(p_article, p_restaurant, p_quantite, p_note)` | Propriétaire, éditeur du restaurant | Quantité **comptée** : l'écart est enregistré (raison `inventaire`), calculé sous verrou ; rien si l'écart est nul. Renvoie l'écart. | idem | `20261009090000` |
| `transferer_article(p_article, p_de, p_vers, p_quantite, p_note)` | Propriétaire, éditeur des **deux** restaurants | Deux mouvements liés ; stock suffisant au départ ; verrous dans un ordre fixe ; alerte au départ. | idem | `20261009090000` |
| `regler_seuil_article(p_article, p_restaurant, p_seuil)` | Propriétaire, éditeur du restaurant | Règle le seuil (l'article devient suivi). | idem | `20261009090000` |
| `ne_plus_suivre_article(p_article, p_restaurant)` | Propriétaire, éditeur du restaurant | Retire la ligne de stock si la quantité est 0 ; l'historique reste. | idem | `20261009090000` |
| `ajouter_restaurant(p_name, p_short_code, p_address, p_copy_from)` | Propriétaire | Crée le restaurant (code de 2 à 6 lettres ou chiffres). Avec `p_copy_from` : copie les machines (nouveaux codes, sans historique), leurs plans d'entretien et les « va avec ». | `app/(app)/admin/actions.ts` | `20260930210000` |

### Fonctions d'aide (utilisées par les politiques et les fonctions)

| Fonction | Rôle | Version |
|---|---|---|
| `auth_role()` | Rôle de l'utilisateur connecté, NULL sans profil | `20260929181001` |
| `has_restaurant(rid)` | Accès au restaurant | `20260929181001` |
| `equipment_restaurant(eid)`, `intervention_restaurant(iid)` | Restaurant d'une machine, d'une intervention | `20260929181001` |
| `shares_restaurant(target)` | L'utilisateur partage un restaurant avec ce compte (lecture des comptes) | `20260929181001` |
| `peut_intervenir(p_user, p_restaurant)` | Ce compte peut être technicien sur ce restaurant | `20260930210200` |
| `photo_intervention_accessible(p_name)`, `photo_objet_ajout_autorise(p_name)` | Politiques du bucket `photos` (chemin, restaurant, statut, 12 fichiers au plus par dossier) | `20260930230300` |
| `photos_max_par_type()` | Limite de photos (3). **Doit rester égale à** `PHOTOS_MAX_PAR_TYPE` (`lib/photos.ts`) | `20260930230300` |
| `next_due_date(freq, from_date)` | Échéance suivante selon la fréquence | `20261006090100` |
| `nom_equipement_normalise(p_name)` | Nom sans casse, accents ni espaces doublés (unicité) | `20261006090100` |
| `code_categorie_libre(p_name)` | Code libre pour une nouvelle catégorie (non appelable directement) | `20260930090000` |
| `date_courte_fr(d)` | « 6 oct. » dans les textes de notification | `20260930170000` |
| `set_updated_at()` | Met à jour `updated_at` | `20260929173837` |
| `consommable_controle(p_article, p_restaurant)` | Contrôles communs des fonctions de consommables (connexion, rôle, restaurant existant et accessible, article). **Non appelable directement** | `20261009090000` |
| `alerte_article_bas(…)` | Notification `stock_bas` d'un consommable aux propriétaires et éditeurs du restaurant. **Non appelable directement** | `20261009090000` |

### Tâches et triggers

| Fonction | Déclenchement | Rôle | Version |
|---|---|---|---|
| `taches_quotidiennes()` | pg_cron, tâche `gmao-taches-quotidiennes`, `0 7 * * *` (7 h UTC = 7 h à Ouagadougou) | Notifications `entretien_prevu` (échéance dans 3 jours) et `entretien_retard` (échéance passée) aux propriétaires, éditeurs et commentateurs du restaurant, selon leurs réglages. Rejouable sans doublon dans la journée. | `20260930170000` |
| `envoyer_notification_trigger()` | Trigger `trg_notifications_envoi`, après insertion dans `notifications` | Appelle l'Edge Function par pg_net avec l'id. ⚠️ **Adresse du projet écrite en dur** : voir `docs/taches-restantes.md`, T2. | `20260930190000` |
| `prevenir_technicien_attribue()` | Trigger `trg_interventions_attribution`, après insertion ou mise à jour d'`interventions` | Notification `attribution` au technicien choisi (pas si l'on se choisit soi-même, pas à la clôture). | `20261006090200` |
| `equipements_avant_ecriture()` | Trigger `trg_equipments_avant_ecriture`, avant insertion ou mise à jour d'`equipments` | Date d'installation par défaut ; message clair si le nom existe déjà dans le restaurant. | `20261006090100` |
| `set_updated_at()` | Triggers `trg_equipments_updated`, `trg_maintenance_plans_updated`, `trg_parts_updated` | Date de modification. | `20260929173837` |

---

## 5. Droits en direct (politiques RLS)

Ce que l'application peut faire **sans** passer par une fonction (lecture surtout). Source : `select * from pg_policies`.

| Table | Lecture | Ajout | Modification | Suppression |
|---|---|---|---|---|
| `restaurants` | restaurants accessibles | — (par `ajouter_restaurant`) | propriétaire | propriétaire |
| `users` | soi-même et les comptes qui partagent un restaurant | — (clé secrète) | — (clé secrète) | — (clé secrète) |
| `user_restaurants` | les siens et ceux des comptes partagés | — | — | — |
| `categories`, `brands` | tout compte avec profil | propriétaire, éditeur | propriétaire, éditeur | catégories : propriétaire, éditeur ; marques : propriétaire |
| `equipments` | restaurant accessible | propriétaire, éditeur (son restaurant) | propriétaire, éditeur | propriétaire |
| `maintenance_plans` | restaurant accessible | propriétaire, éditeur | propriétaire, éditeur | propriétaire |
| `maintenance_logs`, `equipment_events` | restaurant accessible | — (fonctions) | — | — |
| `interventions` | restaurant accessible | — (fonctions) | propriétaire, éditeur, commentateur, si **ouverte**, colonnes limitées | — |
| `intervention_parts` | restaurant accessible | — (clôture) | — | — |
| `intervention_photos` | restaurant accessible | — (fonction) | — | son auteur, propriétaire, éditeur |
| `parts` | tout compte avec profil | propriétaire, éditeur, **quantité 0** | propriétaire, éditeur | propriétaire |
| `stock_movements` | tout compte avec profil | — (fonctions) | — | — |
| `part_compatibilities` | tout compte avec profil | propriétaire, éditeur | — | propriétaire, éditeur |
| `articles` | tout compte avec profil | propriétaire, éditeur | propriétaire, éditeur | propriétaire (refusé si mouvements) |
| `article_stocks`, `article_mouvements` | restaurant accessible | — (fonctions ; droits d'écriture retirés) | — | — |
| `notifications` | les siennes | — (fonctions) | les siennes (colonne `read_at` seulement) | — |
| `notification_settings`, `push_tokens` | les siens | les siens | les siens | les siens |
| `storage.objects` (bucket `photos`) | intervention accessible | selon `photo_objet_ajout_autorise` | — | son auteur, propriétaire, éditeur |

Le compte anonyme (`anon`) n'a accès à **aucune** table (vérifié le 2026-10-06 avec la clé publique).

---

## 6. Storage, cron, extensions

- **Bucket `photos`** : privé, 2 Mo par fichier, `image/jpeg`, `image/png`, `image/webp` (migration `20260930230300`). Affichage par URL signées d'une heure (`lib/photos-server.ts`). Quota du plan gratuit : 1 Go pour tout le Storage.
- **pg_cron** : extension créée par `20260930170000` ; planification `gmao-taches-quotidiennes`. Vérifier : `select * from cron.job;` et `select * from cron.job_run_details order by start_time desc limit 10;`.
- **pg_net** : extension créée par `20260930190000` ; file d'attente des appels : `net.http_request_queue`, réponses : `net._http_response`.

---

## 7. Les migrations, une par une

Toutes dans `supabase/migrations/`, appliquées dans l'ordre des noms. **Ne jamais modifier une migration déjà poussée.**

| Fichier | Contenu |
|---|---|
| `20260929173837_schema.sql` | Types, tables, contraintes, index de départ. |
| `20260929181001_rls.sql` | RLS et politiques, fonctions d'aide (`auth_role`, `has_restaurant`…). |
| `20260929182000_functions.sql` | Premières fonctions métier (déclarer, clôturer, stock, entretien). |
| `20260929183000_seed_equipements.sql` | Données de départ : 2 restaurants (CTR1, CTR2), 6 catégories, 49 machines (fichier Excel du client). |
| `20260930090000_enregistrer_equipement.sql` | Créer et modifier une machine, code proposé, catégorie et marque à la volée. |
| `20260930120000_cloture_met_a_jour_entretien.sql` | La clôture compte comme entretien (sauf alerte). |
| `20260930150000_ajouter_restaurant.sql` | Ajouter un restaurant, avec copie des machines d'un autre. |
| `20260930170000_notifications_titres_et_taches.sql` | Titres de notification parlants, `taches_quotidiennes` et planification pg_cron. |
| `20260930190000_envoi_notifications.sql` | `delivered_at`, table `push_tokens`, trigger d'envoi par pg_net (adresse en dur). |
| `20260930200000_interventions_colonnes_modifiables.sql` | Recette H1 : colonnes modifiables d'une intervention limitées. |
| `20260930200100_parts_quantite_par_mouvements.sql` | Recette M1 : la quantité ne change que par mouvement. |
| `20260930200200_cloture_verifie_intervenant.sql` | Recette M2 : l'intervenant doit avoir accès au restaurant. |
| `20260930200300_notifications_lecture_seule.sql` | Recette B1 : seul `read_at` est modifiable. |
| `20260930210000_role_absent_refuse.sql` | Sécurité S-M1 : compte sans profil refusé partout (reprend plusieurs fonctions). |
| `20260930210100_proprietaire_tous_restaurants.sql` | S-M2 : un propriétaire a toujours tous les restaurants. |
| `20260930210200_fonctions_aide_restreintes.sql` | S-B1 : fonctions d'aide moins bavardes. |
| `20260930210300_stock_et_entretien_coherents.sql` | S-B6, S-B7 : raisons de mouvement et dates d'entretien vérifiées. |
| `20260930220000_lecture_reservee_aux_profils.sql` | Lecture réservée aux comptes avec profil, droits par défaut fermés. |
| `20260930230000_statuts_intervention_valeurs.sql` | Valeurs du statut (seules dans leur migration). |
| `20260930230100_statuts_intervention_fonctions.sql` | `changer_statut_intervention`, `declarer_panne` avec statut, politiques. |
| `20260930230200_categories_administration.sql` | Icône de catégorie, suppression par l'éditeur si aucune machine, unicité. |
| `20260930230300_photos_interventions.sql` | Bucket `photos`, table `intervention_photos`, politiques, limite. |
| `20260930230400_users_created_by_set_null.sql` | Supprimer un compte qui en a créé d'autres. |
| `20261006090000_frequences_et_natures_valeurs.sql` | Valeurs seules : fréquences `journalier` et `hebdomadaire`, types d'intervention `controle` et `amelioration`, notification `attribution`. |
| `20261006090100_equipements_date_et_noms.sql` | Échéances jour et semaine, date d'installation par défaut, noms uniques par restaurant. |
| `20261006090200_creer_intervention.sql` | `creer_intervention`, notification `attribution` au technicien. |
| `20261009090000_consommables.sql` | Module Consommables : types, tables `articles`, `article_stocks`, `article_mouvements`, RLS, fonctions de mouvement, inventaire, transfert, seuil. Ne modifie aucune table existante. |

---

## 8. Données de départ et données réelles

- Une base neuve (après `supabase db push` ou `supabase db reset`) contient seulement : 2 restaurants, 6 catégories, 49 machines opérationnelles, **aucun compte**. Le premier propriétaire se crée avec le script de `docs/taches-restantes.md` (T8).
- La base hébergée contient en plus les données réelles du client (comptes, CTR4, interventions…). Pour les voir sans rien modifier : `scripts/reperage-donnees.sql` dans le SQL Editor.
