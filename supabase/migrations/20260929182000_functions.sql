-- Fonctions métier (RPC). Toutes en SECURITY DEFINER avec search_path fixé :
-- elles court-circuitent les RLS, donc elles vérifient elles-mêmes le rôle et
-- l'accès au restaurant, et lèvent une erreur 42501 (insufficient_privilege) sinon.
-- Elles garantissent l'atomicité des écritures multi-tables.
-- La création de comptes (mot de passe temporaire) se fait côté application
-- (service role + API admin Supabase), pas ici.

-- Prochaine échéance d'entretien à partir d'une date et d'une fréquence.
create function next_due_date(freq maintenance_frequency, from_date date)
returns date
language sql immutable
as $$
  select (from_date + case freq
    when 'mensuel'     then interval '1 month'
    when 'trimestriel' then interval '3 months'
    when 'semestriel'  then interval '6 months'
    when 'annuel'      then interval '1 year'
  end)::date;
$$;

-- ============================================================
-- declarer_panne : ouvre une intervention, met la machine en panne,
-- écrit la fiche de vie, notifie l'équipe du restaurant. Tous les rôles.
-- ============================================================
create function declarer_panne(
  p_equipment_id uuid,
  p_type intervention_type default 'normal',
  p_symptoms text[] default '{}',
  p_description text default null,
  p_photo_url text default null,
  p_restaurant_id uuid default null,       -- requis seulement si pas d'équipement
  p_equipment_free_text text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_restaurant uuid;
  v_intervention uuid;
  v_notif notification_type;
  v_label text;
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

  insert into interventions (equipment_id, equipment_free_text, restaurant_id, type,
                             status, kind, symptoms, description, photo_url, reported_by, reported_at)
  values (p_equipment_id, p_equipment_free_text, v_restaurant, p_type,
          'en_cours', 'correctif', coalesce(p_symptoms, '{}'), p_description, p_photo_url, v_caller, now())
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
  insert into notifications (user_id, type, title, body, link)
  select u.id, v_notif, v_label || ' déclarée',
         coalesce(p_description, 'Nouvelle intervention à traiter'),
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
$$;

-- ============================================================
-- cloturer_intervention : termine l'intervention, consomme le stock,
-- met à jour l'état de la machine, notifie le déclarant, alerte le stock bas.
-- Propriétaire, éditeur, commentateur.
-- ============================================================
create function cloturer_intervention(
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
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de clôturer une intervention' using errcode = '42501';
  end if;

  select restaurant_id, equipment_id, reported_by
    into v_restaurant, v_equipment, v_reporter
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

-- ============================================================
-- noter_entretien_fait : enregistre un entretien, recale la prochaine échéance.
-- Propriétaire, éditeur, commentateur.
-- ============================================================
create function noter_entretien_fait(
  p_equipment_id uuid,
  p_done_at date default current_date,
  p_notes text default null
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_restaurant uuid;
  v_plan uuid;
  v_freq maintenance_frequency;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de noter un entretien' using errcode = '42501';
  end if;

  select restaurant_id into v_restaurant from equipments where id = p_equipment_id;
  if v_restaurant is null then
    raise exception 'Équipement introuvable' using errcode = 'P0002';
  end if;
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;

  select id, frequency into v_plan, v_freq
  from maintenance_plans where equipment_id = p_equipment_id;

  -- Si un plan existe, on recale dernier et prochain entretien.
  if v_plan is not null then
    update maintenance_plans
      set last_done_at = p_done_at, next_due_at = next_due_date(v_freq, p_done_at)
    where id = v_plan;
  end if;

  insert into maintenance_logs (plan_id, equipment_id, done_at, done_by, notes)
  values (v_plan, p_equipment_id, p_done_at, v_caller, p_notes);

  insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
  values (p_equipment_id, 'entretien', v_plan, 'Entretien effectué', v_caller);
end;
$$;

-- ============================================================
-- mouvement_stock : ajustement manuel du stock (+/-) ou livraison.
-- Propriétaire, éditeur. Le décrément par intervention passe par cloturer_intervention.
-- ============================================================
create function mouvement_stock(
  p_part_id uuid,
  p_delta integer,
  p_reason stock_movement_reason default 'ajustement'
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_before integer;
  v_after integer;
  v_name text;
  v_threshold integer;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role not in ('proprietaire', 'editeur') then
    raise exception 'Votre rôle ne permet pas de modifier le stock' using errcode = '42501';
  end if;
  if p_delta = 0 then
    raise exception 'Le mouvement ne peut pas être nul' using errcode = '22023';
  end if;

  select quantity, name, min_threshold into v_before, v_name, v_threshold
  from parts where id = p_part_id for update;
  if v_before is null then
    raise exception 'Pièce introuvable' using errcode = 'P0002';
  end if;
  v_after := v_before + p_delta;
  if v_after < 0 then
    raise exception 'Le stock ne peut pas être négatif (reste %, retrait %)', v_before, -p_delta using errcode = '23514';
  end if;

  insert into stock_movements (part_id, delta, reason, user_id)
  values (p_part_id, p_delta, p_reason, v_caller);
  update parts set quantity = v_after where id = p_part_id;

  -- Alerte au franchissement du seuil vers le bas.
  if v_after < v_threshold and v_before >= v_threshold then
    insert into notifications (user_id, type, title, body, link)
    select u.id, 'stock_bas', 'Stock bas : ' || v_name, 'Il en reste ' || v_after, '/stock'
    from users u
    where u.role in ('proprietaire', 'editeur')
      and coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = u.id and ns.type = 'stock_bas'), true);
  end if;
end;
$$;

grant execute on function
  next_due_date(maintenance_frequency, date),
  declarer_panne(uuid, intervention_type, text[], text, text, uuid, text),
  cloturer_intervention(uuid, text, equipment_state, uuid, jsonb),
  noter_entretien_fait(uuid, date, text),
  mouvement_stock(uuid, integer, stock_movement_reason)
to authenticated;
