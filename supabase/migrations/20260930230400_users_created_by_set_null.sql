-- Bug relevé le 2026-09-30 : users.created_by (qui a créé ce compte) n'avait pas de règle
-- « on delete ». Supprimer un compte qui avait lui-même créé d'autres comptes (un éditeur qui
-- a créé ses techniciens, par exemple) échouait : violation de users_created_by_fkey, et
-- l'écran Administration affichait une erreur.
-- Correction : à la suppression du créateur, les comptes qu'il a créés restent intacts et
-- perdent seulement cette trace (created_by = null), comme les autres références à users
-- (reported_by, assigned_to, closed_by… sont déjà en « on delete set null »).
alter table users drop constraint users_created_by_fkey;
alter table users
  add constraint users_created_by_fkey foreign key (created_by) references users (id) on delete set null;
