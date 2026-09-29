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
- **Code automatique** : `prochain_code_equipement` propose `CTR2-REF-05` (code restaurant, code catégorie, plus grand numéro + 1 ; `EQP` sans catégorie). La maquette montre `CTR2-FRG-06` : on suit la décision du 29/09 (code catégorie). Code modifiable ; un code en double est refusé (message clair). Code d'une nouvelle catégorie : 3 lettres sans accent (`code_categorie_libre`, non appelable directement).
- **Échéance** : sans entretien noté, première échéance = aujourd'hui + fréquence ; changement de fréquence = recalcul depuis le dernier entretien. Sans fréquence choisie, le plan existant n'est pas modifié.
- **Suppression** : propriétaire seulement (RLS), confirmation obligatoire, cascade sur interventions, entretiens et fiche de vie.
- **Vérifié** : 10 scénarios SQL en local (code auto, catégorie réutilisée, échéances, refus lecteur, restaurant non autorisé, code en double, nom vide) ; `next build` OK.
