-- Création et modification d'un équipement (étape 1b).
-- Même principe que les autres fonctions métier : SECURITY DEFINER, vérification du rôle
-- et du restaurant, écritures multi-tables en une seule transaction
-- (équipement, catégorie ou marque créées à la volée, plan d'entretien, fiche de vie).

-- Code catégorie à partir d'un nom : 3 premières lettres sans accent, en majuscules
-- (« Friteuses » → FRI), suffixe 2, 3… si le code existe déjà.
create function code_categorie_libre(p_name text)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_code text;
  v_i int := 2;
begin
  v_base := left(regexp_replace(
    translate(upper(p_name), 'ÀÂÄÁÉÈÊËÎÏÍÔÖÓÙÛÜÚÇ', 'AAAAEEEEIIIOOOUUUUC'),
    '[^A-Z]', '', 'g'), 3);
  v_base := rpad(v_base, 3, 'X');
  v_code := v_base;
  while exists (select 1 from categories where code = v_code) loop
    v_code := v_base || v_i;
    v_i := v_i + 1;
  end loop;
  return v_code;
end;
$$;

-- Prochain code libre pour un restaurant et une catégorie : CTR2-REF-05.
-- Numéro = plus grand numéro existant avec ce préfixe + 1. Sans catégorie : préfixe EQP.
-- Renvoie null si l'appelant n'a pas accès au restaurant.
create function prochain_code_equipement(p_restaurant_id uuid, p_category_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_next int;
begin
  if not has_restaurant(p_restaurant_id) then
    return null;
  end if;
  select r.short_code || '-' || coalesce(c.code, 'EQP') || '-'
    into v_prefix
  from restaurants r
  left join categories c on c.id = p_category_id
  where r.id = p_restaurant_id;
  if v_prefix is null then
    return null;
  end if;

  select coalesce(max(substring(code from length(v_prefix) + 1)::int), 0) + 1
    into v_next
  from equipments
  where code like v_prefix || '%'
    and substring(code from length(v_prefix) + 1) ~ '^\d+$';

  return v_prefix || lpad(v_next::text, 2, '0');
end;
$$;

-- enregistrer_equipement : crée (p_id null) ou modifie un équipement. Propriétaire, éditeur.
-- Catégorie et marque : un id existant, ou un nom à créer (réutilise un nom identique).
-- Plan d'entretien : créé ou mis à jour si p_frequency est fourni, laissé tel quel sinon.
-- Sans entretien noté, la première échéance est aujourd'hui + fréquence ; si la fréquence
-- change, l'échéance est recalculée depuis le dernier entretien.
create function enregistrer_equipement(
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
  if v_role not in ('proprietaire', 'editeur') then
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

-- Supabase accorde par défaut l'exécution à anon et authenticated : on retire les deux.
revoke execute on function code_categorie_libre(text) from public, anon, authenticated;
grant execute on function
  prochain_code_equipement(uuid, uuid),
  enregistrer_equipement(uuid, uuid, text, text, equipment_state, uuid, text, uuid, text,
                         text, text, date, maintenance_frequency, text)
to authenticated;
