-- Ajout d'un restaurant, avec copie facultative de la liste d'équipements d'un autre
-- restaurant (étape 6, validé le 2026-09-30). Une seule transaction.
-- Copie « sans historique » : nom, catégorie, marque, modèle et plan d'entretien
-- (fréquence, tâche) sont repris ; n° de série, date d'installation, interventions,
-- entretiens et fiche de vie ne le sont pas. Les machines démarrent opérationnelles,
-- première échéance = aujourd'hui + fréquence. Les pièces « va avec » sont reprises.
-- Codes régénérés : le préfixe du restaurant source est remplacé (CTR1-FRG-01 → CTR3-FRG-01).

create function ajouter_restaurant(
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
  if auth_role() <> 'proprietaire' then
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

grant execute on function ajouter_restaurant(text, text, text, uuid) to authenticated;
