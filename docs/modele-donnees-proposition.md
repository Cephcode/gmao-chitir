# Proposition de modèle de données (à valider avant tout SQL)

Base : PostgreSQL via Supabase. Source : `docs/prompt-navigation-gmao.md` (section 5) et les décisions validées.
Aucune ligne de SQL n'est écrite tant que la matrice des droits (plus bas) n'est pas confirmée.

## Décisions validées
- **Commentaires ignorés** : pas de table `comments`, pas d'événement ni de notification de type commentaire. Le rôle « commentateur » est conservé mais **redéfini en rôle technicien** (voir la matrice).
- **Authentification par Supabase Auth** : le mot de passe vit dans `auth.users`. Notre table `users` est un profil rattaché à `auth.users.id`.
- **Rôle depuis le serveur** : pas d'écran de choix de rôle.
- **Statuts calculés** (À jour / En retard, Suffisant / Sous le seuil), jamais stockés.
- **Stock global partagé** (Q2) : une seule réserve pour toute la chaîne, `parts` n'a pas de `restaurant_id`.
- **Invitations sans table à jeton** (Q3) : compte créé avec un mot de passe temporaire généré, changement obligatoire à la première connexion. Le propriétaire crée dans tous les restaurants ; un éditeur crée uniquement dans les restaurants où il est éditeur, et jamais un propriétaire.
- **Type d'intervention `alerte`** ajouté (Q4) : normal, urgence, alerte. L'effet exact d'une clôture sur la date d'entretien se précisera à l'étape Interventions.
- **Push** : envoyées aux propriétaires, éditeurs et commentateurs (pas aux lecteurs).

## Rôles et droits (À CONFIRMER)

Quatre rôles proposés : `proprietaire`, `editeur`, `commentateur`, `lecteur`.
Plusieurs éditeurs par restaurant, au choix du propriétaire (géré par `user_restaurants`).

| Action | proprietaire | editeur | commentateur (technicien) | lecteur |
|---|---|---|---|---|
| Consulter (restaurants accessibles) | oui | oui | oui | oui |
| Déclarer une panne | oui | oui | oui | oui |
| Créer / modifier équipement, pièce, catégorie, marque | oui | oui | non | non |
| Créer une intervention (« Ajouter une intervention ») | oui | oui | non | non |
| Modifier une intervention existante (travail fait, technicien, pièces) | oui | oui | oui | non |
| Clôturer une intervention | oui | oui | oui | non |
| Noter un entretien comme fait | oui | oui | oui | non |
| Supprimer | oui | non | non | non |
| Créer des comptes (mot de passe temporaire) | oui (tous restos) | oui (ses restos, pas propriétaire) | non | non |
| Administration restaurants | oui | non | non | non |
| Reçoit les notifications push | oui | oui | oui | non |

Lecture de la ligne « commentateur » : c'est le technicien. Il ne **crée** rien (sauf une déclaration de panne), mais il **complète et clôture** les interventions déjà ouvertes sur ses restaurants.

Confirmé : le rôle **lecteur** est gardé (4 rôles). Le **commentateur (technicien)** peut modifier et clôturer les interventions, **noter un entretien fait**, et déclarer une panne ou une urgence ; il ne crée rien d'autre (ni équipement, ni pièce, ni intervention hors déclaration de panne).

---

## Enums proposés
- `user_role` : proprietaire, editeur, commentateur, lecteur.
- `equipment_state` : operationnel, en_panne, en_maintenance, hors_service.
- `maintenance_frequency` : mensuel, trimestriel, semestriel, annuel.
- `intervention_type` : normal, urgence, alerte.
- `intervention_status` : en_cours, terminee.
- `intervention_kind` : correctif, preventif.
- `stock_movement_reason` : livraison, intervention, ajustement.
- `notification_type` : urgence, panne, entretien_prevu, entretien_retard, stock_bas, reparation.
- `event_type` : panne_declaree, entretien, reparation, modification.
- `unit` (pièce) : texte libre avec liste suggérée (piece, bouteille, metre, litre, kg), pour ne pas migrer un enum à chaque nouvelle unité.

## Tables

