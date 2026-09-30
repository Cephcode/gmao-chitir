-- Recette, anomalie H1 : la politique interventions_update laissait modifier toutes les
-- colonnes d'une intervention ouverte (machine, restaurant, type, déclarant...). Un
-- commentateur pouvait rattacher son intervention à la machine d'un autre restaurant,
-- puis la clôturer et modifier cette machine.
--
-- Correction :
-- 1. En direct, seules les colonnes réellement modifiées par l'application restent
--    modifiables : work_done (travail fait) et assigned_to (technicien), via
--    « Enregistrer sans clôturer ». Tout le reste passe par les fonctions
--    (declarer_panne, cloturer_intervention), qui ne sont pas concernées par ces droits.
-- 2. Le technicien choisi est vérifié en base : rôle propriétaire, éditeur ou
--    commentateur, avec accès au restaurant de l'intervention (même règle que la page).

-- Cet utilisateur peut-il intervenir sur ce restaurant ?
-- SECURITY DEFINER : lit users et user_restaurants sans repasser par les RLS.
create function peut_intervenir(p_user uuid, p_restaurant uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from users u
    where u.id = p_user
      and u.role in ('proprietaire', 'editeur', 'commentateur')
      and (u.all_restaurants
           or exists (select 1 from user_restaurants ur
                      where ur.user_id = u.id and ur.restaurant_id = p_restaurant)));
$$;

revoke execute on function peut_intervenir(uuid, uuid) from public, anon;
grant execute on function peut_intervenir(uuid, uuid) to authenticated;

-- Droits par colonne : plus de mise à jour libre de la table.
revoke update on interventions from authenticated;
grant update (work_done, assigned_to) on interventions to authenticated;

-- Le technicien assigné doit pouvoir intervenir sur le restaurant de l'intervention.
alter policy interventions_update on interventions
  with check (auth_role() in ('proprietaire', 'editeur', 'commentateur')
              and has_restaurant(restaurant_id) and status = 'en_cours'
              and (assigned_to is null or peut_intervenir(assigned_to, restaurant_id)));
