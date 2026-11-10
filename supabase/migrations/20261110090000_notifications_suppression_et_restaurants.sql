-- Suppression des notifications et renommage des restaurants (2026-11-10).
--
-- 1. Chacun peut supprimer ses propres notifications (bouton « Supprimer » et
--    « Supprimer les lues » de l'écran Notifications). Avant : aucune politique delete.
-- 2. Nettoyage hebdomadaire des notifications lues depuis plus de 7 jours, activé ou
--    désactivé par l'administrateur (propriétaire) depuis Administration > Réglages.
--    L'état est la présence de la tâche pg_cron elle-même (pas de second état à
--    synchroniser) : activer = cron.schedule, désactiver = cron.unschedule.
-- 3. Renommage d'un restaurant : la politique restaurants_update (propriétaire) existait,
--    on limite les colonnes modifiables en direct au nom et à l'adresse. Le code court
--    reste figé : il sert de préfixe aux codes équipement.

-- ============================================================
-- 1. Suppression de ses notifications
-- ============================================================
create policy notifications_delete on notifications for delete to authenticated
  using (user_id = auth.uid());
grant delete on notifications to authenticated;

-- ============================================================
-- 2. Nettoyage hebdomadaire des notifications lues
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;

-- Supprime les notifications lues depuis plus de 7 jours (toutes les personnes).
-- Appelée par pg_cron seulement.
create function purger_notifications_lues()
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from notifications
  where read_at is not null and read_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function purger_notifications_lues() from public, anon, authenticated;

-- Nettoyage activé ? Lecture réservée au propriétaire.
create function purge_notifications_active()
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth_role() is distinct from 'proprietaire' then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  return exists (select 1 from cron.job where jobname = 'gmao-purge-notifications-lues');
end;
$$;

-- Active (chaque lundi à 3 h UTC = 3 h à Ouagadougou) ou désactive le nettoyage.
create function regler_purge_notifications(p_active boolean)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth_role() is distinct from 'proprietaire' then
    raise exception 'Réservé à l''administrateur' using errcode = '42501';
  end if;
  if p_active then
    -- cron.schedule remplace la tâche si elle existe déjà (même nom) : rejouable.
    perform cron.schedule('gmao-purge-notifications-lues', '0 3 * * 1',
                          'select public.purger_notifications_lues()');
  elsif exists (select 1 from cron.job where jobname = 'gmao-purge-notifications-lues') then
    perform cron.unschedule('gmao-purge-notifications-lues');
  end if;
  return p_active;
end;
$$;

revoke execute on function purge_notifications_active(), regler_purge_notifications(boolean) from public, anon;
grant execute on function purge_notifications_active(), regler_purge_notifications(boolean) to authenticated;

-- ============================================================
-- 3. Restaurants : seuls le nom et l'adresse sont modifiables en direct
-- ============================================================
revoke update on restaurants from authenticated;
grant update (name, address) on restaurants to authenticated;
alter table restaurants add constraint restaurants_name_non_vide check (btrim(name) <> '');
