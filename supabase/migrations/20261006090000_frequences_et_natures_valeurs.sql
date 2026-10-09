-- Retours de la présentation client (2026-10-06), valeurs seules.
-- Migration dédiée : une valeur ajoutée par « alter type ... add value » n'est utilisable
-- qu'après la fin de sa transaction. Les fonctions qui s'en servent sont dans les
-- migrations suivantes.
--
-- 1. Fréquences d'entretien journalière et hebdomadaire (demande du client).
-- 2. Types d'intervention : en plus de « correctif » (panne) et « preventif » (entretien),
--    « controle » (vérification, contrôle réglementaire) et « amelioration »
--    (installation, modification). Le client crée lui-même une intervention et choisit
--    son type, sans passer par « Déclarer une panne ».
alter type maintenance_frequency add value if not exists 'journalier' before 'mensuel';
alter type maintenance_frequency add value if not exists 'hebdomadaire' before 'mensuel';

alter type intervention_kind add value if not exists 'controle';
alter type intervention_kind add value if not exists 'amelioration';

-- 3. Notification « attribution » : le technicien à qui l'on attribue une intervention
--    est prévenu (application, push et e-mail), réglable dans « Mes alertes ».
alter type notification_type add value if not exists 'attribution';
