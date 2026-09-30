# Recette 1 : tests des règles métier et des droits

Agent `test`, branche `staging`, 2026-09-30. Base **locale** uniquement (conteneur `supabase_db_gmao-chitir`), aucune écriture sur la base hébergée, aucun appel à l'Edge Function, aucun code de production modifié.

## Bilan

**455 réussis, 6 échoués** (461 vérifications). Les 6 échecs sont de vraies anomalies, pas des erreurs de test (4 anomalies distinctes, détail plus bas).

| Suite | Réussis | Échoués |
|---|---|---|
| 01 Stock | 34 | 2 |
| 02 Clôture (et déclaration) | 45 | 3 |
| 03 Entretien | 31 | 0 |
| 04 Matrice des droits | 243 | 0 |
| 06 Notifications | 31 | 1 |
| 07 Ajout de restaurant | 29 | 0 |
| Concurrence (2 sessions psql) | 15 | 0 |
| `node --test` (délégation, statut d'entretien) | 27 | 0 |

Sortie réelle de `bash supabase/tests/run.sh` :

```
  [01_stock] not ok 21 - éditeur : création directe d'une pièce avec quantité 50 sans mouvement refusée
  [01_stock] #         have: autorisé
  [01_stock] #         want: refusé
  [01_stock] not ok 22 - éditeur : modification directe de la quantité refusée
  [01_stock] #         have: autorisé
  [01_stock] #         want: refusé
  [02_cloture] not ok 46 - clôture : technicien d'un autre restaurant (com2) refusé comme intervenant
  [02_cloture] #         have: autorisé
  [02_cloture] #         want: refusé
  [02_cloture] not ok 47 - commentateur R1 : rattacher son intervention à une machine de R2 refusé
  [02_cloture] #         have: autorisé
  [02_cloture] #         want: refusé
  [02_cloture] not ok 48 - machine de R2 non modifiable par un commentateur de R1 (via rattachement puis clôture)
  [02_cloture] #         have: hors_service
  [02_cloture] #         want: en_panne
  [06_notifications] not ok 17 - destinataire : annuler la réservation delivered_at (renvoi possible) refusé
  [06_notifications] #         have: autorisé
  [06_notifications] #         want: refusé

== Bilan ==
01_stock             34 réussis    2 échoués
02_cloture           45 réussis    3 échoués
03_entretien         31 réussis    0 échoués
04_droits           243 réussis    0 échoués
06_notifications     31 réussis    1 échoués
07_restaurant        29 réussis    0 échoués
concurrence          15 réussis    0 échoués
node --test          27 réussis    0 échoués
TOTAL : 455 réussis, 6 échoués
Après la suite : 0 requête(s) pg_net, 0 restaurant(s) de test, 0 compte(s) de test
```

(Les lignes « Failed test » redondantes sont retirées ici.)

## Anomalies

### Critique

Aucune.

### Haute

**H1. Un commentateur (ou éditeur) modifie une machine d'un restaurant auquel il n'a pas accès.**
`supabase/migrations/20260929181001_rls.sql:172-177` (politique `interventions_update`) autorise la mise à jour de toutes les colonnes d'une intervention ouverte ; le `with check` ne contrôle que `restaurant_id`. `equipment_id` peut donc pointer vers la machine d'un autre restaurant. Ensuite `cloturer_intervention` (`20260930170000_notifications_titres_et_taches.sql:140-214`) ne vérifie que le restaurant de l'intervention et écrit sur la machine : état, plan d'entretien (dernier entretien, échéance), journal et fiche de vie.
- Scénario (connecté en commentateur de R1, via PostgREST ou SQL) :
  `update interventions set equipment_id = '<machine de R2>' where id = '<intervention ouverte de R1>';` puis `select cloturer_intervention('<intervention>', 'x', 'hors_service');`
- Attendu : refus du rattachement (0 ligne ou 42501).
- Obtenu : rattachement accepté, la machine de R2 passe « hors service » et son dernier entretien est recalé (tests 02 n° 47 et 48).
- La même politique laisse aussi changer `type` (alerte en normal, qui fait compter la clôture comme entretien), `reported_by`, `assigned_to`. Piste : restreindre les colonnes modifiables (`work_done`, `assigned_to`, `description`) ou vérifier dans le `with check` que la machine appartient au même restaurant.

### Moyenne

**M1. Les quantités de stock se modifient en direct, sans mouvement ni alerte.**
`20260929181001_rls.sql:188-191` (`parts_insert`, `parts_update`) : un éditeur peut créer une pièce avec une quantité quelconque ou changer `quantity`, alors que le commentaire (l.183-185) et `app/(app)/stock/actions.ts:5-6` posent la règle « les quantités ne bougent que par des mouvements ».
- Scénario (éditeur) : `update parts set quantity = 999 where id = '<pièce>';` et `insert into parts (code, name, quantity) values ('X', 'X', 50);`
- Attendu : refus. Obtenu : accepté (tests 01 n° 21 et 22). La quantité ne correspond plus à la somme des mouvements, aucune trace, aucune alerte de seuil.
- Piste : `revoke update (quantity) on parts from authenticated` et imposer `quantity = 0` à l'insertion (check de politique).

**M2. L'intervenant choisi à la clôture n'est pas vérifié en base.**
`20260930170000_notifications_titres_et_taches.sql:156, 214, 224` : `p_assigned_to` est accepté tel quel. Seule la page le vérifie (`app/(app)/interventions/actions.ts:16-20`).
- Scénario (commentateur de R1) : `select cloturer_intervention('<intervention de R1>', 'x', 'operationnel', '<commentateur de R2>');`
- Attendu : refus. Obtenu : accepté (test 02 n° 46). Le journal d'entretien est signé par ce technicien et la notification dit « Clôturée par » lui. Même chose en direct via `update interventions set assigned_to` (voir H1).

### Basse

**B1. Le destinataire peut annuler la réservation d'envoi.**
`20260929181001_rls.sql:219-221` (`notifications_update`) laisse modifier toutes les colonnes de ses notifications, dont `delivered_at`. Avec l'Edge Function appelable sans JWT et avec le seul id, un utilisateur peut remettre `delivered_at` à null puis la rappeler : les mails et push partent de nouveau (vers lui-même).
- Scénario (destinataire) : `update notifications set delivered_at = null where id = '<sa notification>';`
- Attendu : refus (seul `read_at` modifiable). Obtenu : accepté (test 06 n° 17).

**Observations lues dans le code, sans test en échec :**
- `app/(app)/stock/actions.ts:55-59` : une pièce est créée puis son stock initial ajouté en deux appels, donc pas dans une seule transaction. L'échec du second appel est géré par un message.
- `lib/admin-rules.ts:53` : un éditeur peut gérer un compte **sans aucun restaurant** (`[].every(...)` vaut `true`). Effet limité : il ne peut ensuite lui donner que ses propres restaurants.
- `20260929181001_rls.sql:87` : un propriétaire peut insérer un restaurant en direct, sans la validation du code court de `ajouter_restaurant`.
- `20260929182000_functions.sql:220-270` (`noter_entretien_fait`) : une date future est acceptée, ce qui repousse l'échéance.
- Une même pièce en double dans `p_parts` provoque une erreur 23505 : la clôture est bien annulée, mais la page affiche le message générique.
- En local, le job pg_cron (`20260930170000_notifications_titres_et_taches.sql:346`) et le trigger (`20260930190000_envoi_notifications.sql:42`) visent l'URL de l'Edge Function **hébergée**. Aujourd'hui la base locale n'a aucun compte, donc aucun appel ne part. Si des comptes locaux existent un jour, la tâche de 7 h appellera la production (sans effet, id inconnu là-bas).

## Ce qui est vérifié et passe

- **Stock** : livraison, corrections − et +, refus sous 0 (fonction et contrainte), mouvement nul refusé, stock initial égal à la somme des mouvements, décrément à la clôture, alerte au passage sous le seuil seulement (pas à l'égalité), une seule alerte par passage, nouvelle alerte après réassort, bons destinataires et réglages respectés. En concurrence (2 sessions psql) : deux clôtures sur la même pièce (stock 1) ne donnent jamais un stock négatif, la seconde attend puis est refusée. Même résultat pour deux retraits simultanés.
- **Clôture** : dernier entretien égal au jour de clôture pour une panne normale et une urgence, inchangé pour une alerte. Le reste est aussi vérifié : état de la machine, pièces, mouvement tracé, fiche de vie, journal, notification au déclarant seulement (pas s'il clôture lui-même ni s'il a coupé l'alerte), machine sans plan, machine en texte libre. Tout est annulé ensemble en cas d'erreur (stock insuffisant, quantité 0, pièce inconnue). Une double clôture simultanée est refusée.
- **Entretien** : `next_due_date` pour les 4 fréquences, fin de mois, 29 février, fréquence ou date absente. « Noter l'entretien » avec date du jour ou passée, machine sans plan. Au changement de fréquence, l'échéance repart du dernier entretien (ou d'aujourd'hui s'il n'y en a pas) ; à fréquence identique elle ne change pas. Statut calculé (`maintenanceOf`) : jour même = à jour, sans plan ou sans échéance = à définir, retard en jours.
- **Droits** (243 cas) : propriétaire limité, éditeur, commentateur, lecteur contre 19 actions liées à un restaurant (sur le leur et sur un autre) et 20 actions globales, plus l'anonyme et le propriétaire « tous restaurants ». Tous les refus sont constatés en base (RLS ou fonction), pas à l'écran.
- **Délégation** (`lib/admin-rules.ts`) : un éditeur n'attribue jamais le rôle propriétaire ni « tous les restaurants », ne donne que ses restaurants, ne gère ni propriétaire ni compte « tous restaurants » ni compte ayant un restaurant hors des siens. Commentateur et lecteur ne gèrent rien.
- **Notifications** : destinataires par restaurant et par réglage, déclarant exclu, pas de doublon, titres et textes. `taches_quotidiennes()` rejouée 3 fois le même jour sans doublon, rappel de retard le lendemain, rien pour hors service, échéance du jour ou à J+2. Non exécutable par `authenticated`. Réservation `delivered_at` : un seul envoi. Une requête pg_net est mise en file par notification (annulée avec la transaction).
- **Ajout de restaurant** : copie avec codes régénérés (`TSTA-FRI-01` devient `TSTC-FRI-01`, un code sans préfixe devient `TSTC-VIEUX-CODE`). Machines opérationnelles, sans n° de série, sans historique ; plans repris avec échéance = aujourd'hui + fréquence ; pièces « va avec » reprises. Validations du code court, refus pour les autres rôles, transaction annulée si un code copié existe déjà.

## Non testé

- **Server actions Next** (`app/(app)/admin/actions.ts:120-128, 166-170` : pas de changement de son propre rôle, toujours un propriétaire ; `checkAssignee`) : il faut le serveur Next et le client admin Supabase. Relu seulement, logique correcte en lecture.
- **Edge Function `envoyer-notification`** (interdiction d'appeler l'hébergée) : seule son instruction de réservation est rejouée en SQL. La réservation par deux sessions simultanées n'est pas testée, car elle demanderait de valider une notification, donc de déclencher pg_net.
- **Interblocage** si deux clôtures utilisent les mêmes pièces dans un ordre inverse : impossible de s'intercaler au milieu de la fonction. Risque théorique : erreur 40P01, la page afficherait « Réessayez ».
- **Déclenchement réel de pg_cron à 7 h.**

## Vérifications manuelles pour le développeur

1. Mobile 390 px : déclarer une panne en deux étapes (machine trouvée, puis « je ne trouve pas la machine »), photo, urgence.
2. Mobile 390 px : clôturer une intervention avec pièces, état après réparation et technicien ; vérifier le message si le stock est insuffisant.
3. Mobile 390 px : consulter une fiche équipement (statut d'entretien, fiche de vie, pièces « va avec »).
4. Admin : un éditeur ne voit ni le rôle Propriétaire ni « Tous les restaurants » ; il ne peut pas changer son propre rôle ; le dernier propriétaire ne peut être ni rétrogradé ni supprimé.
5. Réception réelle d'un mail et d'un push (staging) pour une urgence, une seule fois.
6. Écran « Mes alertes » : couper un type d'alerte et vérifier qu'il n'arrive plus.

## Relancer

```
bash supabase/tests/run.sh             # tout (SQL, concurrence, node)
bash supabase/tests/run.sh 04_droits   # un seul scénario SQL
```

Fichiers : `supabase/tests/_fixture.sql` (comptes et données de test créés dans la transaction), `01_stock.sql`, `02_cloture.sql`, `03_entretien.sql`, `04_droits.sql`, `06_notifications.sql`, `07_restaurant.sql`, `concurrence.sh`, `run.sh` ; `tests/admin-rules.test.ts`, `tests/maintenance.test.ts`, `tests/register.mjs`, `tests/alias-hooks.mjs`, `tests/stubs/supabase-server.mjs` (résolution de l'alias `@/` sans dépendance, Node 24).
