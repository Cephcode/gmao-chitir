-- Recette, anomalie B1 : le destinataire pouvait modifier toutes les colonnes de ses
-- notifications, dont delivered_at. En la remettant à null puis en rappelant l'Edge
-- Function envoyer-notification, il pouvait déclencher un nouvel envoi mail et push.
--
-- Correction : en direct, seule la date de lecture (read_at) reste modifiable. La
-- réservation delivered_at est écrite par l'Edge Function avec la clé de service,
-- qui n'est pas concernée par ces droits.

revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