### Accès et comptes
- **restaurants** : `id`, `name`, `short_code` (unique, ex. CTR1), `address` (nullable), `created_at`.
- **users** (profil, `id` = `auth.users.id`) : `first_name`, `email` (copie pour l'affichage admin), `phone` (nullable), `role`, `all_restaurants` (bool), `must_change_password` (bool, défaut vrai), `created_by` (nullable, trace du créateur pour la délégation), `last_seen_at` (nullable), `created_at`.
  - Badge « Invitation envoyée » = `last_seen_at IS NULL`.
- **user_restaurants** : `user_id`, `restaurant_id`, clé primaire composée. Utilisé quand `all_restaurants = false`.

### Référentiels
- **categories** : `id`, `name`, `code` (unique, ex. FRG, FRT), `created_at`. Globales. Créées à la volée.
- **brands** : `id`, `name` (unique), `created_at`. Créées à la volée.

### Équipements et entretien
- **equipments** : `id`, `restaurant_id`, `code` (unique), `name`, `category_id` (nullable), `brand_id` (nullable), `model` (nullable), `serial_number` (nullable), `installed_at` (nullable), `state` (défaut operationnel), `notes` (nullable), `created_at`, `updated_at`.
  - Index : `restaurant_id`, `state`, unique sur `code`.
- **maintenance_plans** : `id`, `equipment_id` (unique, un plan par équipement pour commencer), `task`, `frequency`, `last_done_at` (nullable), `next_due_at` (nullable), `assigned_to` (nullable).
  - `next_due_at` = `last_done_at` + durée de la fréquence, recalculé à chaque entretien noté. Index sur `next_due_at`.
- **maintenance_logs** : `id`, `plan_id` (nullable), `equipment_id`, `done_at`, `done_by`, `notes` (nullable), `created_at`.

### Interventions
- **interventions** : `id`, `equipment_id` (nullable), `equipment_free_text` (nullable), `restaurant_id` (obligatoire, pour filtrage et RLS même sans équipement), `type` (normal/urgence/alerte), `status` (défaut en_cours), `kind` (nullable, correctif/preventif), `symptoms` (tableau de texte), `description` (nullable), `photo_url` (nullable, voir note), `reported_by`, `reported_at`, `assigned_to` (nullable), `work_done` (nullable), `state_after` (nullable), `closed_by` (nullable), `closed_at` (nullable).
  - Index : `restaurant_id`, `status`, `type`, `equipment_id`.
- **intervention_parts** : `intervention_id`, `part_id`, `quantity`. Pièces réellement utilisées à la clôture.

### Stock (global)
- **parts** : `id`, `code` (unique), `name`, `unit`, `quantity`, `min_threshold`, `notes` (nullable), `created_at`, `updated_at`. Pas de `restaurant_id` (stock partagé).
- **part_compatibilities** : `part_id`, `equipment_id`, clé composée. Les machines compatibles (« Va avec »).
- **stock_movements** : `id`, `part_id`, `delta` (+/-), `reason`, `intervention_id` (nullable), `user_id`, `created_at`. Index : `part_id`, `created_at`.
  - `parts.quantity` = somme des mouvements, tenue à jour dans la même transaction pour lire vite.

### Fiche de vie, notifications
- **equipment_events** : `id`, `equipment_id`, `type` (event_type), `ref_id` (nullable), `summary`, `user_id` (nullable), `created_at`. Table réelle, remplie dans les transactions métier.
- **notifications** : `id`, `user_id`, `type`, `title`, `body`, `link`, `read_at` (nullable), `created_at`. Index : `user_id`, `read_at`.
- **notification_settings** : `user_id`, `type`, `enabled`, clé composée.

---

## Logique métier (fonctions Postgres `SECURITY DEFINER`, search_path fixé)
- **declarer_panne** : crée l'intervention, passe l'équipement en `en_panne`, écrit l'événement, crée les notifications pour propriétaires, éditeurs et commentateurs du restaurant (immédiates si urgence). Autorisée à tous les rôles.
- **cloturer_intervention** : passe l'intervention en `terminee`, insère les `intervention_parts`, écrit un `stock_movements` négatif par pièce et met à jour `parts.quantity`, applique `state_after` à l'équipement, écrit l'événement, notifie le déclarant et crée une alerte stock si un seuil est franchi. Autorisée à proprietaire, editeur, commentateur.
- **noter_entretien_fait** : insère un `maintenance_logs`, met à jour `last_done_at` et recalcule `next_due_at`, écrit l'événement. Autorisée à proprietaire, editeur, commentateur.
- **creer_compte** : crée l'utilisateur avec mot de passe temporaire, `must_change_password = true`, `created_by`. Propriétaire partout, éditeur dans ses restaurants et jamais un propriétaire.
- **Cron quotidien** (protégé par `CRON_SECRET`, rejouable sans doublon) : notifications `entretien_retard` (plans dépassés) et `stock_bas`.

## Politiques d'accès (RLS)
- Fonction `restaurants_accessibles(uid)` (STABLE, SECURITY DEFINER) : tous les restaurants si `all_restaurants`, sinon ceux de `user_restaurants`.
- **Lecture** : une ligne est visible si son restaurant est accessible. Tables sans `restaurant_id` (maintenance_plans, maintenance_logs, intervention_parts, equipment_events) : restaurant résolu par jointure sur l'équipement ou l'intervention. `notifications` et `notification_settings` : `user_id = auth.uid()`.
- **Stock global** : `parts`, `part_compatibilities`, `stock_movements` lisibles par tout utilisateur connecté (pas de filtre restaurant). Écriture réservée à proprietaire et editeur (mouvements aussi créés par la clôture, donc par commentateur via la fonction `SECURITY DEFINER`).
- **Écriture** selon la matrice des droits ci-dessus. Suppression : proprietaire seulement.
- RLS activées sur toutes les tables.

## Données de départ
- Importer les 49 équipements de l'Excel (CTR1 : 25, CTR2 : 24 ; catégories Réfrigération, Cuisson, Climatisation, Vitrine, Ventilation, Boissons), codes existants (ex. CTR1-FRG-01). Il me faudra l'emplacement du fichier au moment de l'import.

## Notes et points mineurs
- **Photo de panne** : `photo_url` gardé en colonne nullable, l'écart la disait hors périmètre. Zéro coût de la garder ; on branchera l'upload seulement si tu le décides.
- **Techniciens = commentateurs**, donc des utilisateurs avec compte (pas de technicien externe sans compte).
- **« Va avec » prévu vs utilisé** : `part_compatibilities` = compatibilité, `intervention_parts` = utilisé. Déjà séparés dans les données.
- **Dashboard par restaurant et stock global** : la section « pièces sous le seuil » d'un restaurant montrera le stock global (une seule réserve). À confirmer à l'étape tableau de bord restaurant.
