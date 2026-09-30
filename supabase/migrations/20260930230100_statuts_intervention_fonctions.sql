-- Phase 3 : statuts d'intervention (fonctions et politiques).
--
-- « Ouverte » veut dire désormais : tout statut sauf « terminee ».
-- 1. declarer_panne reçoit le statut de départ (p_status). Propriétaire, éditeur et
--    commentateur le choisissent (tout sauf « terminee ») ; pour un lecteur, il est
--    forcé à « a_planifier » quel que soit le paramètre.
-- 2. changer_statut_intervention : change le statut d'une intervention ouverte, sauf
--    vers « terminee » (réservé à cloturer_intervention). Ajoute une ligne à la fiche
--    de vie de la machine et prévient le déclarant.
-- 3. cloturer_intervention et la politique interventions_update acceptent toute
--    intervention ouverte. Le statut reste non modifiable en direct (droits par
--    colonne inchangés : work_done et assigned_to seulement).
-- L'état de la machine ne change pas avec le statut : elle reste en panne tant que
-- l'intervention est ouverte.

alter table interventions alter column status set default 'a_planifier';

-- 1. declarer_panne : nouvelle signature, l'ancienne est supprimée (pas de surcharge).
drop function if exists declarer_panne(uuid, intervention_type, text[], text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.declarer_panne(p_equipment_id uuid, p_type intervention_type DEFAULT 'normal'::intervention_type, p_symptoms text[] DEFAULT '{}'::text[], p_description text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_restaurant_id uuid DEFAULT NULL::uuid, p_equipment_free_text text DEFAULT NULL::text, p_status intervention_status DEFAULT 'a_planifier'::intervention_status)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_restaurant uuid;
  v_intervention uuid;
  v_notif notification_type;
  v_label text;
  v_machine text;
  v_short text;
  v_reporter_name text;
  v_role user_role := auth_role();
  v_status intervention_status;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  -- Restaurant : via l'équipement, sinon celui passé (machine non trouvée).
  if p_equipment_id is not null then
    select restaurant_id into v_restaurant from equipments where id = p_equipment_id;
    if v_restaurant is null then
      raise exception 'Équipement introuvable' using errcode = 'P0002';
    end if;
  else
    v_restaurant := p_restaurant_id;
    if v_restaurant is null then
      raise exception 'Restaurant requis quand la machine n''est pas identifiée' using errcode = '22004';
    end if;
    if p_equipment_free_text is null then
      raise exception 'Décrivez la machine (texte libre) si elle n''est pas dans la liste' using errcode = '22004';
    end if;
  end if;

  -- Tous les rôles peuvent déclarer, mais seulement sur un restaurant accessible.
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;

  if p_type not in ('normal', 'urgence') then
    raise exception 'Une déclaration de panne est normale ou urgente' using errcode = '22023';
  end if;

  -- Statut de départ : choisi par propriétaire, éditeur et commentateur (sauf
  -- « terminee », réservé à la clôture) ; forcé à « a_planifier » pour les autres.
  if v_role is null or v_role not in ('proprietaire', 'editeur', 'commentateur') then
    v_status := 'a_planifier';
  else
    v_status := coalesce(p_status, 'a_planifier');
    if v_status = 'terminee' then
      raise exception 'Une panne ne peut pas être déclarée déjà terminée' using errcode = '22023';
    end if;
  end if;

  insert into interventions (equipment_id, equipment_free_text, restaurant_id, type,
                             status, kind, symptoms, description, photo_url, reported_by, reported_at)
  values (p_equipment_id, p_equipment_free_text, v_restaurant, p_type,
          v_status, 'correctif', coalesce(p_symptoms, '{}'), p_description, p_photo_url, v_caller, now())
  returning id into v_intervention;

  -- La machine passe en panne et l'événement est ajouté à sa fiche de vie.
  if p_equipment_id is not null then
    update equipments set state = 'en_panne' where id = p_equipment_id;
    insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
    values (p_equipment_id, 'panne_declaree', v_intervention,
            case when p_type = 'urgence' then 'Urgence déclarée' else 'Panne déclarée' end, v_caller);
  end if;

  -- Notifications à l'équipe du restaurant (propriétaires, éditeurs, commentateurs),
  -- sauf le déclarant, selon leurs réglages d'alerte.
  v_notif := case when p_type = 'urgence' then 'urgence' else 'panne' end;
  v_label := case when p_type = 'urgence' then 'Urgence' else 'Panne' end;
  select coalesce((select name from equipments where id = p_equipment_id), p_equipment_free_text, 'Machine')
    into v_machine;
  select short_code into v_short from restaurants where id = v_restaurant;
  select first_name into v_reporter_name from users where id = v_caller;
  insert into notifications (user_id, type, title, body, link)
  select u.id, v_notif, v_label || ' : ' || v_machine || ', ' || v_short,
         'Déclarée' || coalesce(' par ' || v_reporter_name, '') || ' · '
           || coalesce(nullif(p_description, ''), nullif(array_to_string(p_symptoms, ', '), ''), 'à traiter'),
         '/interventions/' || v_intervention
  from users u
  where u.role in ('proprietaire', 'editeur', 'commentateur')
    and u.id <> v_caller
    and (u.all_restaurants
         or exists (select 1 from user_restaurants ur
                    where ur.user_id = u.id and ur.restaurant_id = v_restaurant))
    and coalesce((select ns.enabled from notification_settings ns
                  where ns.user_id = u.id and ns.type = v_notif), true);

  return v_intervention;
end;
$function$

;

revoke execute on function declarer_panne(uuid, intervention_type, text[], text, text, uuid, text, intervention_status) from public, anon;
grant execute on function declarer_panne(uuid, intervention_type, text[], text, text, uuid, text, intervention_status) to authenticated;

-- 3. cloturer_intervention : toute intervention ouverte peut être clôturée.
CREATE OR REPLACE FUNCTION public.cloturer_intervention(p_intervention_id uuid, p_work_done text, p_state_after equipment_state, p_assigned_to uuid DEFAULT NULL::uuid, p_parts jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_restaurant uuid;
  v_equipment uuid;
  v_reporter uuid;
  v_item jsonb;
  v_part uuid;
  v_qty integer;
  v_before integer;
  v_after integer;
  v_name text;
  v_type intervention_type;
  v_plan uuid;
  v_freq maintenance_frequency;
  v_machine text;
  v_short text;
  v_closer_name text;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de clôturer une intervention' using errcode = '42501';
  end if;

  select restaurant_id, equipment_id, reported_by, type
    into v_restaurant, v_equipment, v_reporter, v_type
  from interventions
  where id = p_intervention_id and status <> 'terminee'
  for update;

  if v_restaurant is null then
    raise exception 'Intervention introuvable ou déjà clôturée' using errcode = 'P0002';
  end if;
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;
  -- Recette M2 : l'intervenant choisi doit pouvoir intervenir sur ce restaurant.
  if p_assigned_to is not null and not peut_intervenir(p_assigned_to, v_restaurant) then
    raise exception 'Ce technicien n''a pas accès à ce restaurant' using errcode = '42501';
  end if;

  update interventions
    set status = 'terminee', closed_at = now(), closed_by = v_caller,
        work_done = p_work_done, state_after = p_state_after,
        assigned_to = coalesce(p_assigned_to, assigned_to)
  where id = p_intervention_id;

  -- Pièces utilisées : ligne de consommation, mouvement de stock, décrément.
  for v_item in select * from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb)) loop
    v_part := (v_item->>'part_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantité de pièce invalide' using errcode = '22023';
    end if;

    select quantity, name into v_before, v_name from parts where id = v_part for update;
    if v_before is null then
      raise exception 'Pièce introuvable' using errcode = 'P0002';
    end if;
    if v_before < v_qty then
      raise exception 'Stock insuffisant pour %, il en reste %', v_name, v_before using errcode = '23514';
    end if;
    v_after := v_before - v_qty;

    insert into intervention_parts (intervention_id, part_id, quantity)
    values (p_intervention_id, v_part, v_qty);
    insert into stock_movements (part_id, delta, reason, intervention_id, user_id)
    values (v_part, -v_qty, 'intervention', p_intervention_id, v_caller);
    update parts set quantity = v_after where id = v_part;

    -- Alerte stock bas seulement au moment où le seuil est franchi.
    if v_after < (select min_threshold from parts where id = v_part)
       and v_before >= (select min_threshold from parts where id = v_part) then
      insert into notifications (user_id, type, title, body, link)
      select u.id, 'stock_bas', v_name || ' sous le seuil',
             'Il reste ' || v_after || ', seuil ' || (select min_threshold from parts where id = v_part),
             '/stock/' || v_part
      from users u
      where u.role in ('proprietaire', 'editeur')
        and coalesce((select ns.enabled from notification_settings ns
                      where ns.user_id = u.id and ns.type = 'stock_bas'), true);
    end if;
  end loop;

  -- État de la machine après réparation + fiche de vie.
  if v_equipment is not null then
    update equipments set state = p_state_after where id = v_equipment;
    insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
    values (v_equipment, 'reparation', p_intervention_id, coalesce(p_work_done, 'Intervention clôturée'), v_caller);
  end if;

  -- Règle métier : une intervention clôturée compte comme entretien (sauf alerte).
  -- Dernier entretien = jour de clôture, prochaine échéance recalculée, journal d'entretien.
  if v_equipment is not null and v_type <> 'alerte' then
    select id, frequency into v_plan, v_freq
    from maintenance_plans where equipment_id = v_equipment;
    if v_plan is not null then
      update maintenance_plans
        set last_done_at = current_date, next_due_at = next_due_date(v_freq, current_date)
      where id = v_plan;
    end if;
    insert into maintenance_logs (plan_id, equipment_id, done_at, done_by, notes)
    values (v_plan, v_equipment, current_date, coalesce(p_assigned_to, v_caller), p_work_done);
  end if;

  -- Le déclarant est prévenu que sa machine est réparée.
  select coalesce(e.name, i.equipment_free_text, 'Machine'), r.short_code
    into v_machine, v_short
  from interventions i
  join restaurants r on r.id = i.restaurant_id
  left join equipments e on e.id = i.equipment_id
  where i.id = p_intervention_id;
  select first_name into v_closer_name from users where id = coalesce(p_assigned_to, v_caller);
  if v_reporter is not null and v_reporter <> v_caller then
    insert into notifications (user_id, type, title, body, link)
    select v_reporter, 'reparation', v_machine || ' réparée, ' || v_short,
           'Clôturée' || coalesce(' par ' || v_closer_name, '') || coalesce(' · ' || nullif(p_work_done, ''), ''),
           '/interventions/' || p_intervention_id
    where coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = v_reporter and ns.type = 'reparation'), true);
  end if;
