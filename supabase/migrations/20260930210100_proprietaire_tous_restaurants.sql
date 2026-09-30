-- Recette sécurité, point S-M2 : un propriétaire a toujours accès à tous les restaurants.
--
-- Un propriétaire « limité » (all_restaurants = false) gardait dans l'administration les
-- pouvoirs d'un propriétaire global : il pouvait créer un compte « tous les restaurants »
-- ou réinitialiser le mot de passe du propriétaire principal, et sortir ainsi de sa limite.
-- Choix retenu : le propriétaire limité n'existe plus. La base l'interdit ici, et
-- l'administration force « tous les restaurants » quand le rôle propriétaire est choisi.
--
-- Avant de pousser sur l'hébergé, vérifier (lecture seule) que la requête suivante renvoie 0 :
--   select count(*) from users where role = 'proprietaire' and not all_restaurants;
-- Sinon l'ajout de la contrainte échoue (sans rien modifier) et il faut d'abord corriger ce compte.

alter table users
  add constraint users_proprietaire_tous_restaurants
  check (role <> 'proprietaire' or all_restaurants);
