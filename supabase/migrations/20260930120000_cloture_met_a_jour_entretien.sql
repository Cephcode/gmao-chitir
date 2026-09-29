-- Correctif de règle métier (validé le 2026-09-30) : clôturer une intervention met à jour
-- le dernier entretien de la machine, sauf pour le type alerte. La fonction est reprise
-- à l'identique de 20260929182000_functions.sql, avec en plus le bloc « entretien »
-- (plan recalé si la machine en a un, ligne dans maintenance_logs).
-- Même signature : le droit d'exécution accordé à authenticated est conservé.

create or replace function cloturer_intervention(
  p_intervention_id uuid,
  p_work_done text,
  p_state_after equipment_state,
  p_assigned_to uuid default null,
  p_parts jsonb default '[]'         -- [{"part_id": "...", "quantity": 2}, ...]
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
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
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de clôturer une intervention' using errcode = '42501';
  end if;

  select restaurant_id, equipment_id, reported_by, type
    into v_restaurant, v_equipment, v_reporter, v_type
  from interventions
  where id = p_intervention_id and status = 'en_cours'
  for update;

  if v_restaurant is null then
    raise exception 'Intervention introuvable ou déjà clôturée' using errcode = 'P0002';
  end if;
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
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
      select u.id, 'stock_bas', 'Stock bas : ' || v_name,
             'Il en reste ' || v_after, '/stock'
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
  if v_reporter is not null and v_reporter <> v_caller then
    insert into notifications (user_id, type, title, body, link)
    select v_reporter, 'reparation', 'Machine réparée', coalesce(p_work_done, ''),
           '/interventions/' || p_intervention_id
    where coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = v_reporter and ns.type = 'reparation'), true);
  end if;
end;
$$;