end;
$function$

;

-- 3 bis. Politique interventions_update : « ouverte » = tout statut sauf « terminee ».
-- Les droits par colonne (work_done, assigned_to) ne changent pas : le statut ne se
-- modifie que par les fonctions.
alter policy interventions_update on interventions
  using (auth_role() in ('proprietaire', 'editeur', 'commentateur')
         and has_restaurant(restaurant_id) and status <> 'terminee')
  with check (auth_role() in ('proprietaire', 'editeur', 'commentateur')
              and has_restaurant(restaurant_id) and status <> 'terminee'
              and (assigned_to is null or peut_intervenir(assigned_to, restaurant_id)));

-- 2. changer_statut_intervention.
create or replace function changer_statut_intervention(p_intervention uuid, p_statut intervention_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_restaurant uuid;
  v_equipment uuid;
  v_reporter uuid;
  v_old intervention_status;
  v_old_label text;
  v_new_label text;
  v_machine text;
  v_short text;
  v_caller_name text;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de changer le statut d''une intervention' using errcode = '42501';
  end if;
  if p_statut is null then
    raise exception 'Choisissez un statut' using errcode = '22004';
  end if;
  if p_statut = 'terminee' then
    raise exception 'Pour terminer une intervention, utilisez la clôture' using errcode = '22023';
  end if;

  select restaurant_id, equipment_id, reported_by, status
    into v_restaurant, v_equipment, v_reporter, v_old
  from interventions
  where id = p_intervention
  for update;

  if v_restaurant is null then
    raise exception 'Intervention introuvable' using errcode = 'P0002';
  end if;
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;
  if v_old = 'terminee' then
    raise exception 'Intervention déjà clôturée' using errcode = '22023';
  end if;
  if v_old = p_statut then
    return;
  end if;

  update interventions set status = p_statut where id = p_intervention;

  v_old_label := case v_old when 'a_planifier' then 'À planifier' when 'en_cours' then 'En cours'
                            when 'en_attente_piece' then 'En attente de pièce' else 'Terminée' end;
  v_new_label := case p_statut when 'a_planifier' then 'À planifier' when 'en_cours' then 'En cours'
                               when 'en_attente_piece' then 'En attente de pièce' else 'Terminée' end;

  -- Fiche de vie de la machine.
  if v_equipment is not null then
    insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
    values (v_equipment, 'modification', p_intervention,
            'Statut : ' || v_old_label || ' → ' || v_new_label, v_caller);
  end if;

  -- Le déclarant est prévenu (sauf s'il change lui-même le statut), selon ses réglages.
  if v_reporter is not null and v_reporter <> v_caller then
    select coalesce(e.name, i.equipment_free_text, 'Machine'), r.short_code
      into v_machine, v_short
    from interventions i
    join restaurants r on r.id = i.restaurant_id
    left join equipments e on e.id = i.equipment_id
    where i.id = p_intervention;
    select first_name into v_caller_name from users where id = v_caller;
    insert into notifications (user_id, type, title, body, link)
    select v_reporter, 'statut_intervention', v_new_label || ' : ' || v_machine || ', ' || v_short,
           coalesce('Par ' || v_caller_name || ' · ', '') || 'Avant : ' || v_old_label,
           '/interventions/' || p_intervention
    where coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = v_reporter and ns.type = 'statut_intervention'), true);
  end if;
end;
$$;

revoke execute on function changer_statut_intervention(uuid, intervention_status) from public, anon;
grant execute on function changer_statut_intervention(uuid, intervention_status) to authenticated;
