# Plan de corrections : retours de la recette mobile (2026-09-30)

Retours du développeur après les tests sur téléphone. Chaque point indique la cause trouvée dans le code, la correction prévue et l'effort.
On suit les phases dans l'ordre. Chaque correction fait l'objet d'un commit sur `staging`, et toute migration passe d'abord en local, avec la suite de tests (`bash supabase/tests/run.sh`), avant d'être poussée après accord.

## Phase 0 : retester après le correctif `allowedDevOrigins` (fait, `a7602d8`)

- **Cause** : sur téléphone (adresse réseau du PC), `next dev` bloquait les scripts, car la valeur `192.168.11.129/24` n'est pas reconnue par Next, qui attend un nom exact ou un joker. La page s'affichait mais restait inerte.
- **Points probablement causés par ce blocage, à retester** : recherche de machine (Déclarer une panne), clic sur une machine, erreur « tree hydrated… » sur Chrome mobile, notifications qui restent « non lues ».
- **À faire** : redémarrer `next dev`, retester ces points sur le téléphone, puis rayer ceux qui sont réglés.

## Phase 1 : bugs simples (effort faible, sans migration)

| # | Problème | Cause | Correction |
|---|---|---|---|
| 1.1 | Deux boutons « ajouter » sur mobile (Stock, Équipements) | `hidden lg:inline-flex` combiné à `buttonClass()`, qui contient déjà `inline-flex` : en CSS, `inline-flex` l'emporte sur `hidden` (`stock-list.tsx:45`, `equipment-list.tsx:70`) | Remplacer par `max-lg:hidden`, puis chercher le même motif ailleurs |
| 1.2 | « Copier » le mot de passe plante sur Chrome mobile | `navigator.clipboard` n'existe qu'en HTTPS. En `http://192.168…` il est `undefined` (`user-form.tsx:42`). Sur Vercel (HTTPS), ça marche | Solution de repli : sélection du texte et `document.execCommand("copy")`, sinon message « Copiez-le à la main » |
| 1.3 | Clavier ouvert : le défilement dépasse la barre du bas | Barre du bas et bouton flottant fixés en bas. Quand le clavier réduit l'écran, ils recouvrent le contenu et la marge basse devient fausse | Masquer la barre du bas et le bouton flottant quand un champ a le focus, et déclarer `interactive-widget=resizes-content` dans le viewport |
| 1.4 | Notifications : rester « non lues » | Aujourd'hui, une notification n'est marquée lue que par « Voir » ou « Tout marquer comme lu » | Si le bug persiste après la phase 0 : marquer comme lues les notifications affichées dès l'ouverture de la page, tout en les mettant en évidence pendant cette visite, puis mettre à jour les badges |
| 1.5 | Alerte « Urgences » désactivée mais reçue | Le contrôle SQL (`declarer_panne`) respecte le réglage. Pistes : réglage non enregistré (échec silencieux de l'upsert, ou page inerte sur mobile), ou notification créée avant le changement | Relire la ligne `notification_settings` sur l'hébergé (lecture seule), puis afficher une erreur si l'enregistrement échoue, et ajouter un test |

## Phase 2 : application installable (iOS et Android)

- **Constat** : il n'y a pas de manifeste (`app/manifest.ts` absent).
  - Sur **iPhone**, le push web n'existe que si le site est **ajouté à l'écran d'accueil** (iOS 16.4 et plus), et cela demande un manifeste.
  - Sur **Android** (Chrome), le push marche sans installation, mais l'installation donne une vraie icône et un plein écran.
- **Correction** :
  - `app/manifest.ts` : nom, icônes 192 et 512 px, `display: standalone`, couleurs de l'enseigne.
  - Icône Apple.
  - Bandeau « Installer l'application » :
    - Android : bouton natif (`beforeinstallprompt`) ;
    - iPhone : consigne « Partager → Sur l'écran d'accueil » ;
    - masqué une fois l'application installée ou le bandeau refusé.
  - Dans Mes alertes, sur iPhone hors écran d'accueil : expliquer pourquoi le push est indisponible (l'état existe déjà) et renvoyer vers la consigne.
- **Effort** : moyen.

## Phase 3 : statuts d'intervention (fait en local, migrations à pousser)

- **Fait** (2026-09-30) : commits `763e70f` (base), `152c00d` (déclaration), `ccd4f54` (fiche et liste), `43d6dbb` (Mes alertes), `9d295fe` (tests). Suite de tests : 514 réussis, 0 échoué.
- **Migrations à pousser après accord** : `20260930230000_statuts_intervention_valeurs.sql`, `20260930230100_statuts_intervention_fonctions.sql`.
- **Choix** : notification de type `statut_intervention` (réglage « Suivi de mes pannes », sans mail) ; ligne de fiche de vie de type `modification` ; état de la machine inchangé par le statut ; indicateur « Urgences ouvertes ».


- **Demande** : de nouveaux statuts pour suivre une intervention sans la clôturer, y compris une urgence :
  - « À planifier » : statut de départ, qui dit au patron que rien n'a commencé ;
  - « En cours » ;
  - « En attente de pièce » ;
  - « Terminée », c'est-à-dire « faite », par la clôture.
