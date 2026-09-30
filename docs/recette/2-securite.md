# Recette 2 : audit de sécurité

Agent `cybersecurite`, branche `staging` (`git diff main..staging`), 2026-09-30. Lecture du code, puis vérifications sur la base **locale** en transactions annulées (`pg_proc`, `pg_policies`, `column_privileges`, scénarios avec la fixture de `supabase/tests/`). Aucune écriture sur la base hébergée ni aucun appel à l'Edge Function hébergée. Aucune valeur de secret lue. Aucun code modifié.

## Bilan

| Gravité | Nombre | Points |
|---|---|---|
| Critique | 0 | |
| Haute | 1 | S-H1 inscription libre |
| Moyenne | 3 | S-M1 rôle NULL, S-M2 propriétaire limité, S-M3 tentatives de connexion |
| Basse | 9 | S-B1 à S-B9 |

Corrections H1, M1, M2 et B1 du rapport 1 (migrations `20260930200000` à `20260930200300`) : **correctes et complètes** (détail en fin de rapport).

## Haute

**S-H1. Inscription libre : n'importe qui peut obtenir un compte « authenticated ».**
`supabase/config.toml:175` et `:220` (`enable_signup = true`), à vérifier aussi sur l'hébergé (réglage par défaut : activé). La clé publishable est dans le bundle JS.
- Attaque : `POST https://<projet>.supabase.co/auth/v1/signup` avec la clé publishable et une adresse quelconque, puis requêtes PostgREST avec le jeton obtenu.
- Impact : lecture de toutes les tables en `using (true)` (`20260929181001_rls.sql:108, 116, 187, 195-196, 205-206`) : pièces (noms, quantités, seuils, notes), mouvements de stock (identifiants de comptes et d'interventions), catégories, marques, « va avec » (identifiants de machines de tous les restaurants). Vérifié en local : un compte sans profil lit `parts`, `categories`, `stock_movements`. Il ouvre aussi la porte à S-M1. Les données des restaurants restent protégées (`has_restaurant` vaut faux).
- Correction : désactiver l'inscription (console Supabase, Authentication, « Allow new users to sign up » : off ; et `enable_signup = false` dans `config.toml`, sections `[auth]` et `[auth.email]`). L'application crée les comptes par `auth.admin.createUser` (clé de service), non concerné. En complément, remplacer `using (true)` par `using (auth_role() is not null)`. Effort : très faible.

## Moyenne

**S-M1. Les contrôles de rôle laissent passer un rôle NULL (compte sans profil).**
`v_role not in (...)` vaut NULL quand `auth_role()` est NULL, donc le `raise` ne part pas :
`20260930170000_notifications_titres_et_taches.sql:255` (`mouvement_stock`), `20260930150000_ajouter_restaurant.sql:31` (`auth_role() <> 'proprietaire'`), `20260930200200_cloture_verifie_intervenant.sql:42`, `20260930090000_enregistrer_equipement.sql:104`, `20260929182000_functions.sql:238` (`noter_entretien_fait`).
- Attaque (avec S-H1) : `select mouvement_stock('<pièce>', -9, 'ajustement')` ou `select ajouter_restaurant('X', 'PIR')`.
- Constaté en local : le contrôle de rôle est franchi ; seules les clés étrangères (`stock_movements.user_id`, `user_restaurants.user_id` vers `users`) font échouer l'écriture. Les trois autres fonctions sont arrêtées par `has_restaurant`. Protection par accident, fragile (un `user_id` rendu facultatif suffirait).
- Correction : `if v_role is null or v_role not in (...)` et `if auth_role() is distinct from 'proprietaire'`, dans une migration qui reprend les 5 fonctions. Effort : faible.

**S-M2. Un propriétaire limité à certains restaurants a les pouvoirs d'un propriétaire global dans l'administration.**
`lib/admin-rules.ts:256` (`canManage` : tout propriétaire gère tout le monde), `:270-271` (tout propriétaire peut donner « tous les restaurants »), `app/(app)/admin/actions.ts:148-161` (réinitialisation par le client admin).
- Attaque (propriétaire `all_restaurants = false`, limité à CTR1) : créer un compte « propriétaire, tous les restaurants » dont il reçoit le mot de passe temporaire, ou réinitialiser le mot de passe du propriétaire principal, puis se connecter avec.
- Impact : il sort de la limite que les RLS lui imposent (accès à tous les restaurants, prise de contrôle du compte principal). Latent : aucun propriétaire limité n'existe aujourd'hui, mais le formulaire permet d'en créer.
- Correction, au choix du développeur : (a) un propriétaire a toujours tous les restaurants (contrainte `check (role <> 'proprietaire' or all_restaurants)` et case forcée dans le formulaire), la plus simple ; (b) appliquer au propriétaire limité les limites de l'éditeur pour les restaurants et les comptes « tous restaurants ». Effort : faible.

**S-M3. Limitation des tentatives de connexion insuffisante.**
`app/connexion/actions.ts:31` appelle `signInWithPassword` depuis le serveur Next : Supabase voit l'IP de Vercel, pas celle de l'utilisateur. `supabase/config.toml:206` : 30 connexions par 5 min et par IP, sans verrouillage par compte ni CAPTCHA (`:212-215` commentés).
- Attaque : essais de mots de passe directement sur `/auth/v1/token?grant_type=password` avec la clé publique en changeant d'IP ; ou saturation du quota partagé de l'IP Vercel, qui bloque la connexion des vrais utilisateurs.
- Impact : force brute sur les comptes (mot de passe de 8 caractères minimum côté application, 6 côté Supabase, `config.toml:181`) et déni de connexion.
- Correction : activer le CAPTCHA Supabase Auth (Cloudflare Turnstile, gratuit) et passer `captchaToken` depuis le formulaire ; mettre la longueur minimale à 8 (ou plus) dans Supabase Auth. Effort : moyen.

## Basse

**S-B1. `peut_intervenir` et fonctions d'aide : fuite de la structure d'accès entre restaurants.**
`20260930200000_interventions_colonnes_modifiables.sql:16-30`. Vérifié en local, connecté comme lecteur de R1 : les identifiants de machines et d'interventions de R2 se lisent dans `part_compatibilities` et `stock_movements` (`using (true)`). `equipment_restaurant()` et `intervention_restaurant()` renvoient ensuite l'identifiant de R2. Elles sont exécutables **aussi par `anon`**, faute de `revoke ... from public, anon` (`20260929181001_rls.sql:53`). Enfin, `peut_intervenir('<com2>', '<R2>')` répond `true`.
- Impact : on apprend quel identifiant de compte peut intervenir sur quel identifiant de restaurant, sans nom ni e-mail (`users_select` reste filtré). Faible.
- Verdict : **acceptable en l'état, mais la restriction est gratuite**. Ajouter `and has_restaurant(p_restaurant)` dans `peut_intervenir` : les deux appelants (politique `interventions_update`, `cloturer_intervention`) exigent déjà cet accès, donc rien ne change pour eux. Ajouter aussi `revoke execute on function equipment_restaurant(uuid), intervention_restaurant(uuid), auth_role(), has_restaurant(uuid), shares_restaurant(uuid), prochain_code_equipement(uuid, uuid), declarer_panne(...), cloturer_intervention(...), noter_entretien_fait(...), mouvement_stock(...), enregistrer_equipement(...), ajouter_restaurant(...) from public, anon`. Effort : très faible.

**S-B2. Edge Function `envoyer-notification` sans secret d'appel.**
`supabase/functions/envoyer-notification/index.ts:31-50`, `config.toml:419-420`. La réservation `delivered_at` empêche tout second envoi, et l'identifiant (UUID) est inconnu de l'extérieur. Risque résiduel : appels répétés qui consomment le quota d'invocations (une requête `update` par appel). Contenu des mails bien échappé, lien interne seulement. Le trigger vise l'URL de production en dur (`20260930190000_envoi_notifications.sql:43`) : une base locale avec des comptes appellerait la production (sans effet, id inconnu).
- Correction : en-tête secret envoyé par `net.http_post` (valeur dans Supabase Vault) et vérifié par la fonction ; URL lue depuis le Vault. Effort : faible.

**S-B3. Jetons push : détournement possible et appareil non oublié à la déconnexion.**
`app/(app)/notifications/actions.ts:63` : le client admin supprime le jeton s'il appartient à un autre compte. Qui connaît le jeton FCM d'un autre appareil peut le rattacher à son compte : la victime ne reçoit plus ses push et reçoit ceux de l'attaquant. Ce jeton n'est connu que de l'appareil, d'où la gravité basse. Par les RLS seules, le rattachement est impossible (clé primaire `token`, `update` limité à ses lignes). Surtout, `lib/auth-actions.ts:7-9` (`deconnexion`) n'appelle ni `supprimerJetonPush` ni `oublierAppareil` : sur un téléphone partagé, les notifications du compte précédent (machine, restaurant, description) continuent d'arriver.
- Correction : à la déconnexion, `supprimerJetonPush()` puis `oublierAppareil(token)` côté client avant `signOut`. Effort : faible.

**S-B4. Mot de passe temporaire : bien généré, mais ni expiration ni révocation.**
Génération sûre (`lib/admin.ts:61-65`, `crypto.getRandomValues`, 12 caractères sur 54 symboles, environ 69 bits), affichée une seule fois, jamais stockée ni journalisée. Limites : le changement forcé n'est imposé que par `app/(app)/layout.tsx:16` (l'API Supabase reste utilisable avec le mot de passe temporaire) ; il n'expire pas ; `reinitialiserMotDePasse` (`admin/actions.ts:156`) ne ferme pas les sessions ouvertes du compte ; `secure_password_change = false` (`config.toml:227`).
- Correction : bloquer les écritures tant que `must_change_password` est vrai (condition dans `auth_role()` ou dans les politiques), ou refuser un mot de passe temporaire de plus de 7 jours ; fermer les sessions à la réinitialisation (`auth.admin.signOut` ou suppression des sessions par SQL). Effort : moyen.

