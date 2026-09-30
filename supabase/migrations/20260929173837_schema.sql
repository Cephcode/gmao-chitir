-- Schéma de base de la GMAO Chitir Chicken.
-- Contenu : enums, tables, contraintes, index. Les RLS et les fonctions métier
-- sont dans des migrations séparées (appliquées après celle-ci).
-- Voir docs/modele-donnees-proposition.md pour les décisions.

-- ============================================================
-- Types énumérés
-- ============================================================
create type user_role as enum ('proprietaire', 'editeur', 'commentateur', 'lecteur');
create type equipment_state as enum ('operationnel', 'en_panne', 'en_maintenance', 'hors_service');
create type maintenance_frequency as enum ('mensuel', 'trimestriel', 'semestriel', 'annuel');
create type intervention_type as enum ('normal', 'urgence', 'alerte');
create type intervention_status as enum ('en_cours', 'terminee');
create type intervention_kind as enum ('correctif', 'preventif');
create type stock_movement_reason as enum ('livraison', 'intervention', 'ajustement');
create type notification_type as enum ('urgence', 'panne', 'entretien_prevu', 'entretien_retard', 'stock_bas', 'reparation');
create type equipment_event_type as enum ('panne_declaree', 'entretien', 'reparation', 'modification');

-- Met à jour la colonne updated_at à chaque modification de ligne.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Accès et comptes
-- ============================================================

-- Un restaurant de la chaîne. short_code sert de préfixe aux codes équipement (ex. CTR1).
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,
  address text,
  created_at timestamptz not null default now()
);

-- Profil applicatif rattaché au compte Supabase Auth (auth.users).
-- Le mot de passe n'est pas ici : il est géré par Supabase Auth.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  email text,                                   -- copie pour l'affichage admin
  phone text,
  role user_role not null default 'lecteur',
  all_restaurants boolean not null default false,
  must_change_password boolean not null default true,
  created_by uuid references users (id),        -- trace du créateur (délégation)
  last_seen_at timestamptz,                      -- null = invitation pas encore acceptée
  created_at timestamptz not null default now(),
  constraint users_contact_check check (email is not null or phone is not null)
);

-- Restaurants accessibles à un utilisateur (quand all_restaurants = false).
create table user_restaurants (
  user_id uuid not null references users (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  primary key (user_id, restaurant_id)
);

-- ============================================================
-- Référentiels (créés à la volée depuis les listes déroulantes)
-- ============================================================

-- Catégorie d'équipement. code sert au code machine (ex. FRG dans CTR1-FRG-01).
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Équipements et entretien
-- ============================================================

create table equipments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete restrict,
  code text not null unique,
  name text not null,
  category_id uuid references categories (id) on delete set null,
  brand_id uuid references brands (id) on delete set null,
  model text,
  serial_number text,
  installed_at date,
  state equipment_state not null default 'operationnel',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index equipments_restaurant_idx on equipments (restaurant_id);
create index equipments_state_idx on equipments (state);
create trigger trg_equipments_updated
  before update on equipments
  for each row execute function set_updated_at();

-- Un plan d'entretien par équipement. Le statut À jour / En retard est calculé
-- (next_due_at < aujourd'hui), il n'est pas stocké.
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null unique references equipments (id) on delete cascade,
  task text,
  frequency maintenance_frequency not null,
  last_done_at date,
  next_due_at date,
  assigned_to uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_plans_due_idx on maintenance_plans (next_due_at);
create trigger trg_maintenance_plans_updated
  before update on maintenance_plans
  for each row execute function set_updated_at();

-- Historique des entretiens faits (« Noter l'entretien comme fait »).
create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references maintenance_plans (id) on delete set null,
  equipment_id uuid not null references equipments (id) on delete cascade,
  done_at date not null,
  done_by uuid references users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index maintenance_logs_equipment_idx on maintenance_logs (equipment_id);

-- ============================================================
-- Interventions (pannes et réparations)
-- ============================================================

create table interventions (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipments (id) on delete cascade,
  equipment_free_text text,                     -- si « je ne trouve pas la machine »
  restaurant_id uuid not null references restaurants (id) on delete restrict,
  type intervention_type not null default 'normal',
  status intervention_status not null default 'en_cours',
  kind intervention_kind,
  symptoms text[] not null default '{}',
  description text,
  photo_url text,
  reported_by uuid references users (id) on delete set null,
  reported_at timestamptz not null default now(),
  assigned_to uuid references users (id) on delete set null,
  work_done text,
  state_after equipment_state,
  closed_by uuid references users (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint interventions_equipment_ref
    check (equipment_id is not null or equipment_free_text is not null)
);
create index interventions_restaurant_idx on interventions (restaurant_id);
create index interventions_status_idx on interventions (status);
create index interventions_type_idx on interventions (type);
create index interventions_equipment_idx on interventions (equipment_id);

-- ============================================================
-- Stock (global, partagé par toute la chaîne)
-- ============================================================

-- Le statut Suffisant / Sous le seuil est calculé (quantity < min_threshold).
create table parts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null default 'piece',           -- piece, bouteille, metre, litre, kg...
  quantity integer not null default 0,
  min_threshold integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parts_quantity_nonneg check (quantity >= 0),
  constraint parts_threshold_nonneg check (min_threshold >= 0)
);
create trigger trg_parts_updated
  before update on parts
  for each row execute function set_updated_at();

-- Machines compatibles avec une pièce (« Va avec »).
create table part_compatibilities (
  part_id uuid not null references parts (id) on delete cascade,
  equipment_id uuid not null references equipments (id) on delete cascade,
  primary key (part_id, equipment_id)
);

-- Pièces réellement utilisées à la clôture d'une intervention.
create table intervention_parts (
  intervention_id uuid not null references interventions (id) on delete cascade,
  part_id uuid not null references parts (id) on delete restrict,
  quantity integer not null,
  primary key (intervention_id, part_id),
  constraint intervention_parts_qty_pos check (quantity > 0)
);

-- Chaque variation de stock. parts.quantity = somme des delta (tenue à jour en transaction).
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts (id) on delete cascade,
  delta integer not null,
  reason stock_movement_reason not null,
  intervention_id uuid references interventions (id) on delete set null,
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_delta_nonzero check (delta <> 0)
);
create index stock_movements_part_idx on stock_movements (part_id);
create index stock_movements_created_idx on stock_movements (created_at);

-- ============================================================
-- Fiche de vie et notifications
-- ============================================================

-- Historique daté d'un équipement, écrit dans les transactions métier.
create table equipment_events (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipments (id) on delete cascade,
  type equipment_event_type not null,
  ref_id uuid,                                   -- intervention ou log concerné
  summary text not null,
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index equipment_events_equipment_idx on equipment_events (equipment_id, created_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at);

-- Réglage des alertes par utilisateur et par type (interrupteurs de « Mes alertes »).
create table notification_settings (
  user_id uuid not null references users (id) on delete cascade,
  type notification_type not null,
  enabled boolean not null default true,
  primary key (user_id, type)
);
