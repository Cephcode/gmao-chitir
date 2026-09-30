-- Recette, anomalie M1 : un éditeur pouvait écrire parts.quantity en direct (création
-- avec une quantité quelconque, ou modification), sans mouvement, sans trace ni alerte.
--
-- Règle : les quantités ne bougent que par mouvement_stock et cloturer_intervention
-- (SECURITY DEFINER, non concernées par ces droits). Donc :
-- 1. modification directe : seules les colonnes de la fiche (code, nom, unité, seuil,
--    notes) ; updated_at reste mis à jour par le trigger ;
-- 2. création directe : quantité obligatoirement 0 ; le stock initial entre ensuite
--    comme une livraison (c'est déjà ce que fait l'application).

revoke update on parts from authenticated;
grant update (code, name, unit, min_threshold, notes) on parts to authenticated;

alter policy parts_insert on parts
  with check (auth_role() in ('proprietaire', 'editeur') and quantity = 0);