- **Modèle** : l'enum `intervention_status` passe de `en_cours | terminee` à `a_planifier | en_cours | en_attente_piece | terminee`.
- **Base** :
  - `declarer_panne` crée l'intervention en « À planifier ».
  - Nouvelle fonction `changer_statut_intervention` (SECURITY DEFINER), pour propriétaire, éditeur et technicien de leur restaurant, sauf passage à « Terminée » : ce statut reste réservé à `cloturer_intervention`. Elle ajoute une ligne à la fiche de vie et, peut-être, prévient le déclarant.
  - RLS `interventions_update` : « ouverte » veut dire tout statut sauf `terminee`, au lieu de `status = 'en_cours'`.
  - `cloturer_intervention` accepte toute intervention ouverte.
  - L'état de la machine reste en panne tant que l'intervention est ouverte.
- **Écrans** :
  - un sélecteur de statut dans la fiche intervention ;
  - des badges de statut ;
  - l'onglet « En cours » devient « Ouvertes », avec un filtre par statut ;
  - le tableau de bord (« À traiter en priorité ») et les compteurs de la barre latérale.
- **Tests** : mettre à jour `02_cloture`, `04_droits` et `06_notifications`, et ajouter des tests de changement de statut.
- **Lien avec « Nouvelle intervention »** (reportée à l'étape 3) : à décider, voir les questions.

## Phase 4 : photos (panne et intervention, fonctionnalité, effort moyen)

- **Constat** : la colonne `interventions.photo_url` existe, mais la photo avait été mise hors périmètre.
- **Proposition** :
  - un bucket Supabase Storage `photos`, privé, avec des règles d'accès selon le restaurant de l'intervention ;
  - un champ « Ajouter une photo » (`accept="image/*"`, `capture="environment"` pour ouvrir l'appareil photo sur mobile) dans Déclarer une panne et dans la fiche intervention ;
  - une photo réduite côté navigateur (environ 1600 px, JPEG), pour ménager les données mobiles et le quota de 1 Go du plan gratuit ;
  - un affichage en vignette dans la fiche, agrandi au toucher.
- **À décider** : une seule photo ou plusieurs (table `intervention_photos`) ; photo aussi à la clôture (« après ») ; facturation à part ou non.

## Phase 5 : catégories (fait en local, migration à pousser)

- **Fait** (2026-09-30) : commits `a246c69` (base), `253059d` (icônes), `bd0b8c4` (écran), `8877993` (tests). Suite de tests : 551 réussis, 0 échoué.
- **Migration à pousser après accord** : `20260930230200_categories_administration.sql` (colonne `icon`, suppression par l'éditeur, clé étrangère `restrict`, nom unique, format du code).
- **Avant la migration**, l'application ne plante pas (catégories lues avec `categories(*)`), mais l'écran Catégories ne peut pas enregistrer (colonne `icon` absente) et l'éditeur ne peut pas supprimer : pousser la migration avant de tester l'écran.
- **Choix** : voir `docs/journal-decisions.md` (2026-09-30, Catégories).


- **Constat** : un propriétaire ou un éditeur peut déjà créer une catégorie, mais seulement dans le formulaire d'un équipement : on tape un nom inconnu dans « Catégorie », puis on choisit « Ajouter « … » comme catégorie ». Ce n'était peut-être pas visible sur mobile à cause du blocage des scripts (phase 0).
- **Si besoin** : un onglet « Catégories » dans Administration (liste, renommer, code de 3 lettres, supprimer si aucune machine), réservé au propriétaire et à l'éditeur. Effort faible à moyen.

## Décisions du développeur (2026-09-30)

- **Phase 0 et phase 1** : faites. Doubles boutons `d7e9256`, bouton Copier `5a33272`, clavier et application installable `e963734`, débordement de l'accueil `963be7e`.
  - Mail d'urgence reçu malgré le réglage : ce n'est pas un bug. Resend est en mode test, donc tous les mails partent vers l'adresse du compte Resend.
  - Push indisponible sur Android : le site est ouvert en http sur le réseau local, et il faut du https.
- **Statuts (phase 3)** :
  - L'enum devient `a_planifier`, `en_cours`, `en_attente_piece`, `terminee`.
  - À la déclaration d'une panne, le choix de l'état est **obligatoire**, parmi tous les états sauf « Terminée ». Seuls le propriétaire, l'éditeur et le technicien (commentateur) choisissent. Un lecteur peut déclarer sans choisir l'état : sa panne part en « À planifier » (choix par défaut, à confirmer).
  - Propriétaire, éditeur et technicien changent le statut dans la fiche.
  - « Terminée » ne s'obtient que par la clôture.
  - Le **déclarant est prévenu à chaque changement** (notification, et push selon ses réglages).
  - Inclus dans le périmètre, **pas de facturation à part**.
  - « Nouvelle intervention » (sans panne) : reste reportée.
- **Photos (phase 4)** :
  - Jusqu'à **3 photos « avant »** (déclaration ou fiche) et **3 photos « après »** (clôture).
  - Compressées dans le navigateur avant l'envoi vers Supabase Storage.
  - Les limites sont réglables à un seul endroit, pour en permettre plus si le client passe au plan payant.
  - Inclus dans le périmètre, pas de facturation à part.
- **Catégories (phase 5)** : un écran « Catégories » dans Administration (ajouter, renommer, code de 3 lettres, supprimer si aucune machine), pour le propriétaire et l'éditeur. Il comprend aussi le choix de l'icône de la catégorie.

Ordre de réalisation : phase 3, puis 5, puis 4. Chaque phase se fait en local, avec des tests, et ses migrations sont poussées après accord.
