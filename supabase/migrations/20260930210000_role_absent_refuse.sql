-- Recette sécurité, point S-M1 : un compte sans profil (auth_role() NULL) doit être refusé.
--
-- En SQL, « NULL not in (...) » et « NULL <> '...' » valent NULL, pas vrai : le
-- « raise » ne partait pas et le contrôle de rôle était franchi. Seules des clés
-- étrangères ou has_restaurant arrêtaient ensuite l'appel, par accident.
--
-- Correction : les 5 fonctions sont reprises à l'identique de leur dernière version,
-- seule la ligne de contrôle du rôle change :
--   « v_role is null or v_role not in (...) » et « auth_role() is distinct from '...' ».
-- (« coalesce(v_role, '') » n'est pas possible : '' n'est pas une valeur du type user_role.)
-- Les droits d'exécution (grant) ne changent pas : create or replace les conserve.
--
-- Dernières versions reprises :
--   mouvement_stock        20260930170000_notifications_titres_et_taches.sql
--   ajouter_restaurant     20260930150000_ajouter_restaurant.sql
--   cloturer_intervention  20260930200200_cloture_verifie_intervenant.sql
--   enregistrer_equipement 20260930090000_enregistrer_equipement.sql
--   noter_entretien_fait   20260929182000_functions.sql

create or replace function mouvement_stock(
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
  if v_role is null or v_role not in ('proprietaire', 'editeur') then
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
    select u.id, 'stock_bas', v_name || ' sous le seuil',
           'Il reste ' || v_after || ', seuil ' || v_threshold, '/stock/' || p_part_id
    from users u
    where u.role in ('proprietaire', 'editeur')
      and coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = u.id and ns.type = 'stock_bas'), true);
  end if;
end;
$$;

