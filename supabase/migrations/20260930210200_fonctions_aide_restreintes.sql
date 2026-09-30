-- Recette sécurité, point S-B1 : fonctions d'aide moins bavardes.
--
-- 1. peut_intervenir ne répond plus que pour un restaurant auquel l'appelant a accès
--    (has_restaurant). Ses deux appelants (politique interventions_update et
--    cloturer_intervention) exigent déjà cet accès : rien ne change pour eux.
--    Reprise à l'identique de 20260930200000, avec une seule ligne ajoutée.
-- 2. Les fonctions exécutables par anon (clé publique sans connexion) ne le sont plus.
--    Elles restent exécutables par authenticated : les politiques RLS les utilisent.
--    code_categorie_libre, taches_quotidiennes, envoyer_notification_trigger et
--    peut_intervenir étaient déjà fermées à anon. Les fonctions de calcul pures
--    (next_due_date, date_courte_fr) et le trigger set_updated_at ne lisent aucune
--    donnée : laissés tels quels.

create or replace function peut_intervenir(p_user uuid, p_restaurant uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select has_restaurant(p_restaurant) and exists (
    select 1 from users u
    where u.id = p_user
      and u.role in ('proprietaire', 'editeur', 'commentateur')
      and (u.all_restaurants
           or exists (select 1 from user_restaurants ur
                      where ur.user_id = u.id and ur.restaurant_id = p_restaurant)));
$$;

revoke execute on function
  auth_role(),
  has_restaurant(uuid),
  shares_restaurant(uuid),
  equipment_restaurant(uuid),
  intervention_restaurant(uuid),
  prochain_code_equipement(uuid, uuid),
  declarer_panne(uuid, intervention_type, text[], text, text, uuid, text),
  cloturer_intervention(uuid, text, equipment_state, uuid, jsonb),
  noter_entretien_fait(uuid, date, text),
  mouvement_stock(uuid, integer, stock_movement_reason),
  enregistrer_equipement(uuid, uuid, text, text, equipment_state, uuid, text, uuid, text, text, text, date, maintenance_frequency, text),
  ajouter_restaurant(text, text, text, uuid)
from public, anon;

-- Déjà accordé, réaffirmé pour que la liste se lise en un seul endroit.
grant execute on function
  auth_role(),
  has_restaurant(uuid),
  shares_restaurant(uuid),
  equipment_restaurant(uuid),
  intervention_restaurant(uuid),
  prochain_code_equipement(uuid, uuid),
  declarer_panne(uuid, intervention_type, text[], text, text, uuid, text),
  cloturer_intervention(uuid, text, equipment_state, uuid, jsonb),
  noter_entretien_fait(uuid, date, text),
  mouvement_stock(uuid, integer, stock_movement_reason),
  enregistrer_equipement(uuid, uuid, text, text, equipment_state, uuid, text, uuid, text, text, text, date, maintenance_frequency, text),
  ajouter_restaurant(text, text, text, uuid)
to authenticated;
