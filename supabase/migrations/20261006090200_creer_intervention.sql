-- Retours de la présentation client (2026-10-06) : créer une intervention de n'importe
-- quel type, sans passer par « Déclarer une panne ».
--
-- creer_intervention : propriétaire, éditeur, commentateur (technicien), sur un restaurant
-- accessible. Le lecteur garde « Déclarer une panne ».
-- - Type (kind) obligatoire : correctif, preventif, controle, amelioration.
-- - Priorité (type) : normal ou urgence. Statut de départ : tout sauf « terminee ».
-- - Machine de la liste, ou texte libre avec le restaurant (comme declarer_panne).
-- - Technicien facultatif, qui doit pouvoir intervenir sur ce restaurant.
-- Effets, en une transaction :
-- - correctif : comme une panne déclarée (machine en panne, fiche de vie « Panne
--   déclarée », équipe du restaurant prévenue selon ses réglages) ;
-- - autres types : l'état de la machine ne change pas, une ligne est ajoutée à sa fiche
--   de vie.
-- Le technicien choisi est prévenu par le trigger d'attribution (plus bas), comme pour
-- toute attribution ; il ne reçoit donc pas en plus l'alerte « panne » de l'équipe.
-- La clôture reste cloturer_intervention : elle compte comme entretien (sauf alerte).

