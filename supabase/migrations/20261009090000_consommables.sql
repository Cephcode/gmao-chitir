-- Module « Consommables » : stock des restaurants (emballages et jetables, boissons,
-- matériel et fournitures en gros). Plan : docs/plan-module-consommables.md.
--
-- Différent du stock de pièces (parts), commun à la chaîne : ici, catalogue commun
-- (articles) mais quantités et seuils PAR RESTAURANT (article_stocks).
-- Une ligne article_stocks = l'article est suivi dans ce restaurant ; elle naît à la
-- première opération (livraison, inventaire, transfert reçu, réglage du seuil).
--
-- Mêmes règles que le stock de pièces :
-- - les quantités ne bougent que par les fonctions ci-dessous (aucune écriture directe) ;
-- - chaque mouvement est tracé (article_mouvements), jamais de stock négatif ;
-- - alerte « stock_bas » au franchissement du seuil vers le bas, aux propriétaires et
--   éditeurs ayant accès au restaurant (réglage « Stock sous le seuil » respecté).
-- Ne touche à aucune table existante : le code en production n'est pas concerné.

-- ============================================================
-- Types
-- ============================================================
create type article_famille as enum ('jetable', 'boisson', 'materiel');
create type article_mouvement_raison as enum ('livraison', 'consommation', 'perte', 'inventaire', 'transfert');

