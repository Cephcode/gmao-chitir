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
| S-B6 / S-B7 | Basse | `mouvement_stock` refuse la raison « intervention » (la clôture écrit son mouvement elle-même, sans passer par cette fonction) et une livraison négative. `noter_entretien_fait` refuse une date future. Un éditeur ne gère plus un compte sans restaurant (`canManage`). | `supabase/migrations/20260930210300_stock_et_entretien_coherents.sql` ; `lib/admin-rules.ts`, `tests/admin-rules.test.ts` | `e47986f` | très faible |

**Note sur les tests modifiés (S-M2)** : la fixture contenait un propriétaire limité à R1 (`prop1`), que la contrainte interdit. `prop1` devient « tous les restaurants » (sans ligne `user_restaurants`). Attentes ajustées : `04_droits.sql` (prop1 autorisé aussi sur R2 pour les actions de son rôle, et voit un compte de R2), `06_notifications.sql` (prop1 reçoit aussi les alertes de R2 : 4 destinataires au lieu de 3), `07_restaurant.sql` (le test « propriétaire limité : copie d'un restaurant inaccessible refusée » n'a plus d'objet ; remplacé par « propriétaire limité refusé par la base », erreur 23514). `tests/admin-rules.test.ts` : 3 tests ajoutés (S-M2 et S-B7).

**Résultat** : `bash supabase/tests/run.sh` : **464 réussis / 0 échoué** (461 avant le lot ; +3 tests de règles pures). `npx tsc --noEmit` et `npm run lint` sur les fichiers touchés : sans erreur.

## Lot 3 : sécurité, suite du rapport 2

Appliqué sur la base **locale** uniquement, une migration et un commit.

| Point | Correction faite | Fichiers / migration | Commit |
|---|---|---|---|
| Lecture sans profil | Les 5 politiques `using (true)` réelles (vérifiées dans `pg_policies`) : `categories_select`, `brands_select`, `parts_select`, `part_compat_select`, `stock_movements_select` passent à `using (auth_role() is not null)`. Un compte Auth sans ligne dans `users` ne lit plus rien. Plus aucune politique `qual = 'true'`. | `supabase/migrations/20260930220000_lecture_reservee_aux_profils.sql` | `05a2356` |
| Création directe de restaurant | `restaurants_insert` supprimée. Aucun code n'insère dans `restaurants` (vérifié) : l'écran passe par `ajouter_restaurant`. | idem | `05a2356` |
| Droits par défaut | `alter default privileges ... revoke execute on functions from public, anon` : **toute nouvelle fonction appelée par l'application ou une politique doit porter `grant execute ... to authenticated`** (rappel en tête de la migration). Tables et séquences : `anon` perd ses droits, existants et futurs. Toutes les politiques visent `authenticated` et l'application ne lit la base qu'après connexion, donc rien ne change pour elle ; c'est une seconde barrière qui masque aussi la structure des tables à la clé publique. Le cron (dans Postgres, rôle `postgres`) et la clé de service ne sont pas concernés. | idem | `05a2356` |

**Tests ajoutés** : `04_droits.sql`, compte sans profil refusé sur pièces, mouvements, catégories, marques, liens pièce-machine et machines (6) ; `07_restaurant.sql`, création directe par un propriétaire refusée (1). Avant la migration, 5 de ces asserts échouaient (preuve qu'ils testent bien le changement).

**Résultat** : `bash supabase/tests/run.sh` : **471 réussis / 0 échoué** (464 + 7).

## Corrections d'interface (`docs/recette/3-conformite.md`)

| Point | Correction faite | Fichiers | Commit |
|---|---|---|---|
| B1 / C1 | Écrans d'erreur et de chargement (fait hors agent). | `app/(app)/error.tsx`, les `loading.tsx` de `(app)`, équipements, interventions, notifications et stock, `components/app/loading-state.tsx`, `app/globals.css` | `8b6fac1` |
| Menu latéral | Menu fixe et défilant sur ordinateur (fait hors agent). | `components/app/nav.tsx`, `app/(app)/layout.tsx` | `ea397e4` |
| Notifications | Liste lisible entre 1024 et 1280 px (fait hors agent). | `app/(app)/notifications/page.tsx` | `6861761` |
| C7 | Focus visible : constantes partagées `focusHalo` et `focusHaloInset` (liseré orange et halo `--color-orange-selected`, maquette p02) dans `components/ui/field.tsx`, reprises par `TextInput` et les 7 champs faits à la main. | `components/ui/field.tsx`, `panne/declare-form.tsx`, `equipements/equipment-form.tsx`, `stock/part-form.tsx`, `interventions/closing-form.tsx`, `restaurant-select.tsx`, `url-filters.tsx` | `421a6cb` |
| C4 | Interrupteurs de Mes alertes : zone cliquable de 44 px (piste 52 x 32 px inchangée), piste éteinte bordée de `--color-border-strong` (3,9:1). | `components/app/notifications/alert-settings.tsx` | `e2eb79e` |
| C3 / C5 / C6 | Cibles de 44 px : « Afficher le mot de passe » (texte au même endroit grâce aux marges négatives) ; puces de filtre et contrôle segmenté `h-11 lg:h-10` ; liens vers les machines (fiche pièce) et boutons « Retirer » (formulaire pièce) : zone de 44 px sur mobile autour d'une puce visible de 32 px, espacement vertical des lignes de puces réduit en conséquence. | `app/connexion/page.tsx`, `components/app/url-filters.tsx`, `components/ui/segmented-control.tsx`, `components/app/stock/part-sheet.tsx`, `components/app/stock/part-form.tsx` | `1aa5631` |
| C8 | Composant `SheetTitle` : `h1` sur mobile (fiche en page entière), `h2` sur ordinateur (la liste porte le `h1`), un seul affiché. Fiches équipement, intervention et pièce. | `components/app/sheet-title.tsx` (nouveau) et les 3 fiches | `f9a543a` |

## Reporté

- **CAPTCHA** (S-M3) : proposé pour plus tard (Cloudflare Turnstile, gratuit, `captchaToken` dans le formulaire de connexion). Reporté par le développeur.
- **S-B2** : secret d'appel de l'Edge Function `envoyer-notification`.
- **S-B4** : expiration et révocation du mot de passe temporaire.
- **S-B8** : journal des actions d'administration, réinitialisation entre éditeurs.
- **S-B5** : `safeLink` et `/\`.
- **S-B9** : en-têtes de sécurité, `server-only`, validation des entrées, fichiers `.env` inutiles.
- **C2** : colonne de présentation de la page de connexion sur ordinateur (maquette p25).
- **Rapport 3, autres détails** : points non traités ci-dessus (dont D5, couleurs en dur hors tokens et `#D6CBBB` au lieu de `var(--color-ring)`).
- **« Rester connecté »** sur la page de connexion.

## Migrations poussées sur la base hébergée

Poussées le 2026-09-30 par le développeur (`supabase db push`), local et hébergé alignés (`supabase migration list`) :
`20260930200000`, `20260930200100`, `20260930200200`, `20260930200300`, `20260930210000`, `20260930210100`, `20260930210200`, `20260930210300`, `20260930220000`.

Vérifié avant la poussée, en lecture seule sur l'hébergé : `select count(*) from users where role = 'proprietaire' and not all_restaurants;` a renvoyé 0.
