# Journal des décisions

Une entrée par décision : date, décision, raison, ce qui a été écarté.

## 2026-09-29 · Système de design (fondations et composants)
- **Décision** : tokens de couleur, typographie (Poppins/Figtree), rayons et cibles tactiles dans `app/globals.css` (Tailwind v4) ; composants réutilisables dans `components/ui` (Button, StatusBadge, Card, Field, SegmentedControl, Alert) + registre d'icônes.
- **Raison** : reprendre l'identité de l'enseigne, contrastes WCAG déjà calculés.
- **Écarté** : tableau, navigation et combobox (construits avec leurs écrans, car liés au routage et aux données).

## 2026-09-29 · Ordre de travail
- **Décision** : construire la base de données et la logique métier avant le front-end.
- **Raison** : demande du développeur, pour figer le modèle avant l'UI.

## 2026-09-29 · Modèle de données et rôles
- **Rôles** : proprietaire, editeur, commentateur, lecteur. Le commentateur est le **technicien** (modifie et clôture les interventions, note un entretien, déclare une panne ; ne crée ni équipement, ni pièce, ni intervention). Pas de rôle « responsable technique » séparé (c'est un éditeur). Détail dans `docs/modele-donnees-proposition.md`.
- **Commentaires** : fonctionnalité retirée (aucune table `comments`, ni type d'événement ou de notification associé).
- **Stock** : global et partagé par toute la chaîne (pas de `restaurant_id` sur `parts`).
- **Interventions** : types normal, urgence, alerte. La déclaration de panne ne crée que normal ou urgence.
- **Comptes** : mot de passe temporaire généré, changement obligatoire à la première connexion. Le propriétaire crée partout, l'éditeur uniquement dans ses restaurants et jamais un propriétaire. Écarté : table `invitations` à jeton. La création de comptes se fera **côté application** (service role + API admin Supabase), pas via une fonction SQL.
- **Photo de panne** : colonne `photo_url` gardée (nullable), branchement de l'upload à décider.

## 2026-09-29 · Sécurité (RLS)
- **Décision** : le restaurant décide des données visibles, le rôle décide des actions. RLS activées sur toutes les tables. Les écritures multi-tables (déclarer, clôturer, entretien, stock) passent par des fonctions `SECURITY DEFINER` qui vérifient rôle et accès. Suppression d'un équipement en cascade sur ses interventions, entretiens et fiche de vie.
- **Vérifié** : base locale (Docker), tests RLS (accès autorisés et refusés par rôle et par restaurant) et tests des fonctions (scénarios de bout en bout, notifications, stock) tous au vert. Migrations : `supabase/migrations/`.

## 2026-09-29 · Import des équipements
- **Décision** : migration `20260929183000_seed_equipements.sql` créant les 2 restaurants (CTR1 « Chitir Chicken Ouaga 2000 », CTR2 « Chitir Chicken Kamboinsin »), 6 catégories larges avec code (Réfrigération REF, Cuisson CUI, Climatisation CLI, Vitrine VIT, Ventilation VEN, Boissons BOI) et les 49 équipements de l'Excel.
- **Raison** : données de départ réelles, appliquées une fois via migration (donc aussi sur la base hébergée).
- **Détails** : codes machines conservés tels quels (le segment fin FRG, CNG… reste dans le code, distinct du code de catégorie qui sert à la génération future). État initial opérationnel, pas de plan d'entretien (fréquence « À définir »), marque/série/date vides. Vérifié : 25 CTR1, 24 CTR2, 0 sans catégorie.
- **Base hébergée** : les 4 migrations ont été poussées sur le projet GMAO-CHITIR (`jmxeewnhthhlutqgeixj`, eu-west-1) le 2026-09-29 après feu vert. `supabase migration list` confirme local et remote alignés. Le développement se fera désormais sur la base hébergée.

## 2026-09-29 · Connexion et session (étape 2a/2b)
- **Décision** : `@supabase/ssr` avec 3 clients (`lib/supabase/client.ts` navigateur, `server.ts` serveur, `admin.ts` service role serveur seulement). Session gérée par cookies via `proxy.ts` (le middleware renommé en Next 16, runtime Node). Connexion en une étape (e-mail ou téléphone + mot de passe), changement de mot de passe obligatoire à la première connexion (`app/changer-mot-de-passe`), garde de session dans le layout `app/(app)`.
- **Correctif** : `NEXT_PUBLIC_SUPABASE_URL` dans `.env.development.local` contenait `/rest/v1/` en trop, ce qui cassait toutes les requêtes. Corrigé en URL de base `https://jmxeewnhthhlutqgeixj.supabase.co`.
- **Premier compte** : propriétaire Sylvester NANA (sylvesternana@gmail.com) créé via service role, `all_restaurants=true`, `must_change_password=true` (changera son mot de passe à la première connexion).
- **Vérifié** : connexion API (email+mdp) OK, RLS → propriétaire voit 49 équipements et 2 restaurants ; `next build` OK ; proxy redirige `/` vers `/connexion` si non connecté.
- **À faire déploiement** : renseigner les variables `NEXT_PUBLIC_SUPABASE_*` et `SUPABASE_SECRET_KEY` dans l'hébergeur (le build de prod ne lit pas `.env.development.local`).

## 2026-09-29 · Correctif boucle « changer le mot de passe »
- **Cause** : la table `users` n'a pas de politique RLS d'écriture (voulu). Les mises à jour `must_change_password = false` et `last_seen_at` faites avec le client de l'utilisateur étaient ignorées sans erreur (0 ligne), d'où la boucle.
- **Correctif** : ces deux écritures passent par le client admin (service role), uniquement après vérification de l'identité côté serveur et limitées à la ligne de l'utilisateur. Drapeau remis à faux sur le compte de Sylvester NANA (mot de passe déjà changé).
- **Règle** : toute écriture sur `users` / `user_restaurants` se fait côté serveur avec le client admin, jamais depuis le navigateur.

## 2026-09-29 · Coquille et tableau de bord global (étape 2c)
- **Décision** : coquille dans `app/(app)/layout.tsx` : menu latéral ordinateur (Déclarer une panne en tête, badges urgences et non lues, Administration pour le propriétaire, utilisateur et déconnexion en bas), barre du bas mobile (4 onglets) et bouton flottant « Déclarer une panne ». Tableau de bord `/` branché sur la base : 4 indicateurs (teintés seulement si non nuls), « À traiter en priorité », « Par restaurant », et sur ordinateur « Entretiens des 7 jours » et « Stock sous le seuil ». Sélecteur de restaurant via `?restaurant=CODE`.
- **Provisoire** : pages d'attente pour Équipements, Interventions, Stock, Notifications, Déclarer une panne, Administration. « Ajouter un restaurant » viendra avec l'administration. Le badge du type `alerte` est neutre.
- **Vérifié** : rendu connecté (200), propriétaire voit 0 / 49 machines en panne, CTR1 25 et CTR2 24 équipements, filtre CTR1 → 0 / 25 ; `next build` OK.

## 2026-09-29 · Équipements : liste et fiche (étape 1a)
- **Décision** : `/equipements` (liste) et `/equipements/[id]` (fiche). Filtres dans l'URL (`q`, `restaurant`, `categorie`, `etat` dont `pas_operationnel`, `entretien` : `en_retard`, `a_jour`, `a_definir`), appliqués côté serveur en mémoire (49 équipements). Tri fixe « pannes d'abord ». Sur ordinateur, la fiche s'ouvre en panneau à droite de la liste (onglets Infos / Historique via `?onglet=`) ; sur mobile, page entière avec fiche de vie limitée à 4 événements (`?historique=tout`).
- **Statut d'entretien** : calculé (`maintenanceOf` dans `lib/equipements.ts`), jamais stocké : à définir (sans échéance), à jour, en retard (avec le nombre de jours).
- **Noter l'entretien** : action serveur qui appelle `noter_entretien_fait` (rôle et restaurant vérifiés en SQL). Bouton visible pour propriétaire, éditeur, commentateur, y compris sans plan (l'entretien est alors inscrit dans la fiche de vie).
- **Écarté** : commentaires (hors périmètre). « Ajouter une intervention » et « Déclarer une panne sur cette machine » viendront avec les étapes Interventions et Panne ; « Modifier » et « Ajouter un équipement » avec l'étape 1b.

## 2026-09-30 · Équipements : ajout, modification, suppression (étape 1b)
- **Décision** : migration `20260930090000_enregistrer_equipement.sql`. `enregistrer_equipement` (SECURITY DEFINER, propriétaire et éditeur, restaurant vérifié, y compris l'ancien restaurant en cas de déplacement) crée ou modifie en une transaction : équipement, catégorie ou marque créées à la volée (nom identique réutilisé), plan d'entretien, événement de fiche de vie (« Équipement ajouté », « Informations modifiées » ou « État : A → B »).
- **Code automatique** : `prochain_code_equipement` propose `CTR2-REF-05` (code restaurant, code catégorie, plus grand numéro + 1 ; `EQP` sans catégorie). La maquette montre `CTR2-FRG-06` : on suit la décision du 29/09 (code catégorie). Convention validée par le développeur le 2026-09-30 (plus logique et extensible que l'ancien segment basé sur le nom). Code modifiable ; un code en double est refusé (message clair). Code d'une nouvelle catégorie : 3 lettres sans accent (`code_categorie_libre`, non appelable directement).
- **Échéance** : sans entretien noté, première échéance = aujourd'hui + fréquence ; changement de fréquence = recalcul depuis le dernier entretien. Sans fréquence choisie, le plan existant n'est pas modifié.
- **Suppression** : propriétaire seulement (RLS), confirmation obligatoire, cascade sur interventions, entretiens et fiche de vie.
- **Vérifié** : 10 scénarios SQL en local (code auto, catégorie réutilisée, échéances, refus lecteur, restaurant non autorisé, code en double, nom vide) ; `next build` OK.
- **Base hébergée** : migration poussée le 2026-09-30 après feu vert (local et remote alignés).

## 2026-09-30 · Déclarer une panne (étape 2)
- **Décision** : `/panne` appelle la fonction existante `declarer_panne` (aucune migration). Mobile : plein écran en 2 étapes (machine, puis symptômes et urgence) ; ordinateur : fenêtre modale en 3 blocs. `?equipement=ID` pré-choisit la machine (bouton « Déclarer une panne sur cette machine » de la fiche, tous les rôles). « Je ne trouve pas la machine » : texte libre + restaurant. Confirmation sur `/panne/envoyee/[id]`.
- **Urgence** : pas de valeur par défaut, réponse obligatoire. Symptômes à choix multiple, détail facultatif.
- **Doublon** : si une panne est déjà en cours sur la machine, bandeau d'avertissement avec lien vers l'intervention, l'envoi reste possible (choix du développeur).
- **Écarts maquette** : pas de photo (hors périmètre) ; « Salif, le technicien, est prévenu » devient « L'équipe du restaurant est prévenue » (personne n'est assigné à la déclaration). Mails et push : étape 7.

## 2026-09-30 · Interventions (étape 3)
- **Décision** : `/interventions` (onglets En cours / Terminées / Toutes sur ordinateur, groupes Urgences, Normales, Alertes, filtres restaurant, type, technicien dont « pas encore attribuée ») et `/interventions/[id]` (panneau à droite sur ordinateur, page entière sur mobile). Aucune migration.
- **Clôture** : fonction existante `cloturer_intervention` (ce qui a été fait obligatoire, pièces avec quantité, état après, technicien). Chaque pièce affiche le stock restant et prévient sous le seuil ; pièces prévues pour la machine (« va avec ») en tête ; pièces à 0 non proposées.
- **Enregistrer sans clôturer** : travail en cours et technicien en écriture directe (RLS). Le technicien est revérifié côté serveur : propriétaire, éditeur ou commentateur ayant accès au restaurant.
- **Filtres** : composant générique `components/app/url-filters.tsx` (recherche + puces dans l'URL), partagé avec Équipements.
- **Écart corrigé** (validé le 2026-09-30) : la règle « clôturer met à jour le dernier entretien de la machine (sauf alerte) » n'était pas appliquée. Migration `20260930120000_cloture_met_a_jour_entretien.sql` : si la machine a un plan, dernier entretien = jour de clôture et échéance recalculée ; une ligne est ajoutée au journal d'entretien (même sans plan). Testé en local : clôture normale, alerte (inchangé), machine sans plan, décrément du stock.
- **Base hébergée** : migration du correctif poussée le 2026-09-30 après feu vert.
- **Reporté** : « Nouvelle intervention » / « Ajouter une intervention » (nouvelle fonction SQL, choix du développeur).

## 2026-09-30 · Stock (étape 4)
- **Décision** : `/stock` (pièces sous le seuil en premier, onglets Toutes / Sous le seuil sur mobile, bandeau « N'afficher qu'elles » sur ordinateur, puce « Va avec » par catégorie de machine ou « Toutes machines »), `/stock/[id]` (fiche), `/stock/nouvelle` et `/stock/[id]/modifier`. Aucune migration.
- **Quantités** : ne bougent que par `mouvement_stock` (livraison, correction ±1 avec les boutons − / +) ou par la clôture d'intervention. Une nouvelle pièce est créée à 0 puis son stock initial entre comme une livraison, pour que la quantité reste la somme des mouvements (deux appels : si le second échoue, message demandant de saisir une livraison).
- **Va avec / utilisée sur** : « va avec » = machines prévues, saisies dans le formulaire (`part_compatibilities`, limité aux machines des restaurants de l'utilisateur) ; « utilisée sur » = déduit des pièces des interventions, avec les quantités. Affichés séparément.
- **Suppression** : propriétaire seulement ; refusée si la pièce a servi dans une intervention (historique conservé).

## 2026-09-30 · Notifications (étape 5)
- **Décision** : `/notifications` (groupées par jour ; catégories Urgences, Pannes, Entretiens, Stock, Réparations sur ordinateur ; onglets Toutes / Non lues sur mobile ; « Tout marquer comme lu ») et « Mes alertes » (colonne de droite sur ordinateur, `/notifications/alertes` sur mobile). Aucune migration, RLS : chacun ne lit et ne règle que les siennes.
- **Voir** : action serveur qui marque comme lue puis redirige vers le lien, seulement s'il est interne (`safeLink`, pas de redirection vers un autre site).
- **Mes alertes** : un interrupteur par type (activé par défaut, ligne `notification_settings` créée au premier changement). « Commentaires » retiré (hors périmètre). Les entretiens à prévoir / en retard seront produits par la tâche quotidienne (étape 7).
- **À proposer** : titres plus parlants (« Urgence : Grande friteuse 2 portes, CTR1 » au lieu de « Urgence déclarée »), ce qui demande de modifier les fonctions SQL.

## 2026-09-30 · Administration (étape 6)
- **Accès** (choix du développeur) : propriétaire et éditeur. L'éditeur ne voit que l'onglet Utilisateurs, et ne gère que les comptes éditeur, commentateur ou lecteur dont tous les restaurants sont les siens ; il ne crée jamais de propriétaire ni d'accès « tous les restaurants ». Restaurants : propriétaire seul. Garde dans `app/(app)/admin/layout.tsx`, règles pures dans `lib/admin-rules.ts` (testées : 5 scénarios), revérifiées dans chaque action serveur.
- **Comptes** : création avec mot de passe temporaire (12 caractères sans ambiguïté) affiché une seule fois à la personne qui crée, ni stocké ni journalisé ; changement obligatoire à la première connexion. Écritures `users` / `user_restaurants` et API d'authentification avec le client admin, après relecture de l'acteur en base. Profil en échec = compte d'authentification supprimé (pas de compte à moitié créé). Fiche : rôle, restaurants, nouveau mot de passe temporaire, suppression. Garde-fous : pas de changement de son propre rôle ou accès, pas de suppression de soi, toujours au moins un propriétaire.
- **Identifiant** : e-mail uniquement (décision du 2026-09-30) : la connexion par téléphone est abandonnée, car activer le fournisseur « Phone » de Supabase demande un fournisseur SMS payant au-delà des crédits gratuits (Twilio). `lib/identifiant.ts` normalise l'e-mail de la même façon à la création et à la connexion. La colonne `users.phone` reste en base, inutilisée.
- **Restaurants** : migration `20260930150000_ajouter_restaurant.sql`, fonction `ajouter_restaurant` (propriétaire, code court 2 à 6 caractères, une transaction) avec copie facultative de la liste d'un restaurant : codes régénérés (CTR1-FRG-01 → CTR3-FRG-01), machines opérationnelles, plans repris sans historique, pièces « va avec » reprises. Testée en local (5 scénarios).
- **Mobile** : lien Administration en bas du tableau de bord (la barre du bas n'a que 4 onglets).
- **Base hébergée** : migration `ajouter_restaurant` poussée le 2026-09-30 après feu vert.

## 2026-09-30 · Titres des notifications et tâche quotidienne (étape 7a)
- **Architecture de l'étape 7** (choix du développeur) : tâche du matin en SQL planifiée par pg_cron dans Supabase ; envoi mail et push par une Edge Function déclenchée à chaque notification (7b) ; push dans l'application (7c). Écarté : routes Next + cron Vercel.
- **Titres** : « Urgence : Grande friteuse 2 portes, CTR1 » / « Déclarée par Awa · Ne chauffe pas » ; « … réparée, CTR1 » / « Clôturée par Salif · … » ; « … sous le seuil » / « Il reste 2, seuil 5 » (lien vers la fiche pièce). `declarer_panne`, `cloturer_intervention` et `mouvement_stock` reprises à l'identique de leur dernière version, seules ces lignes changent.
- **Tâche quotidienne** : `taches_quotidiennes()` à 7 h UTC (heure de Ouagadougou) via pg_cron : « entretien à prévoir » 3 jours avant, « entretien en retard » chaque matin, pour propriétaires, éditeurs et commentateurs du restaurant, selon leurs réglages ; machines hors service exclues ; au plus une notification par personne, machine, type et jour. Non appelable par les utilisateurs.
- **Vérifié** en local : titres, rappels, réglage coupé respecté, hors service exclu, pas de doublon, planification enregistrée.

## 2026-09-30 · Envoi des notifications : mail et push (étape 7b)
- **Décision** : migration `20260930190000_envoi_notifications.sql` : colonne `notifications.delivered_at`, table `push_tokens` (RLS : chacun ses appareils), trigger `after insert` sur `notifications` qui appelle l'Edge Function `envoyer-notification` via pg_net (asynchrone, rien ne part si la transaction est annulée).
- **Edge Function** (`supabase/functions/envoyer-notification`, `verify_jwt = false`) : réserve la notification en une instruction (`delivered_at`) avant d'envoyer, donc pas de double envoi, et un appel avec un id quelconque ne fait rien : aucun secret n'est nécessaire dans la base. Push Firebase HTTP v1 (jeton OAuth signé avec le compte de service, jetons expirés supprimés) vers tous les appareils ; mail Resend pour urgences et pannes. Aucune donnée personnelle dans les journaux.
- **Mode test Resend** : domaine non vérifié, donc `RESEND_TEST_RECIPIENT` reçoit tous les mails, avec le vrai destinataire indiqué. Ce doit être **l'adresse du compte Resend** (seule autorisée sans domaine vérifié), pas l'adresse de réception `…resend.app` (`RESEND_RECEIVING_EMAIL`, refusée en 403). À retirer (et `RESEND_FROM` à régler) quand le domaine sera vérifié.
- **Compte de service Firebase** : en local, `FIREBASE_SERVICE_ACCOUNT_KEY` est le chemin du fichier JSON (hors dépôt, dossier `secrets`) ; le secret de l'Edge Function contient le contenu du fichier encodé en base64 (le cloud ne lit pas les fichiers locaux).
- **Vérifié le 2026-09-30** : envoi réel depuis l'Edge Function hébergée, « mail envoyé (mode test) ».
- **Liens** : `APP_URL` = https://gmao-chitir.vercel.app.
- **Vérifié** en local : trigger mis en file pg_net, RLS de `push_tokens`, fonction servie par le runtime Deno (réservation, non-répétition, id invalide refusé).
- **Outils** : `supabase/functions` exclu du typage et du lint de Next (code Deno).
- **Déploiement** (2026-09-30, après feu vert) : secrets `RESEND_API_KEY`, `RESEND_TEST_RECIPIENT`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `APP_URL` enregistrés dans Supabase (valeurs jamais affichées), fonction déployée, migration poussée. Test de bout en bout sur la base hébergée : notification réservée par la fonction, second appel sans effet, id invalide refusé.

## 2026-09-30 · Push dans le navigateur (étape 7c)
- **Dépendance** : `firebase` 12.19.0 (validée par le développeur), seul le module messaging est chargé, à la demande (`lib/firebase-client.ts`).
- **Service worker** : `/firebase-messaging-sw.js` généré par une route (configuration Firebase publique injectée, aucune clé secrète), scripts compat de même version depuis gstatic, exclu du proxy de session. En arrière-plan, le SDK affiche la notification et ouvre le lien au clic.
- **Activation** : bouton « Notifications sur cet appareil » dans Mes alertes (ordinateur et mobile) : autorisation du navigateur, jeton FCM enregistré dans `push_tokens` (upsert ; un jeton déjà lié à un autre compte du même navigateur change de propriétaire), « Couper sur cet appareil » supprime le jeton. États gérés : non pris en charge (iPhone hors écran d'accueil), bloqué, activé, coupé.
- **Limite connue** : application ouverte au premier plan, pas de bannière système (l'alerte reste visible dans la cloche).
- **Configuration (corrigée le 2026-09-30)** : les variables `NEXT_PUBLIC_FIREBASE_*` avaient été collées depuis le bloc JavaScript de la console Firebase (espace, guillemets, virgule, et `measurementId` collé à `APP_ID`), d'où « API key not valid ». Valeurs nettoyées. Dans Vercel, saisir chaque valeur seule, sans guillemets ni virgule.

## 2026-09-30 · Recette (agents)
- **Décision** : recette de `staging` par agents successifs (tests, sécurité, conformité, corrections, documentation), plan dans `docs/plan-recette-agents.md`, rapports dans `docs/recette/`.
- **Raison** : prouver les règles métier et les droits avant la fusion dans `main`, sur la base locale seulement.
- **Tests** : suite rejouable créée (`bash supabase/tests/run.sh` : scénarios SQL en transaction annulée, concurrence, `node --test`). 471 réussis, 0 échoué à la fin.
- **Anomalies corrigées** (`docs/recette/4-corrections.md`) : H1 (colonnes modifiables d'une intervention, technicien du restaurant), M1 (quantité d'une pièce seulement par mouvements), M2 (clôture : le technicien doit avoir accès au restaurant), B1 (notification : seul `read_at` modifiable).
- **Lot sécurité** : S-H1 (inscription libre coupée), S-M1 (compte sans profil refusé), S-M2 (propriétaire toujours « tous les restaurants »), S-B1 (fonctions d'aide fermées à `public` et `anon`), S-B3 (déconnexion : l'appareil retire son jeton push), S-B6 / S-B7 (stock et entretien cohérents, éditeur sans prise sur un compte sans restaurant).
- **Lot 3** : lecture réservée aux profils, création directe de restaurant supprimée, droits par défaut fermés à `public` et `anon`. Règle : toute nouvelle fonction SQL appelée par l'application ou une politique porte `grant execute ... to authenticated`.
- **Interface** : écrans d'erreur et de chargement, menu latéral fixe sur ordinateur, notifications lisibles en xl, C3 à C8 (cibles de 44 px, interrupteurs, focus visible, titre de fiche `h1` / `h2`).
- **Base hébergée** : 9 migrations (`20260930200000` à `20260930220000`) poussées le 2026-09-30 après feu vert. Inscription libre désactivée aussi dans la console Supabase.
- **Écarté pour l'instant** : CAPTCHA (proposé pour plus tard), C2 (colonne de présentation de la connexion), S-B2 (secret d'appel de l'Edge Function), S-B4 (expiration du mot de passe temporaire), S-B5 (`safeLink`), S-B8 (journal des actions d'administration), S-B9 (en-têtes, `server-only`, validation), jeton push rattaché à un autre appareil, « Rester connecté ».
- **Documentation** : `docs/README.md` (installation, variables, base, tests, cron, envoi, push, déploiement, sauvegardes, rôles).
