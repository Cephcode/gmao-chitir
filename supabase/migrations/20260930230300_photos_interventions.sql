-- Phase 4 (recette mobile) : photos « avant » et « après » d'une intervention.
--
-- 1. Bucket Storage « photos », PRIVÉ : aucune URL publique, l'application affiche les
--    photos par des URL signées de courte durée (1 h), générées côté serveur.
--    Chemin d'un objet : {restaurant_id}/{intervention_id}/{uuid}.jpg
--    (les photos sont compressées en JPEG dans le navigateur avant l'envoi).
-- 2. Table intervention_photos : une ligne par photo (avant ou après), qui pointe vers
--    l'objet Storage. Lecture : comptes du restaurant de l'intervention. Ajout : fonction
--    ajouter_photo_intervention seulement (aucune politique d'insertion). Suppression :
--    l'auteur de la photo, le propriétaire ou l'éditeur.
-- 3. Limite par intervention et par type : fonction photos_max_par_type().
--    POUR AUGMENTER LA LIMITE (plan payant) : changer le nombre renvoyé par
--    photos_max_par_type() dans une nouvelle migration, ET la constante
--    PHOTOS_MAX_PAR_TYPE de lib/photos.ts (côté application). Les deux doivent être égales.
-- 4. La colonne interventions.photo_url (une seule photo, jamais utilisée) est laissée
--    telle quelle : rien n'est supprimé.
--
-- Objets orphelins : Supabase interdit la suppression directe dans storage.objects en SQL
-- (il faut passer par l'API Storage). Quand une intervention est supprimée, ses lignes
-- intervention_photos partent en cascade, mais les fichiers restent dans le bucket.
-- L'application ne supprime pas d'intervention aujourd'hui ; si cela arrive, les fichiers
-- du dossier {restaurant_id}/{intervention_id}/ se suppriment depuis le tableau de bord
-- Supabase (Storage) ou par l'API.

-- ============================================================
-- Bucket privé (2 Mo par fichier au plus, images seulement)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- Limite réglable à un seul endroit (côté base)
-- ============================================================
create function photos_max_par_type()
returns integer
language sql immutable set search_path = public, pg_temp
as $$ select 3 $$;

revoke execute on function photos_max_par_type() from public, anon;
grant execute on function photos_max_par_type() to authenticated;

-- ============================================================
-- Table
-- ============================================================
create type photo_kind as enum ('avant', 'apres');

create table intervention_photos (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id) on delete cascade,
  kind photo_kind not null,
  storage_path text not null unique,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index intervention_photos_intervention_idx on intervention_photos (intervention_id, kind);

alter table intervention_photos enable row level security;

-- Droits explicites : lecture et suppression (filtrées par les RLS), jamais d'ajout ni de
-- modification directs (l'ajout passe par ajouter_photo_intervention).
revoke all on intervention_photos from anon, authenticated;
grant select, delete on intervention_photos to authenticated;

create policy intervention_photos_select on intervention_photos
  for select to authenticated
  using (auth_role() is not null and has_restaurant(intervention_restaurant(intervention_id)));

create policy intervention_photos_delete on intervention_photos
  for delete to authenticated
  using (auth_role() is not null
         and has_restaurant(intervention_restaurant(intervention_id))
         and (created_by = auth.uid() or auth_role() in ('proprietaire', 'editeur')));

-- ============================================================
-- Chemin d'un objet du bucket : {restaurant_id}/{intervention_id}/{uuid}.jpg
-- Renvoie l'intervention si le chemin est bien formé, que l'appelant a un profil, accès au
-- restaurant du 1er segment, et que l'intervention du 2e segment est bien de ce restaurant.
-- Sinon null. Utilisée par les politiques de storage.objects.
-- ============================================================
create function photo_intervention_accessible(p_name text)
returns uuid
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_parts text[];
  v_restaurant uuid;
  v_intervention uuid;
begin
  if p_name is null
     or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' then
    return null;
  end if;
  v_parts := string_to_array(p_name, '/');
  v_restaurant := v_parts[1]::uuid;
  v_intervention := v_parts[2]::uuid;
  if auth_role() is null or not has_restaurant(v_restaurant)
     or intervention_restaurant(v_intervention) is distinct from v_restaurant then
    return null;
  end if;
  return v_intervention;
end $$;

-- Garde-fou contre le remplissage du quota : au plus 4 fois la limite de fichiers par
-- dossier d'intervention (photos enregistrées + quelques envois ratés non nettoyés).
create function photo_objet_ajout_autorise(p_name text)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_intervention uuid := photo_intervention_accessible(p_name);
begin
  if v_intervention is null then
    return false;
  end if;
  return (select count(*) from storage.objects o
          where o.bucket_id = 'photos'
            and o.name like split_part(p_name, '/', 1) || '/' || v_intervention::text || '/%')
         < 4 * photos_max_par_type();
end $$;

revoke execute on function photo_intervention_accessible(text), photo_objet_ajout_autorise(text)
  from public, anon;
grant execute on function photo_intervention_accessible(text), photo_objet_ajout_autorise(text)
  to authenticated;

-- ============================================================
-- Politiques du bucket « photos » (pas d'update : une photo ne se remplace pas)
-- ============================================================
create policy photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and photo_intervention_accessible(name) is not null);

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and photo_objet_ajout_autorise(name));

-- Suppression : celui qui a envoyé le fichier (nettoyage après un échec), le propriétaire
-- ou l'éditeur (mêmes droits que pour la ligne intervention_photos).
create policy photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and photo_intervention_accessible(name) is not null
         and (owner_id = auth.uid()::text or auth_role() in ('proprietaire', 'editeur')));

-- ============================================================
-- Ajout d'une photo (après l'envoi du fichier dans le bucket)
-- ============================================================
-- « avant » : tout rôle qui peut déclarer une panne sur ce restaurant (tous les rôles, dont
--   le lecteur), tant que l'intervention est ouverte.
-- « après » : propriétaire, éditeur, commentateur, une fois l'intervention terminée
--   (la clôture passe d'abord, les photos suivent).
-- Limite photos_max_par_type() par (intervention, type), garantie même pour deux ajouts
-- simultanés : la ligne de l'intervention est verrouillée avant de compter.
create function ajouter_photo_intervention(p_intervention uuid, p_kind photo_kind, p_path text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_role user_role := auth_role();
  v_restaurant uuid;
  v_status intervention_status;
  v_count integer;
  v_id uuid;
begin
  if v_caller is null or v_role is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_kind is null then
    raise exception 'Type de photo requis (avant ou après)' using errcode = '22004';
  end if;

  -- Verrou : deux ajouts simultanés sur la même intervention passent l'un après l'autre.
  select restaurant_id, status into v_restaurant, v_status
  from interventions where id = p_intervention
  for update;
  if v_restaurant is null or not has_restaurant(v_restaurant) then
    raise exception 'Intervention introuvable' using errcode = 'P0002';
  end if;

  if p_kind = 'avant' then
    if v_status = 'terminee' then
      raise exception 'Intervention clôturée : ajoutez plutôt une photo « après »' using errcode = '22023';
    end if;
  else
    if v_role not in ('proprietaire', 'editeur', 'commentateur') then
      raise exception 'Votre rôle ne permet pas d''ajouter une photo « après »' using errcode = '42501';
    end if;
    if v_status <> 'terminee' then
      raise exception 'Les photos « après » s''ajoutent une fois l''intervention clôturée' using errcode = '22023';
    end if;
  end if;

  -- Le fichier doit être dans le dossier de cette intervention, et déjà envoyé.
  if p_path is null or p_path not like v_restaurant::text || '/' || p_intervention::text || '/%'
     or photo_intervention_accessible(p_path) is distinct from p_intervention then
    raise exception 'Chemin de photo invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'photos' and name = p_path) then
    raise exception 'Fichier de photo introuvable' using errcode = 'P0002';
  end if;

  select count(*) into v_count from intervention_photos
  where intervention_id = p_intervention and kind = p_kind;
  if v_count >= photos_max_par_type() then
    raise exception 'Limite atteinte : % photos « % » au plus par intervention',
      photos_max_par_type(), case p_kind when 'avant' then 'avant' else 'après' end
      using errcode = '23514';
  end if;

  insert into intervention_photos (intervention_id, kind, storage_path, created_by)
  values (p_intervention, p_kind, p_path, v_caller)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function ajouter_photo_intervention(uuid, photo_kind, text) from public, anon;
grant execute on function ajouter_photo_intervention(uuid, photo_kind, text) to authenticated;
