-- Recette sécurité, lot 3 : lecture réservée aux comptes qui ont un profil,
-- plus de création directe de restaurant, droits par défaut resserrés.
--
-- 1. Les référentiels globaux (catégories, marques, pièces, liens pièce-machine,
--    mouvements de stock) étaient lisibles par tout compte authentifié (using (true)),
--    même sans ligne dans users. Désormais il faut un profil : auth_role() is not null.
--    Un compte Auth sans profil (création interrompue, profil supprimé) ne lit plus rien.
-- 2. restaurants_insert est supprimée : l'écran passe par la fonction ajouter_restaurant
--    (propriétaire, une seule transaction). Sans politique d'insertion, les RLS
--    refusent toute création directe, même pour un propriétaire.
-- 3. Droits par défaut du rôle postgres (celui qui applique les migrations) :
--    - fonctions : les fonctions créées à l'avenir ne sont plus exécutables par public
--      ni anon. ATTENTION : toute nouvelle fonction appelée par l'application ou par
--      une politique RLS doit donc porter explicitement
--        grant execute on function ma_fonction(...) to authenticated;
--    - tables et séquences : anon (clé publique sans connexion) perd ses droits, sur
--      l'existant comme pour l'avenir. Toutes les politiques visent authenticated,
--      anon ne voyait donc déjà aucune ligne ; ce retrait est une seconde barrière
--      et masque aussi la structure des tables à la clé publique. L'application ne lit
--      la base qu'après connexion (connexion et changement de mot de passe lisent
--      users une fois la session ouverte), rien ne change pour elle.
--      authenticated et service_role gardent leurs droits : les RLS filtrent.

-- 1. Lectures globales réservées aux profils
alter policy categories_select on categories using (auth_role() is not null);
alter policy brands_select on brands using (auth_role() is not null);
alter policy parts_select on parts using (auth_role() is not null);
alter policy part_compat_select on part_compatibilities using (auth_role() is not null);
alter policy stock_movements_select on stock_movements using (auth_role() is not null);

-- 2. Plus de création directe de restaurant
drop policy restaurants_insert on restaurants;

-- 3. Droits par défaut et droits existants d'anon
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
