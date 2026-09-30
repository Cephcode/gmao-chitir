# Recette : corrections des anomalies du rapport 1

Corrections des 4 anomalies de `docs/recette/1-tests.md`, appliquées sur la base **locale** uniquement.

| Point | Gravité | Correction faite | Fichiers / migration | Commit | Effort |
|---|---|---|---|---|---|
| H1 | Haute | Droits par colonne sur `interventions` : seules `work_done` et `assigned_to` restent modifiables en direct (ce que fait « Enregistrer sans clôturer »). Nouvelle fonction `peut_intervenir(utilisateur, restaurant)` ; le `with check` de `interventions_update` refuse un technicien sans rôle propriétaire, éditeur ou commentateur, ou sans accès au restaurant. | `supabase/migrations/20260930200000_interventions_colonnes_modifiables.sql` ; `supabase/tests/02_cloture.sql` (l.171-178, voir note) | `926aa76` | faible |
| M1 | Moyenne | Droits par colonne sur `parts` : `code`, `name`, `unit`, `min_threshold`, `notes` modifiables, plus `quantity`. `parts_insert` impose `quantity = 0` (l'application crée déjà à 0 puis fait une livraison). | `supabase/migrations/20260930200100_parts_quantite_par_mouvements.sql` | `5bc1390` | faible |
| M2 | Moyenne | `cloturer_intervention` reprise à l'identique de `20260930170000`, avec un seul contrôle ajouté : `p_assigned_to` doit satisfaire `peut_intervenir`, sinon refus 42501 « Ce technicien n'a pas accès à ce restaurant ». | `supabase/migrations/20260930200200_cloture_verifie_intervenant.sql` | `d7dbf1c` | faible |
| B1 | Basse | Droits par colonne sur `notifications` : seul `read_at` modifiable en direct. `delivered_at` reste écrit par l'Edge Function (clé de service, non concernée). | `supabase/migrations/20260930200300_notifications_lecture_seule.sql` | `2b2924d` | très faible |

**Note sur le test modifié** : dans `02_cloture.sql`, le scénario « rattachement puis clôture » exécutait l'attaque sans gestion d'erreur. Une fois corrigé, l'`update` est refusé (42501) et `ON_ERROR_STOP` arrêtait le fichier. Il est enveloppé dans un bloc `do` qui absorbe ce refus ; la vérification finale (machine de R2 toujours « en panne ») est inchangée.

**Résultat** : `bash supabase/tests/run.sh` passe de 455 réussis / 6 échoués à **461 réussis / 0 échoué**. Aucun TypeScript modifié.

**Migration à pousser sur la base hébergée après accord** : `20260930200000`, `20260930200100`, `20260930200200`, `20260930200300` (non poussées, `supabase db push` à lancer par le développeur).
