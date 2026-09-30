-- Sécurité au niveau des lignes (RLS) et politiques d'accès.
-- Principe : le restaurant décide QUELLES données on voit, le rôle décide QUELLES
-- actions on peut faire. Les mutations multi-tables (déclarer, clôturer, entretien,
-- stock, comptes) passeront par des fonctions SECURITY DEFINER (migration suivante) :
-- ces tables n'ont donc pas de politique d'écriture directe ici.
-- Voir docs/modele-donnees-proposition.md (matrice des droits).

-- ============================================================
-- Fonctions d'aide (SECURITY DEFINER : lisent users/user_restaurants
-- sans repasser par les RLS, ce qui évite toute récursion)
-- ============================================================

-- Rôle de l'utilisateur connecté.
create function auth_role()
returns user_role
language sql stable security definer set search_path = public, pg_temp
as $$ select role from users where id = auth.uid(); $$;

-- L'utilisateur connecté a-t-il accès à ce restaurant ?
create function has_restaurant(rid uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.all_restaurants)
      or exists (select 1 from user_restaurants ur
                 where ur.user_id = auth.uid() and ur.restaurant_id = rid);
$$;

-- Partage-t-il au moins un restaurant avec l'utilisateur cible ? (visibilité des profils)
create function shares_restaurant(target uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.all_restaurants)
      or exists (
        select 1 from user_restaurants me
        join user_restaurants them on me.restaurant_id = them.restaurant_id
        where me.user_id = auth.uid() and them.user_id = target);
$$;

-- Restaurant d'un équipement (pour les tables reliées via l'équipement).
create function equipment_restaurant(eid uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select restaurant_id from equipments where id = eid; $$;

-- Restaurant d'une intervention (pour intervention_parts).
create function intervention_restaurant(iid uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select restaurant_id from interventions where id = iid; $$;

grant execute on function auth_role(), has_restaurant(uuid), shares_restaurant(uuid),
  equipment_restaurant(uuid), intervention_restaurant(uuid) to authenticated;

-- ============================================================
-- Droits de base : l'app n'est utilisée que connectée.
-- anon ne reçoit rien ; authenticated reçoit les droits, mais les RLS
-- (activées ci-dessous) filtrent chaque ligne et chaque action.
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Active les RLS partout (refus par défaut tant qu'aucune politique ne l'autorise).
alter table restaurants            enable row level security;
alter table users                  enable row level security;
alter table user_restaurants       enable row level security;
alter table categories             enable row level security;
alter table brands                 enable row level security;
alter table equipments             enable row level security;
alter table maintenance_plans      enable row level security;
alter table maintenance_logs       enable row level security;
alter table interventions          enable row level security;
alter table parts                  enable row level security;
alter table part_compatibilities   enable row level security;
alter table intervention_parts     enable row level security;
alter table stock_movements        enable row level security;
alter table equipment_events       enable row level security;
alter table notifications          enable row level security;
alter table notification_settings  enable row level security;

-- ============================================================
-- restaurants : visibles selon l'accès ; administration au propriétaire
-- ============================================================
create policy restaurants_select on restaurants for select to authenticated
  using (has_restaurant(id));
create policy restaurants_insert on restaurants for insert to authenticated
  with check (auth_role() = 'proprietaire');
create policy restaurants_update on restaurants for update to authenticated
  using (auth_role() = 'proprietaire' and has_restaurant(id))
  with check (auth_role() = 'proprietaire');
create policy restaurants_delete on restaurants for delete to authenticated
  using (auth_role() = 'proprietaire' and has_restaurant(id));

-- ============================================================
-- users et user_restaurants : lecture des profils partagés ; écriture par
-- les fonctions de gestion de comptes uniquement (aucune politique d'écriture)
-- ============================================================
create policy users_select on users for select to authenticated
  using (id = auth.uid() or shares_restaurant(id));

create policy user_restaurants_select on user_restaurants for select to authenticated
  using (user_id = auth.uid() or shares_restaurant(user_id));

-- ============================================================
-- categories, brands : référentiels globaux, créés à la volée
-- ============================================================
create policy categories_select on categories for select to authenticated using (true);
create policy categories_insert on categories for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy categories_update on categories for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'));
create policy categories_delete on categories for delete to authenticated
  using (auth_role() = 'proprietaire');

create policy brands_select on brands for select to authenticated using (true);
create policy brands_insert on brands for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy brands_update on brands for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'));
create policy brands_delete on brands for delete to authenticated
  using (auth_role() = 'proprietaire');

-- ============================================================
-- equipments : lecture selon le restaurant ; création/modif éditeur+, suppr propriétaire
-- ============================================================
create policy equipments_select on equipments for select to authenticated
  using (has_restaurant(restaurant_id));
create policy equipments_insert on equipments for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur') and has_restaurant(restaurant_id));
create policy equipments_update on equipments for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur') and has_restaurant(restaurant_id))
  with check (auth_role() in ('proprietaire', 'editeur') and has_restaurant(restaurant_id));
create policy equipments_delete on equipments for delete to authenticated
  using (auth_role() = 'proprietaire' and has_restaurant(restaurant_id));

-- ============================================================
-- maintenance_plans : lecture selon le restaurant de l'équipement.
-- Le task/frequence/assigné se règlent en direct (éditeur+). Les dates last_done_at
-- et next_due_at sont recalculées par la fonction noter_entretien_fait.
-- ============================================================
create policy maintenance_plans_select on maintenance_plans for select to authenticated
  using (has_restaurant(equipment_restaurant(equipment_id)));
create policy maintenance_plans_insert on maintenance_plans for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur')
              and has_restaurant(equipment_restaurant(equipment_id)));
create policy maintenance_plans_update on maintenance_plans for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur')
         and has_restaurant(equipment_restaurant(equipment_id)))
  with check (auth_role() in ('proprietaire', 'editeur')
              and has_restaurant(equipment_restaurant(equipment_id)));
create policy maintenance_plans_delete on maintenance_plans for delete to authenticated
  using (auth_role() = 'proprietaire'
         and has_restaurant(equipment_restaurant(equipment_id)));

-- ============================================================
-- maintenance_logs : lecture seule ici (écriture via noter_entretien_fait)
-- ============================================================
create policy maintenance_logs_select on maintenance_logs for select to authenticated
  using (has_restaurant(equipment_restaurant(equipment_id)));

-- ============================================================
-- interventions : lecture selon le restaurant.
-- Création (déclarer une panne, ajouter une intervention) et clôture : via fonctions.
-- ============================================================
create policy interventions_select on interventions for select to authenticated
  using (has_restaurant(restaurant_id));
-- Modifier une intervention encore ouverte (travail fait, technicien, description) :
-- éditeur, commentateur (technicien), propriétaire, sur leur restaurant. La clôture
-- (passage à terminee) reste interdite en direct : with check impose status = en_cours,
-- elle se fait par la fonction cloturer_intervention (SECURITY DEFINER).
create policy interventions_update on interventions for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur', 'commentateur')
         and has_restaurant(restaurant_id) and status = 'en_cours')
  with check (auth_role() in ('proprietaire', 'editeur', 'commentateur')
              and has_restaurant(restaurant_id) and status = 'en_cours');

