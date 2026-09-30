-- Phase 3 : statuts d'intervention.
-- Ajout des valeurs seules, dans une migration dédiée : une valeur ajoutée par
-- « alter type ... add value » n'est utilisable qu'après la fin de sa transaction.
-- Les fonctions et politiques qui s'en servent sont dans la migration suivante.
--
-- intervention_status : a_planifier | en_cours | en_attente_piece | terminee.
-- Les interventions existantes « en_cours » restent « en_cours ».
alter type intervention_status add value if not exists 'a_planifier' before 'en_cours';
alter type intervention_status add value if not exists 'en_attente_piece' after 'en_cours';

-- Nouveau type de notification : le déclarant est prévenu à chaque changement de
-- statut de sa panne (réglable dans « Mes alertes », sans mail).
alter type notification_type add value if not exists 'statut_intervention';