**S-B5. `safeLink` laisse passer `/\exemple.com`.**
`lib/notifications.ts:99` et `index.ts:52` : les navigateurs lisent `/\` comme `//`, ce qui donne une redirection externe. Pas exploitable aujourd'hui : `link` n'est écrit que par les fonctions SQL (plus modifiable en direct depuis la migration `20260930200300`).
- Correction : refuser `\` et les caractères de contrôle, ou comparer `new URL(link, base).origin`. Effort : très faible.

**S-B6. `mouvement_stock` accepte une raison incohérente.**
`20260930170000_notifications_titres_et_taches.sql:236-260`. Vérifié en local : un éditeur peut appeler en direct avec `reason = 'intervention'` sans intervention, ou `'livraison'` avec un delta négatif. L'action serveur filtre, la fonction non. L'historique du stock devient trompeur.
- Correction : refuser `'intervention'` (réservée à la clôture) et un signe contraire à la raison. Effort : très faible.

**S-B7. Observations du rapport 1, vues sous l'angle de la sécurité.**
- `noter_entretien_fait` avec une date future (`20260929182000_functions.sql:220-270`) : **basse**. Un commentateur peut repousser l'échéance de plusieurs années et faire taire les alertes de retard. Correction : `p_done_at <= current_date`.
- Éditeur qui gère un compte sans restaurant (`lib/admin-rules.ts:260`) : **basse**. Il peut réinitialiser le mot de passe d'un compte dormant (restaurant supprimé) et l'utiliser sous ce nom. Correction : `target.restaurantIds.length > 0 &&` pour l'éditeur.
- Propriétaire qui insère un restaurant en direct (`20260929181001_rls.sql:87`) : **information**. Code court non validé, restaurant invisible pour un propriétaire limité. Correction : supprimer la politique `restaurants_insert` (tout passe par `ajouter_restaurant`).
- Création de pièce en deux appels (`app/(app)/stock/actions.ts:55-59`) : aucun risque de sécurité (quantité toujours égale à la somme des mouvements).

**S-B8. Délégation entre pairs et traçabilité.**
Un éditeur peut réinitialiser le mot de passe d'un autre éditeur de ses restaurants (`admin/actions.ts:148-161`) et agir sous son nom. Il n'obtient aucun droit en plus, mais l'usurpation est possible. Seule la création est tracée (`created_by`), pas les modifications, réinitialisations ou suppressions. Le contrôle « au moins un propriétaire » (`admin/actions.ts:126, 169`) est lu puis écrit sans verrou : deux propriétaires qui se rétrogradent en même temps peuvent n'en laisser aucun.
- Correction : réserver au propriétaire la réinitialisation d'un compte éditeur ; table de journal des actions d'administration. Effort : faible à moyen.

**S-B9. Défense en profondeur.**
- `next.config.ts` : aucun en-tête de sécurité (CSP, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`). L'administration peut être affichée dans un cadre (clickjacking).
- `lib/supabase/admin.ts` : pas d'`import "server-only"`. Aucun import côté client aujourd'hui (vérifié), mais rien ne l'empêche à la compilation.
- Actions serveur : entrées typées en TypeScript seulement (pas de validation de schéma à l'exécution), longueurs non bornées (description de panne, prénom, notes, symptômes).
- `anon` et `authenticated` ont EXECUTE sur `net.http_post` : inaccessible tant que le schéma `net` n'est pas exposé par l'API (`config.toml:13`), à garder ainsi.
- `.env.development.local` et `.env.development.local.avant-correction` contiennent des secrets inutiles à Next (clé Resend, compte de service Firebase, mot de passe de la base, `CRON_SECRET` obsolète). Ils sont ignorés par git, mais à supprimer (copie `avant-correction`) et à ne pas recopier dans Vercel.
- Effort : faible pour chacun.

## Vérifié sans problème

- RLS activées sur les 17 tables de `public` ; aucune politique pour `anon`.
- Les 19 fonctions `SECURITY DEFINER` ont `search_path = public, pg_temp` (`public, extensions, pg_temp` pour le trigger).
- `taches_quotidiennes`, `code_categorie_libre`, `envoyer_notification_trigger` : non exécutables par `anon` ni `authenticated`.
- Toutes les fonctions d'écriture refusent l'anonyme (`auth.uid()` NULL) et retrouvent le restaurant via l'équipement ou l'intervention, jamais via un paramètre, sauf `declarer_panne` sans machine, où le restaurant passé est contrôlé par `has_restaurant`.
- H1 corrigée : `interventions` n'est modifiable en direct que sur `work_done` et `assigned_to` ; `with check` avec `peut_intervenir` ; INSERT et DELETE sans politique, donc refusés.
- M1 corrigée : `parts` modifiable en direct seulement sur `code, name, unit, min_threshold, notes` ; insertion imposée à `quantity = 0`.
- M2 corrigée : `cloturer_intervention` (dernière version, `20260930200200`) identique à la précédente, plus le contrôle `peut_intervenir` ; même signature et mêmes droits.
- B1 corrigée : `notifications` modifiable en direct seulement sur `read_at` ; INSERT et DELETE sans politique.
- `peut_intervenir` : `search_path` fixé, `revoke` de `public` et `anon` explicite, ce qui compte sur l'hébergé où les privilèges par défaut donnent tout à `anon`.
- Actions admin : acteur relu en base (`getActor`, `lib/admin.ts:19-38`) et cible relue par le client admin avant toute écriture ; délégation de l'éditeur (jamais propriétaire ni « tous les restaurants », ses restaurants seulement) ; pas de changement de son propre rôle ; trace `created_by`.
- `changerMotDePasse` et `seConnecter` : le client admin n'écrit que sur la ligne de l'utilisateur vérifié par `getUser()`.
- `reglerAlerte` (type sur liste blanche) et `ouvrirNotification` passent par les RLS.
- Mails : titre, corps, adresse et lien échappés (`escapeHtml`) ; sujet envoyé en JSON (pas d'injection d'en-tête) ; push en texte brut ; aucune donnée personnelle dans les journaux.
- Notifications : panne, urgence et entretiens envoyés à l'équipe du restaurant seulement ; réparation au déclarant ; stock bas aux propriétaires et éditeurs (stock commun à tous, pas de fuite).
- Tableau de bord : lu avec le client de l'utilisateur, donc filtré par les RLS.
- XSS : aucun `dangerouslySetInnerHTML`, `photo_url` jamais affichée, liens internes construits par l'application.
- CSRF : actions serveur Next (vérification de l'Origin intégrée), pas de route API en écriture ; `proxy.ts` utilise `getUser()`, pas `getSession()`.
- Secrets : `.env*` ignorés (`.gitignore:34`) ; aucun `.env` ni clé dans l'historique git (recherche des motifs `sb_secret_`, `re_`, `PRIVATE KEY`, JWT : 0) ; seules les variables publiques Supabase et Firebase portent le préfixe `NEXT_PUBLIC_` ; `SUPABASE_SECRET_KEY` n'est lue que dans `lib/supabase/admin.ts` ; le compte de service Firebase et la clé Resend ne sont lus que dans l'Edge Function.
- Dépendances : `npm audit --omit=dev` n'annonce aucune vulnérabilité ; le paquet piège `supabase-js@0.0.1-security` de `main` est retiré.
- Messages de connexion identiques pour e-mail inconnu et mauvais mot de passe (pas d'énumération).

## À vérifier par le développeur dans les consoles

**Supabase (projet hébergé)**
1. Authentication, Sign In / Providers : « Allow new users to sign up » **désactivé** (S-H1) ; « Confirm email » activé ; connexion anonyme désactivée.
2. Authentication, Attack Protection : CAPTCHA (Turnstile) activé (S-M3) ; longueur minimale du mot de passe 8 ou plus ; « Secure password change » activé.
3. Authentication, Rate Limits : relever les valeurs de connexion et de vérification.
4. Authentication, URL Configuration : Site URL = URL Vercel de production ; Redirect URLs sans joker trop large.
5. API Settings : schémas exposés = `public` et `graphql_public` seulement (pas `net`, `cron`, `extensions`).
6. Après `supabase db push` des 4 migrations : lancer « Advisors > Security » ; relire `column_privileges` de `interventions`, `parts` et `notifications` (en lecture).
7. Edge Functions, Secrets : `RESEND_TEST_RECIPIENT` à **supprimer** dès que le domaine est vérifié (en mode test, tous les mails de tous les restaurants vont dans une seule boîte).
8. Database, Extensions, pg_cron : un seul job `gmao-taches-quotidiennes`.

**Vercel**
9. Variables : `SUPABASE_SECRET_KEY` sans préfixe `NEXT_PUBLIC_`, en « Sensitive » ; aucune clé Resend ni Firebase de service ni mot de passe de base (inutiles à Next) ; `CRON_SECRET` obsolète à retirer.
10. Deployment Protection : prévisualisations `staging` protégées si elles pointent sur la base de production.

**Resend**
11. Domaine d'envoi vérifié (SPF, DKIM, DMARC) et `RESEND_FROM` sur ce domaine ; clé API restreinte à « Sending access ».

**Firebase / Google Cloud**
12. Compte de service limité au rôle d'envoi FCM (pas « Owner » ni « Editor ») ; clé API web restreinte aux domaines de l'application (référents HTTP) et aux API nécessaires.

## Corrections recommandées, par priorité

| # | Point | Correction | Effort |
|---|---|---|---|
| 1 | S-H1 | Désactiver l'inscription (console + `config.toml`) | très faible |
| 2 | S-M1 | `v_role is null or ...` dans les 5 fonctions (une migration) | faible |
| 3 | S-M2 | Propriétaire toujours « tous les restaurants » (contrainte + formulaire) | faible |
| 4 | S-B1 | `has_restaurant(p_restaurant)` dans `peut_intervenir` ; `revoke ... from public, anon` sur les fonctions | très faible |
| 5 | S-M3 | CAPTCHA Supabase Auth + longueur minimale 8 | moyen |
| 6 | S-B3 | Oublier l'appareil à la déconnexion | faible |
| 7 | S-B6, S-B7 | Raison du mouvement, date d'entretien, compte sans restaurant, `restaurants_insert` | très faible |
| 8 | S-B2 | Secret d'appel de l'Edge Function (Vault) | faible |
| 9 | S-B4, S-B8 | Blocage tant que le mot de passe n'est pas changé, sessions fermées à la réinitialisation, journal admin | moyen |
| 10 | S-B5, S-B9 | `safeLink` strict, en-têtes, `server-only`, validation d'entrée | faible |