-- intervention_parts : lecture selon le restaurant de l'intervention (écriture via clôture)
create policy intervention_parts_select on intervention_parts for select to authenticated
  using (has_restaurant(intervention_restaurant(intervention_id)));

-- ============================================================
-- Stock : global et partagé, visible par tout utilisateur connecté.
-- Édition des fiches pièces (nom, seuil) en direct éditeur+ ; les quantités
-- ne bougent que par des mouvements (fonctions), pour rester cohérentes.
-- ============================================================
create policy parts_select on parts for select to authenticated using (true);
create policy parts_insert on parts for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy parts_update on parts for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'));
create policy parts_delete on parts for delete to authenticated
  using (auth_role() = 'proprietaire');

create policy part_compat_select on part_compatibilities for select to authenticated
  using (true);
create policy part_compat_insert on part_compatibilities for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur')
              and has_restaurant(equipment_restaurant(equipment_id)));
create policy part_compat_delete on part_compatibilities for delete to authenticated
  using (auth_role() in ('proprietaire', 'editeur')
         and has_restaurant(equipment_restaurant(equipment_id)));

-- stock_movements : lecture globale (écriture via fonctions de stock)
create policy stock_movements_select on stock_movements for select to authenticated
  using (true);

-- ============================================================
-- equipment_events (fiche de vie) : lecture selon le restaurant (écriture via fonctions)
-- ============================================================
create policy equipment_events_select on equipment_events for select to authenticated
  using (has_restaurant(equipment_restaurant(equipment_id)));

-- ============================================================
-- notifications : chacun ne voit et ne marque comme lues que les siennes
-- ============================================================
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notification_settings : chacun règle ses propres alertes
create policy notif_settings_select on notification_settings for select to authenticated
  using (user_id = auth.uid());
create policy notif_settings_insert on notification_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy notif_settings_update on notification_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_settings_delete on notification_settings for delete to authenticated
  using (user_id = auth.uid());
