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

## Lot 2 : audit de sécurité (`docs/recette/2-securite.md`)

Appliqué sur la base **locale** uniquement, un commit par point.

| Point | Gravité | Correction faite | Fichiers / migration | Commit | Effort |
|---|---|---|---|---|---|
| S-H1 | Haute | `enable_signup = false` dans `[auth]` et `[auth.email]`. Aucun `signUp` dans l'application (comptes créés par l'API admin, non concernée). | `supabase/config.toml` | `ec3741c` | très faible |
| S-M1 | Moyenne | Rôle NULL (compte sans profil) refusé : `v_role is null or v_role not in (...)` et `auth_role() is distinct from 'proprietaire'`. Les 5 fonctions reprises de leur dernière version ; `diff` des définitions en base : seules les 5 lignes de contrôle changent. Aucune autre occurrence du motif (fonctions et politiques vérifiées). | `supabase/migrations/20260930210000_role_absent_refuse.sql` | `367a756` | faible |
| S-M2 | Moyenne | Contrainte `users_proprietaire_tous_restaurants` (propriétaire implique `all_restaurants`). `normaliserAcces` force « tous les restaurants » pour le rôle propriétaire dans `creerCompte` et `modifierCompte` ; `checkAssignment` refuse un propriétaire limité ; le formulaire coche et grise la case, avec une ligne d'aide. | `supabase/migrations/20260930210100_proprietaire_tous_restaurants.sql` ; `lib/admin-rules.ts`, `lib/admin.ts`, `app/(app)/admin/actions.ts`, `components/app/admin/user-form.tsx` ; tests (voir note) | `c96aa40` | faible |
| S-B1 | Basse | `peut_intervenir` exige `has_restaurant(p_restaurant)`. Exécution retirée à `public` et `anon` sur les 12 fonctions d'aide et d'écriture (`authenticated` conservé pour les RLS). Vérifié par `has_function_privilege`. | `supabase/migrations/20260930210200_fonctions_aide_restreintes.sql` | `844b860` | très faible |
| S-B3 | Basse | À la déconnexion, le navigateur retire son propre jeton (`oublierAppareil`) puis invalide son jeton Firebase, avant `signOut`. Les autres appareils du compte restent. Logique partagée avec « Couper ». | `lib/push-appareil.ts` (nouveau), `components/app/nav.tsx`, `components/app/notifications/push-toggle.tsx`, `lib/auth-actions.ts` | `865bd48` | faible |
| S-B6 / S-B7 | Basse | `mouvement_stock` refuse la raison « intervention » (la clôture écrit son mouvement elle-même, sans passer par cette fonction) et une livraison négative. `noter_entretien_fait` refuse une date future. Un éditeur ne gère plus un compte sans restaurant (`canManage`). | `supabase/migrations/20260930210300_stock_et_entretien_coherents.sql` ; `lib/admin-rules.ts`, `tests/admin-rules.test.ts` | « Recette S-B6 / S-B7 » (dernier commit du lot) | très faible |

**Note sur les tests modifiés (S-M2)** : la fixture contenait un propriétaire limité à R1 (`prop1`), que la contrainte interdit. `prop1` devient « tous les restaurants » (sans ligne `user_restaurants`). Attentes ajustées : `04_droits.sql` (prop1 autorisé aussi sur R2 pour les actions de son rôle, et voit un compte de R2), `06_notifications.sql` (prop1 reçoit aussi les alertes de R2 : 4 destinataires au lieu de 3), `07_restaurant.sql` (le test « propriétaire limité : copie d'un restaurant inaccessible refusée » n'a plus d'objet ; remplacé par « propriétaire limité refusé par la base », erreur 23514). `tests/admin-rules.test.ts` : 3 tests ajoutés (S-M2 et S-B7).

**Résultat** : `bash supabase/tests/run.sh` : **464 réussis / 0 échoué** (461 avant le lot ; +3 tests de règles pures). `npx tsc --noEmit` et `npm run lint` sur les fichiers touchés : sans erreur.

## Reporté

- **CAPTCHA** (S-M3) : proposé pour plus tard (Cloudflare Turnstile, gratuit, `captchaToken` dans le formulaire de connexion). Reporté par le développeur.
- **S-B2** : secret d'appel de l'Edge Function `envoyer-notification`.
- **S-B4** : expiration et révocation du mot de passe temporaire.
- **S-B8** : journal des actions d'administration, réinitialisation entre éditeurs.
- **S-B5** : `safeLink` et `/\`.
- **S-B9** : en-têtes de sécurité, `server-only`, validation des entrées, fichiers `.env` inutiles.

## Migrations à pousser sur la base hébergée après accord

Non poussées. `supabase db push` à lancer par le développeur, dans l'ordre :
`20260930200000`, `20260930200100`, `20260930200200`, `20260930200300`, `20260930210000`, `20260930210100`, `20260930210200`, `20260930210300`.

Avant `20260930210100`, vérifier en lecture seule sur l'hébergé que `select count(*) from users where role = 'proprietaire' and not all_restaurants;` renvoie 0 (sinon la contrainte échoue sans rien modifier).