create or replace function ajouter_restaurant(
  p_name text,
  p_short_code text,
  p_address text default null,
  p_copy_from uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  v_code text := upper(trim(coalesce(p_short_code, '')));
  v_src_code text;
  v_id uuid;
  v_src record;
  v_new_eq uuid;
  v_new_code text;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if auth_role() is distinct from 'proprietaire' then
    raise exception 'Seul un propriétaire peut ajouter un restaurant' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Le nom du restaurant est obligatoire' using errcode = '22023';
  end if;
  if v_code !~ '^[A-Z0-9]{2,6}$' then
    raise exception 'Code court : 2 à 6 lettres ou chiffres, sans espace (ex. CTR3)' using errcode = '22023';
  end if;
  if p_copy_from is not null then
    select short_code into v_src_code from restaurants where id = p_copy_from;
    if v_src_code is null or not has_restaurant(p_copy_from) then
      raise exception 'Restaurant à copier introuvable' using errcode = 'P0002';
    end if;
  end if;

  insert into restaurants (name, short_code, address)
  values (v_name, v_code, nullif(trim(p_address), ''))
  returning id into v_id;

  -- Un propriétaire limité à certains restaurants garde l'accès à celui qu'il crée.
  if not exists (select 1 from users where id = v_caller and all_restaurants) then
    insert into user_restaurants (user_id, restaurant_id) values (v_caller, v_id);
  end if;

  if p_copy_from is not null then
    for v_src in
      select e.id, e.code, e.name, e.category_id, e.brand_id, e.model,
             p.frequency, p.task
      from equipments e
      left join maintenance_plans p on p.equipment_id = e.id
      where e.restaurant_id = p_copy_from
      order by e.code
    loop
      v_new_code := case
        when v_src.code like v_src_code || '-%' then v_code || substring(v_src.code from length(v_src_code) + 1)
        else v_code || '-' || v_src.code
      end;

      insert into equipments (restaurant_id, code, name, category_id, brand_id, model, state)
      values (v_id, v_new_code, v_src.name, v_src.category_id, v_src.brand_id, v_src.model, 'operationnel')
      returning id into v_new_eq;

      if v_src.frequency is not null then
        insert into maintenance_plans (equipment_id, frequency, task, next_due_at)
        values (v_new_eq, v_src.frequency, v_src.task, next_due_date(v_src.frequency, current_date));
      end if;

      insert into part_compatibilities (part_id, equipment_id)
      select part_id, v_new_eq from part_compatibilities where equipment_id = v_src.id;

      insert into equipment_events (equipment_id, type, summary, user_id)
      values (v_new_eq, 'modification', 'Équipement ajouté (copié depuis ' || v_src_code || ')', v_caller);
    end loop;
  end if;

  return v_id;
end;
$$;

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
  where id = p_intervention_id and status = 'en_cours'
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
$$;

create or replace function enregistrer_equipement(
  p_id uuid,
  p_restaurant_id uuid,
  p_name text,
  p_code text,
  p_state equipment_state,
  p_category_id uuid default null,
  p_new_category text default null,
  p_brand_id uuid default null,
  p_new_brand text default null,
  p_model text default null,
  p_serial_number text default null,
  p_installed_at date default null,
  p_frequency maintenance_frequency default null,
  p_task text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_name text := nullif(trim(p_name), '');
  v_code text := nullif(upper(trim(p_code)), '');
  v_category uuid := p_category_id;
  v_brand uuid := p_brand_id;
  v_old_restaurant uuid;
  v_old_state equipment_state;
  v_id uuid;
  v_summary text;
  v_labels jsonb := '{"operationnel":"Opérationnel","en_panne":"En panne",
    "en_maintenance":"En maintenance","hors_service":"Hors service"}';
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('proprietaire', 'editeur') then
    raise exception 'Votre rôle ne permet pas de modifier les équipements' using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Le nom est obligatoire' using errcode = '22023';
  end if;
  if not has_restaurant(p_restaurant_id) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;

  if p_id is not null then
    select restaurant_id, state into v_old_restaurant, v_old_state
    from equipments where id = p_id for update;
    if v_old_restaurant is null then
      raise exception 'Équipement introuvable' using errcode = 'P0002';
    end if;
    if not has_restaurant(v_old_restaurant) then
      raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
    end if;
  end if;

  -- Catégorie créée à la volée (ou reprise si le nom existe déjà).
  if nullif(trim(p_new_category), '') is not null then
    select id into v_category from categories where lower(name) = lower(trim(p_new_category));
    if v_category is null then
      insert into categories (name, code)
      values (trim(p_new_category), code_categorie_libre(p_new_category))
      returning id into v_category;
    end if;
  end if;

  -- Marque créée à la volée (ou reprise si le nom existe déjà).
  if nullif(trim(p_new_brand), '') is not null then
    select id into v_brand from brands where lower(name) = lower(trim(p_new_brand));
    if v_brand is null then
      insert into brands (name) values (trim(p_new_brand)) returning id into v_brand;
    end if;
  end if;

  if v_code is null then
    v_code := prochain_code_equipement(p_restaurant_id, v_category);
  end if;

  if p_id is null then
    insert into equipments (restaurant_id, code, name, category_id, brand_id, model,
                            serial_number, installed_at, state)
    values (p_restaurant_id, v_code, v_name, v_category, v_brand, nullif(trim(p_model), ''),
            nullif(trim(p_serial_number), ''), p_installed_at, p_state)
    returning id into v_id;
    v_summary := 'Équipement ajouté';
  else
    update equipments set
      restaurant_id = p_restaurant_id,
      code = v_code,
      name = v_name,
      category_id = v_category,
      brand_id = v_brand,
      model = nullif(trim(p_model), ''),
      serial_number = nullif(trim(p_serial_number), ''),
      installed_at = p_installed_at,
      state = p_state
    where id = p_id;
    v_id := p_id;
    v_summary := case when v_old_state is distinct from p_state
      then 'État : ' || (v_labels ->> v_old_state::text) || ' → ' || (v_labels ->> p_state::text)
      else 'Informations modifiées' end;
  end if;

  if p_frequency is not null then
    insert into maintenance_plans (equipment_id, frequency, task, next_due_at)
    values (v_id, p_frequency, nullif(trim(p_task), ''), next_due_date(p_frequency, current_date))
    on conflict (equipment_id) do update set
      frequency = excluded.frequency,
      task = excluded.task,
      next_due_at = case
        when maintenance_plans.frequency is distinct from excluded.frequency
          or maintenance_plans.next_due_at is null
        then next_due_date(excluded.frequency,
                           coalesce(maintenance_plans.last_done_at, current_date))
        else maintenance_plans.next_due_at end;
  end if;

  insert into equipment_events (equipment_id, type, summary, user_id)
  values (v_id, 'modification', v_summary, v_caller);

  return v_id;
end;
$$;

create or replace function noter_entretien_fait(
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
  if v_role is null or v_role not in ('proprietaire', 'editeur', 'commentateur') then
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

