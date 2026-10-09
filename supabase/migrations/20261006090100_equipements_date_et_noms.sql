-- Retours de la présentation client (2026-10-06) : équipements et fréquences.
--
-- 1. next_due_date connaît les fréquences journalière et hebdomadaire.
-- 2. Date d'installation par défaut : les restaurants existent déjà et la date réelle est
--    souvent inconnue. À l'ajout d'une machine sans date (formulaire, copie d'un
--    restaurant), on met la date du jour. Les machines déjà présentes sans date reçoivent
--    leur date d'ajout dans l'application (created_at). Une date saisie n'est jamais écrasée.
-- 3. Noms uniques par restaurant : deux machines d'un même restaurant ne peuvent plus
--    porter le même nom (casse, accents et espaces ignorés : « Clim 7 » = « clim  7 »).
--    Le même nom reste possible dans deux restaurants différents (« Petit frigo » existe
--    à CTR1 et CTR2, et la copie d'un restaurant reprend les noms) : c'est le code
--    (CTR2-CLI-07) qui distingue les machines de toute la chaîne.
--    Message clair levé par un trigger ; l'index unique garantit la règle même en cas
--    d'écritures simultanées.

-- 1. Fréquences
create or replace function next_due_date(freq maintenance_frequency, from_date date)
returns date
language sql immutable
as $$
  select (from_date + case freq
    when 'journalier'   then interval '1 day'
    when 'hebdomadaire' then interval '7 days'
    when 'mensuel'      then interval '1 month'
    when 'trimestriel'  then interval '3 months'
    when 'semestriel'   then interval '6 months'
    when 'annuel'       then interval '1 year'
  end)::date;
$$;

-- 3. Nom comparable : minuscules, sans accents, espaces réduits.
create function nom_equipement_normalise(p_name text)
returns text
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select lower(regexp_replace(trim(translate(p_name,
    'àâäáéèêëîïíôöóùûüúçÀÂÄÁÉÈÊËÎÏÍÔÖÓÙÛÜÚÇ',
    'aaaaeeeeiiiooouuuucAAAAEEEEIIIOOOUUUUC')), '\s+', ' ', 'g'));
$$;
grant execute on function nom_equipement_normalise(text) to authenticated;

-- 2 et 3. Avant chaque écriture d'un équipement : nom nettoyé, date d'installation par
-- défaut à la création, refus d'un nom déjà pris dans le même restaurant.
create function equipements_avant_ecriture()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_name text;
begin
  new.name := regexp_replace(trim(new.name), '\s+', ' ', 'g');
  if tg_op = 'INSERT' then
    new.installed_at := coalesce(new.installed_at, current_date);
  end if;

  if tg_op = 'INSERT' or new.name is distinct from old.name
     or new.restaurant_id is distinct from old.restaurant_id then
    select code, name into v_code, v_name
    from equipments
    where restaurant_id = new.restaurant_id
      and id <> new.id
      and nom_equipement_normalise(name) = nom_equipement_normalise(new.name)
    limit 1;
    if v_code is not null then
      raise exception 'Une machine s''appelle déjà « % » dans ce restaurant (%). Donnez un autre nom.',
        v_name, v_code
        using errcode = '23505', constraint = 'equipments_nom_restaurant_unique';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_equipments_avant_ecriture
  before insert or update on equipments
  for each row execute function equipements_avant_ecriture();

create unique index equipments_nom_restaurant_unique
  on equipments (restaurant_id, nom_equipement_normalise(name));

-- 2. Machines déjà présentes sans date : date d'ajout. updated_at n'est pas touché
-- (ce n'est pas une modification faite par un utilisateur).
alter table equipments disable trigger trg_equipments_updated;
update equipments set installed_at = created_at::date where installed_at is null;
alter table equipments enable trigger trg_equipments_updated;
