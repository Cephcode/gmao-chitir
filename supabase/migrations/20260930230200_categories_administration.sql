-- Phase 5 : écran « Catégories » dans Administration (propriétaire et éditeur).
--
-- 1. Colonne icon (nom d'une icône de components/icons.tsx), facultative : sans icône,
--    l'application retombe sur le repère par code (REF, CUI...) puis sur la clé à molette.
--    Les 6 catégories d'origine reçoivent l'icône qu'elles avaient déjà à l'écran.
-- 2. Suppression : propriétaire ET éditeur (avant : propriétaire seul), mais jamais une
--    catégorie encore utilisée. La clé étrangère equipments.category_id passe de
--    « on delete set null » à « on delete restrict » : la base refuse la suppression dès
--    qu'une machine l'utilise, quel que soit le restaurant (la vérification de clé
--    étrangère ignore les RLS, donc un éditeur ne peut pas vider les machines des autres).
-- 3. Unicité du nom sans tenir compte des majuscules (le code est déjà unique), comme la
--    création à la volée qui reprend une catégorie existante par lower(name).
-- 4. Garde-fous de format (not valid : les lignes existantes ne sont pas revérifiées) :
--    code en majuscules, 3 lettres, avec le suffixe chiffré que code_categorie_libre peut
--    ajouter (FRI2) ; nom non vide.
-- Insertion et modification restent ouvertes au propriétaire et à l'éditeur (politiques
-- de 20260929181001), et refusées si le rôle est absent (auth_role() null).

alter table categories add column icon text;

update categories set icon = case code
  when 'REF' then 'fridge'
  when 'CUI' then 'flame'
  when 'CLI' then 'wind'
  when 'VEN' then 'hood'
  when 'VIT' then 'fridge'
  when 'BOI' then 'snow'
end
where code in ('REF', 'CUI', 'CLI', 'VEN', 'VIT', 'BOI');

alter table equipments drop constraint equipments_category_id_fkey;
alter table equipments add constraint equipments_category_id_fkey
  foreign key (category_id) references categories (id) on delete restrict;

create unique index categories_name_unique on categories (lower(name));

alter table categories add constraint categories_code_format
  check (code ~ '^[A-Z]{3}[0-9]*$') not valid;
alter table categories add constraint categories_name_non_vide
  check (length(trim(name)) > 0) not valid;

alter policy categories_delete on categories
  using (auth_role() in ('proprietaire', 'editeur'));