-- ============================================================
-- Tables
-- ============================================================
create table articles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    constraint articles_code_check check (code ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'),
  name text not null
    constraint articles_name_check check (length(btrim(name)) between 1 and 120),
  famille article_famille not null,
  -- Liste fermée, identique à UNITES (lib/consommables-rules.ts).
  unit text not null default 'piece'
    constraint articles_unit_check
    check (unit in ('piece', 'paquet', 'carton', 'bouteille', 'casier', 'sac', 'rouleau', 'litre', 'kg')),
  -- Seuil donné à un restaurant quand il commence à suivre l'article.
  default_threshold integer not null default 0 check (default_threshold >= 0),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Désignation unique sans casse ni espaces autour (« Gobelet 50 cl » = « gobelet 50 CL »).
create unique index articles_nom_unique on articles (lower(btrim(name)));

create trigger trg_articles_updated before update on articles
  for each row execute function set_updated_at();

create table article_stocks (
  article_id uuid not null references articles (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  updated_at timestamptz not null default now(),
  primary key (article_id, restaurant_id)
);
create index article_stocks_restaurant on article_stocks (restaurant_id);

create trigger trg_article_stocks_updated before update on article_stocks
  for each row execute function set_updated_at();

create table article_mouvements (
  id uuid primary key default gen_random_uuid(),
  -- restrict : un article qui a un historique ne se supprime pas.
  article_id uuid not null references articles (id) on delete restrict,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  delta integer not null check (delta <> 0),
  raison article_mouvement_raison not null,
  -- Transfert : les deux lignes (sortie, entrée) partagent transfert_id ;
  -- autre_restaurant_id = l'autre restaurant du transfert.
  transfert_id uuid,
  autre_restaurant_id uuid references restaurants (id) on delete set null,
  note text check (note is null or length(note) <= 300),
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((raison = 'transfert') = (transfert_id is not null))
);
create index article_mouvements_article on article_mouvements (article_id, created_at desc);
create index article_mouvements_restaurant on article_mouvements (restaurant_id, created_at desc);

-- ============================================================
-- Droits en direct (RLS)
-- ============================================================
alter table articles enable row level security;
alter table article_stocks enable row level security;
alter table article_mouvements enable row level security;

grant select, insert, update, delete on articles to authenticated;
grant select on article_stocks, article_mouvements to authenticated;
-- Seconde barrière : les quantités et l'historique ne s'écrivent que par les fonctions.
revoke insert, update, delete on article_stocks, article_mouvements from authenticated;

-- Catalogue : lu par tout compte avec profil, tenu par propriétaire et éditeur,
-- suppression par le propriétaire (refusée s'il y a des mouvements : clé restrict).
create policy articles_select on articles for select to authenticated
  using (auth_role() is not null);
create policy articles_insert on articles for insert to authenticated
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy articles_update on articles for update to authenticated
  using (auth_role() in ('proprietaire', 'editeur'))
  with check (auth_role() in ('proprietaire', 'editeur'));
create policy articles_delete on articles for delete to authenticated
  using (auth_role() = 'proprietaire');

-- Quantités et historique : seulement ses restaurants.
create policy article_stocks_select on article_stocks for select to authenticated
  using (has_restaurant(restaurant_id));
create policy article_mouvements_select on article_mouvements for select to authenticated
  using (has_restaurant(restaurant_id));

-- ============================================================
-- Fonctions
-- ============================================================

-- Contrôles communs : connecté, propriétaire ou éditeur, restaurant existant et accessible,
-- article existant. Renvoie le nom de l'article. Interne (pas de grant).
create function consommable_controle(p_article uuid, p_restaurant uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_role user_role := auth_role();
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('proprietaire', 'editeur') then
    raise exception 'Votre rôle ne permet pas de modifier le stock' using errcode = '42501';
  end if;
  -- Existence d'abord : has_restaurant est vrai pour un propriétaire quel que soit l'id.
  if p_restaurant is null or not exists (select 1 from restaurants where id = p_restaurant) then
    raise exception 'Restaurant introuvable' using errcode = 'P0002';
  end if;
  if not has_restaurant(p_restaurant) then
    raise exception 'Restaurant non autorisé' using errcode = '42501';
  end if;
  select name into v_name from articles where id = p_article;
  if v_name is null then
    raise exception 'Article introuvable' using errcode = 'P0002';
  end if;
  return v_name;
end;
$$;

-- Alerte au franchissement du seuil vers le bas (avant >= seuil > après).
-- Destinataires : propriétaires et éditeurs ayant accès au restaurant, alerte active.
-- Interne (pas de grant).
create function alerte_article_bas(
  p_article uuid, p_restaurant uuid, p_avant integer, p_apres integer, p_seuil integer
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_code text;
begin
  if not (p_apres < p_seuil and p_avant >= p_seuil) then
    return;
  end if;
  select name into v_name from articles where id = p_article;
  select short_code into v_code from restaurants where id = p_restaurant;

  insert into notifications (user_id, type, title, body, link)
  select u.id, 'stock_bas', v_name || ' sous le seuil · ' || v_code,
         'Il reste ' || p_apres || ', seuil ' || p_seuil,
         '/consommables/' || p_article || '?restaurant=' || v_code
  from users u
  where u.role in ('proprietaire', 'editeur')
    and (u.all_restaurants
         or exists (select 1 from user_restaurants ur
                    where ur.user_id = u.id and ur.restaurant_id = p_restaurant))
    and coalesce((select ns.enabled from notification_settings ns
                  where ns.user_id = u.id and ns.type = 'stock_bas'), true);
end;
$$;

-- Livraison (+), consommation (−) ou perte/casse (−). p_quantite est toujours positive :
-- le sens vient de la raison. Renvoie la nouvelle quantité.
create function mouvement_article(
  p_article uuid,
  p_restaurant uuid,
  p_raison article_mouvement_raison,
  p_quantite integer,
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_avant integer;
  v_apres integer;
  v_seuil integer;
  v_delta integer;
begin
  perform consommable_controle(p_article, p_restaurant);
  if p_raison is null or p_raison not in ('livraison', 'consommation', 'perte') then
    raise exception 'Opération inconnue : utilisez l''inventaire ou le transfert prévus' using errcode = '22023';
  end if;
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'La quantité doit être un nombre entier positif' using errcode = '22023';
  end if;
  v_delta := case when p_raison = 'livraison' then p_quantite else -p_quantite end;

  -- Première livraison : l'article devient suivi, avec le seuil par défaut.
  if p_raison = 'livraison' then
    insert into article_stocks (article_id, restaurant_id, min_threshold)
    select p_article, p_restaurant, default_threshold from articles where id = p_article
    on conflict do nothing;
  end if;

  select quantity, min_threshold into v_avant, v_seuil
  from article_stocks where article_id = p_article and restaurant_id = p_restaurant for update;
  if v_avant is null then
    raise exception 'Cet article n''est pas encore en stock dans ce restaurant' using errcode = '23514';
  end if;
  v_apres := v_avant + v_delta;
  if v_apres < 0 then
    raise exception 'Stock insuffisant (reste %, retrait %)', v_avant, -v_delta using errcode = '23514';
  end if;

  insert into article_mouvements (article_id, restaurant_id, delta, raison, note, user_id)
  values (p_article, p_restaurant, v_delta, p_raison, nullif(btrim(p_note), ''), auth.uid());
  update article_stocks set quantity = v_apres
  where article_id = p_article and restaurant_id = p_restaurant;

  perform alerte_article_bas(p_article, p_restaurant, v_avant, v_apres, v_seuil);
  return v_apres;
end;
$$;

-- Inventaire : p_quantite = quantité comptée. L'écart est enregistré (raison « inventaire »),
-- calculé sous verrou. Écart nul : aucun mouvement. Renvoie l'écart.
create function inventaire_article(
  p_article uuid,
  p_restaurant uuid,
  p_quantite integer,
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_avant integer;
  v_seuil integer;
  v_delta integer;
begin
  perform consommable_controle(p_article, p_restaurant);
  if p_quantite is null or p_quantite < 0 then
    raise exception 'La quantité comptée doit être un nombre entier, 0 ou plus' using errcode = '22023';
  end if;

  insert into article_stocks (article_id, restaurant_id, min_threshold)
  select p_article, p_restaurant, default_threshold from articles where id = p_article
  on conflict do nothing;

  select quantity, min_threshold into v_avant, v_seuil
  from article_stocks where article_id = p_article and restaurant_id = p_restaurant for update;
  v_delta := p_quantite - v_avant;
  if v_delta = 0 then
    return 0;
  end if;

  insert into article_mouvements (article_id, restaurant_id, delta, raison, note, user_id)
  values (p_article, p_restaurant, v_delta, 'inventaire', nullif(btrim(p_note), ''), auth.uid());
  update article_stocks set quantity = p_quantite
  where article_id = p_article and restaurant_id = p_restaurant;

  perform alerte_article_bas(p_article, p_restaurant, v_avant, p_quantite, v_seuil);
  return v_delta;
end;
$$;

-- Transfert d'un restaurant à l'autre : il faut avoir accès aux deux.
-- Deux mouvements « transfert » liés par transfert_id. Renvoie la quantité restante au départ.
create function transferer_article(
  p_article uuid,
  p_de uuid,
  p_vers uuid,
  p_quantite integer,
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_avant integer;
  v_seuil integer;
  v_transfert uuid := gen_random_uuid();
  v_note text := nullif(btrim(p_note), '');
begin
  perform consommable_controle(p_article, p_de);
  perform consommable_controle(p_article, p_vers);
  if p_de = p_vers then
    raise exception 'Choisissez deux restaurants différents' using errcode = '22023';
  end if;
  if p_quantite is null or p_quantite <= 0 then
    raise exception 'La quantité doit être un nombre entier positif' using errcode = '22023';
  end if;

  insert into article_stocks (article_id, restaurant_id, min_threshold)
  select p_article, p_vers, default_threshold from articles where id = p_article
  on conflict do nothing;

  -- Verrous dans un ordre fixe : deux transferts croisés ne s'interbloquent pas.
  perform 1 from article_stocks
  where article_id = p_article and restaurant_id in (p_de, p_vers)
  order by restaurant_id for update;

  select quantity, min_threshold into v_avant, v_seuil
  from article_stocks where article_id = p_article and restaurant_id = p_de;
  if v_avant is null then
    raise exception 'Cet article n''est pas en stock dans le restaurant de départ' using errcode = '23514';
  end if;
  if v_avant < p_quantite then
    raise exception 'Stock insuffisant au départ (reste %, transfert %)', v_avant, p_quantite using errcode = '23514';
  end if;

  insert into article_mouvements
    (article_id, restaurant_id, delta, raison, transfert_id, autre_restaurant_id, note, user_id)
  values
    (p_article, p_de, -p_quantite, 'transfert', v_transfert, p_vers, v_note, auth.uid()),
    (p_article, p_vers, p_quantite, 'transfert', v_transfert, p_de, v_note, auth.uid());
  update article_stocks set quantity = quantity - p_quantite
  where article_id = p_article and restaurant_id = p_de;
  update article_stocks set quantity = quantity + p_quantite
  where article_id = p_article and restaurant_id = p_vers;

  perform alerte_article_bas(p_article, p_de, v_avant, v_avant - p_quantite, v_seuil);
  return v_avant - p_quantite;
end;
$$;

-- Seuil d'alerte d'un article dans un restaurant (l'article y devient suivi).
create function regler_seuil_article(p_article uuid, p_restaurant uuid, p_seuil integer)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform consommable_controle(p_article, p_restaurant);
  if p_seuil is null or p_seuil < 0 then
    raise exception 'Le seuil doit être un nombre entier, 0 ou plus' using errcode = '22023';
  end if;
  insert into article_stocks (article_id, restaurant_id, min_threshold)
  values (p_article, p_restaurant, p_seuil)
  on conflict (article_id, restaurant_id) do update set min_threshold = excluded.min_threshold;
end;
$$;

-- Ne plus suivre un article dans un restaurant : seulement à quantité 0.
-- L'historique (article_mouvements) est gardé.
create function ne_plus_suivre_article(p_article uuid, p_restaurant uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_qte integer;
begin
  perform consommable_controle(p_article, p_restaurant);
  select quantity into v_qte from article_stocks
  where article_id = p_article and restaurant_id = p_restaurant for update;
  if v_qte is null then
    raise exception 'Cet article n''est pas suivi dans ce restaurant' using errcode = 'P0002';
  end if;
  if v_qte > 0 then
    raise exception 'Il reste % en stock : ramenez la quantité à 0 (inventaire ou transfert) avant d''arrêter le suivi', v_qte
      using errcode = '23514';
  end if;
  delete from article_stocks where article_id = p_article and restaurant_id = p_restaurant;
end;
$$;

-- Droits d'exécution : fonctions métier appelables par un compte connecté seulement ;
-- fonctions internes appelables par personne (elles tournent dans les fonctions métier).
revoke execute on function consommable_controle(uuid, uuid) from public, anon, authenticated;
revoke execute on function alerte_article_bas(uuid, uuid, integer, integer, integer) from public, anon, authenticated;

revoke execute on function mouvement_article(uuid, uuid, article_mouvement_raison, integer, text) from public, anon;
revoke execute on function inventaire_article(uuid, uuid, integer, text) from public, anon;
revoke execute on function transferer_article(uuid, uuid, uuid, integer, text) from public, anon;
revoke execute on function regler_seuil_article(uuid, uuid, integer) from public, anon;
revoke execute on function ne_plus_suivre_article(uuid, uuid) from public, anon;

grant execute on function mouvement_article(uuid, uuid, article_mouvement_raison, integer, text) to authenticated;
grant execute on function inventaire_article(uuid, uuid, integer, text) to authenticated;
grant execute on function transferer_article(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function regler_seuil_article(uuid, uuid, integer) to authenticated;
grant execute on function ne_plus_suivre_article(uuid, uuid) to authenticated;