create function creer_intervention(
  p_kind intervention_kind,
  p_description text,
  p_equipment_id uuid default null,
  p_restaurant_id uuid default null,
  p_equipment_free_text text default null,
  p_type intervention_type default 'normal',
  p_status intervention_status default 'a_planifier',
  p_assigned_to uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_restaurant uuid;
  v_free text := nullif(trim(p_equipment_free_text), '');
  v_description text := nullif(trim(p_description), '');
  v_intervention uuid;
  v_kind_label text;
  v_notif notification_type;
  v_machine text;
  v_short text;
  v_caller_name text;
begin
  if v_caller is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('proprietaire', 'editeur', 'commentateur') then
    raise exception 'Votre rôle ne permet pas de créer une intervention. Utilisez « Déclarer une panne ».'
      using errcode = '42501';
  end if;
  if p_kind is null then
    raise exception 'Choisissez le type d''intervention' using errcode = '22004';
  end if;
  if v_description is null then
    raise exception 'Décrivez ce qu''il faut faire' using errcode = '22004';
  end if;
  if p_type is null or p_type not in ('normal', 'urgence') then
    raise exception 'La priorité est normale ou urgente' using errcode = '22023';
  end if;
  if p_status is null or p_status = 'terminee' then
    raise exception 'Une intervention ne peut pas être créée déjà terminée' using errcode = '22023';
  end if;

  -- Restaurant : via l'équipement, sinon celui passé (machine hors liste).
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
    if v_free is null then
      raise exception 'Choisissez la machine, ou décrivez-la si elle n''est pas dans la liste' using errcode = '22004';
    end if;
  end if;
  if not has_restaurant(v_restaurant) then
    raise exception 'Accès refusé à ce restaurant' using errcode = '42501';
  end if;
  if p_assigned_to is not null and not peut_intervenir(p_assigned_to, v_restaurant) then
    raise exception 'Ce technicien n''a pas accès à ce restaurant' using errcode = '42501';
  end if;

  insert into interventions (equipment_id, equipment_free_text, restaurant_id, type, status,
                             kind, description, reported_by, reported_at, assigned_to)
  values (p_equipment_id, case when p_equipment_id is null then v_free end, v_restaurant,
          p_type, p_status, p_kind, v_description, v_caller, now(), p_assigned_to)
  returning id into v_intervention;

  v_kind_label := case p_kind
    when 'correctif' then 'Réparation'
    when 'preventif' then 'Entretien préventif'
    when 'controle' then 'Contrôle'
    else 'Installation ou amélioration' end;
  select coalesce((select name from equipments where id = p_equipment_id), v_free, 'Machine')
    into v_machine;
  select short_code into v_short from restaurants where id = v_restaurant;
  select coalesce(nullif(trim(first_name), ''), email) into v_caller_name from users where id = v_caller;

  if p_kind = 'correctif' then
    -- Même effet qu'une panne déclarée.
    if p_equipment_id is not null then
      update equipments set state = 'en_panne' where id = p_equipment_id;
      insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
      values (p_equipment_id, 'panne_declaree', v_intervention,
              case when p_type = 'urgence' then 'Urgence déclarée' else 'Panne déclarée' end, v_caller);
    end if;

    v_notif := case when p_type = 'urgence' then 'urgence' else 'panne' end;
    insert into notifications (user_id, type, title, body, link)
    select u.id, v_notif,
           (case when p_type = 'urgence' then 'Urgence' else 'Panne' end) || ' : ' || v_machine || ', ' || v_short,
           'Déclarée' || coalesce(' par ' || v_caller_name, '') || ' · ' || v_description,
           '/interventions/' || v_intervention
    from users u
    where u.role in ('proprietaire', 'editeur', 'commentateur')
      and u.id <> v_caller
      and u.id is distinct from p_assigned_to
      and (u.all_restaurants
           or exists (select 1 from user_restaurants ur
                      where ur.user_id = u.id and ur.restaurant_id = v_restaurant))
      and coalesce((select ns.enabled from notification_settings ns
                    where ns.user_id = u.id and ns.type = v_notif), true);
  else
    -- Entretien, contrôle, amélioration : la machine garde son état.
    if p_equipment_id is not null then
      insert into equipment_events (equipment_id, type, ref_id, summary, user_id)
      values (p_equipment_id, 'modification', v_intervention,
              'Intervention créée : ' || v_kind_label, v_caller);
    end if;
  end if;

  return v_intervention;
end;
$$;

revoke execute on function
  creer_intervention(intervention_kind, text, uuid, uuid, text, intervention_type, intervention_status, uuid)
from public, anon;
grant execute on function
  creer_intervention(intervention_kind, text, uuid, uuid, text, intervention_type, intervention_status, uuid)
to authenticated;

-- ============================================================
-- Attribution : le technicien est prévenu (application, push et e-mail).
-- ============================================================
-- Après chaque création ou changement de technicien d'une intervention ouverte, quel que
-- soit l'écran (création, « Enregistrer » dans la fiche). Pas de message :
-- - si personne n'est attribué, ou si le technicien ne change pas ;
-- - si l'on s'attribue soi-même l'intervention ;
-- - à la clôture (l'intervention est déjà terminée, il n'y a plus rien à faire).
-- Réglable dans « Mes alertes » (type attribution, activé par défaut).
-- Le nom affiché est le prénom, sinon l'e-mail (comptes sans prénom).
create function prevenir_technicien_attribue()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_machine text;
  v_short text;
  v_actor text;
  v_kind text;
begin
  if new.assigned_to is null or new.status = 'terminee'
     or (tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to)
     or new.assigned_to = auth.uid() then
    return new;
  end if;

  select coalesce((select name from equipments where id = new.equipment_id), new.equipment_free_text, 'Machine')
    into v_machine;
  select short_code into v_short from restaurants where id = new.restaurant_id;
  select coalesce(nullif(trim(first_name), ''), email) into v_actor from users where id = auth.uid();
  v_kind := case coalesce(new.kind, 'correctif')
    when 'correctif' then 'Réparation'
    when 'preventif' then 'Entretien préventif'
    when 'controle' then 'Contrôle'
    else 'Installation ou amélioration' end;

  insert into notifications (user_id, type, title, body, link)
  select new.assigned_to, 'attribution',
         (case when new.type = 'urgence' then 'Urgence attribuée : ' else 'Intervention attribuée : ' end)
           || v_machine || ', ' || v_short,
         coalesce('Par ' || v_actor || ' · ', '') || v_kind || ' · '
           || coalesce(nullif(new.description, ''), nullif(array_to_string(new.symptoms, ', '), ''), 'à traiter'),
         '/interventions/' || new.id
  where coalesce((select ns.enabled from notification_settings ns
                  where ns.user_id = new.assigned_to and ns.type = 'attribution'), true);
  return new;
end;
$$;

revoke execute on function prevenir_technicien_attribue() from public, anon, authenticated;

create trigger trg_interventions_attribution
  after insert or update of assigned_to on interventions
  for each row execute function prevenir_technicien_attribue();
