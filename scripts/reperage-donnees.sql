-- Repérage des données (LECTURE SEULE) : à lancer dans le SQL Editor de Supabase avant une
-- mise en production ou un nettoyage, pour voir ce qui est présent. Aucune écriture.
-- Base propre de référence (juste après l'import des équipements) : 0 compte, 0 intervention,
-- 0 pièce, 0 plan d'entretien, 6 catégories, 2 restaurants, 49 machines opérationnelles.

-- 1. Volumes
select (select count(*) from users) comptes,
       (select count(*) from interventions) interventions,
       (select count(*) from intervention_photos) photos,
       (select count(*) from notifications) notifications,
       (select count(*) from stock_movements) mouvements_stock,
       (select count(*) from parts) pieces,
       (select count(*) from categories) categories,
       (select count(*) from maintenance_logs) entretiens_notes,
       (select count(*) from maintenance_plans) plans_entretien,
       (select count(*) from equipments where state <> 'operationnel') machines_pas_operationnelles,
       (select count(*) from restaurants) restaurants;
-- 2. Comptes
select email, role, all_restaurants, created_at::date from users order by created_at;
-- 3. Interventions
select i.created_at::date as le, r.short_code as resto,
       coalesce(e.name, i.equipment_free_text) as machine, i.type, i.status,
       (select count(*) from intervention_photos p where p.intervention_id = i.id) as photos
from interventions i
join restaurants r on r.id = i.restaurant_id
left join equipments e on e.id = i.equipment_id
order by i.created_at;
-- 4. Catégories ajoutées (hors les 6 d'origine), pièces, restaurants
select 'catégorie' as quoi, name || ' (' || code || ')' as detail from categories where code not in ('REF','CUI','CLI','VIT','VEN','BOI')
union all select 'pièce', name || ' : ' || quantity from parts
union all select 'restaurant', short_code || ' ' || name from restaurants;
