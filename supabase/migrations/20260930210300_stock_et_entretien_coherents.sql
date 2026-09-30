-- Recette sécurité, points S-B6 et S-B7 : cohérence des appels directs.
--
-- mouvement_stock (S-B6) : l'action serveur filtrait déjà, pas la fonction. Un éditeur
-- pouvait l'appeler en direct avec la raison « intervention » sans intervention, ou une
-- « livraison » négative : l'historique du stock devenait trompeur. Désormais refusés.
-- La clôture n'appelle pas mouvement_stock (elle écrit son mouvement « intervention »
-- elle-même, dans sa transaction) : elle n'est pas concernée.
--
-- noter_entretien_fait (S-B7) : une date dans le futur repoussait l'échéance et faisait
-- taire les alertes de retard. Désormais refusée (l'application envoie toujours la date
-- du jour, valeur par défaut).
--
-- Les deux fonctions sont reprises à l'identique de 20260930210000 (dernière version),
-- avec seulement les contrôles ajoutés. Droits d'exécution conservés.

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
  -- Recette S-B6 : la raison doit correspondre au mouvement.
  if p_reason = 'intervention' then
    raise exception 'Une sortie pour intervention passe par la clôture de l''intervention' using errcode = '22023';
  end if;
  if p_reason = 'livraison' and p_delta < 0 then
    raise exception 'Une livraison ajoute des pièces : quantité positive' using errcode = '22023';
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
  -- Recette S-B7 : pas d'entretien daté dans le futur (repousserait l'échéance).
  if p_done_at is null or p_done_at > current_date then
    raise exception 'La date de l''entretien ne peut pas être dans le futur' using errcode = '22023';
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
