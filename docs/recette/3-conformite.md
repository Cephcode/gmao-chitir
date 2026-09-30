# Recette 3 : conformité UI/UX et accessibilité

Branche `staging`. Lecture du code seulement : je n'ai pas vu l'écran. Référence : `webapp/maquettes/` (INDEX, textes, apercu p28).
Les écarts déjà décidés (plan de recette, formulaire de compte propriétaire, « L'équipe du restaurant est prévenue », pas d'onglet Administration en bas) ne sont pas repris.

Bilan : 1 bloquant, 8 à corriger, 8 détails. Les libellés de la déclaration de panne (p12 à p14), les statuts (couleur, icône et texte), la barre du bas, le bouton « Déclarer une panne » (flottant pour tous les rôles sur mobile, dans le menu latéral sur ordinateur) et les noms accessibles des boutons icône sont conformes.

## Bloquant

| # | Écran | Fichier:ligne | Maquette | Écart | Correction (effort) |
|---|---|---|---|---|---|
| B1 | Tous les écrans de l'app | `app/(app)/` : aucun `error.tsx` | p24, p36 (état erreur) | Pas d'état d'erreur. Si une requête échoue, Next affiche sa page d'erreur par défaut (en anglais, sans menu ni bouton « Déclarer une panne »). La maquette prévoit « Impossible d'afficher… », « Réessayer » et le bouton panne toujours disponible. | Ajouter `app/(app)/error.tsx` (client) avec le texte de p24 et un bouton « Réessayer » (`reset()`). Le menu et le bouton panne restent affichés car ils sont dans le layout. (faible) |

## À corriger

| # | Écran | Fichier:ligne | Maquette | Écart | Correction (effort) |
|---|---|---|---|---|---|
| C1 | Tous (chargement) | `app/(app)/` : aucun `loading.tsx` | p23, p36 | Pas d'état de chargement : pendant la navigation, l'écran précédent reste figé sans retour visuel. | `app/(app)/loading.tsx` avec « Chargement… » et des blocs gris comme p23. (faible) |
| C2 | Connexion, ordinateur | `app/connexion/page.tsx:22-23` | p25 | Une seule colonne centrée (`max-w-sm`) sur ordinateur. La maquette a deux colonnes : à gauche « La maintenance des restaurants, sans rien oublier. » et les trois points forts, à droite le formulaire. | Ajouter la colonne de présentation en `hidden lg:flex` (sans le choix du rôle, retiré). (moyen) |
| C3 | Connexion | `app/connexion/page.tsx:66-73` | p05, p25 | Le bouton « Afficher le mot de passe » est en `text-sm`, sans hauteur minimale (environ 20 px) : cible tactile trop petite. | `min-h-11` (44 px) et une zone de clic plus large. (faible) |
| C4 | Mes alertes | `components/app/notifications/alert-settings.tsx:51-53` | p19, p33 | L'interrupteur fait 32 px de haut, sous les 44 px. Éteint, son fond `bg-border` (#E9E1D5) sur blanc a un contraste d'environ 1,2:1 : on voit mal qu'il y a un interrupteur (il faut 3:1). | Rendre toute la ligne cliquable (`label` ou `min-h-11`) et ajouter un liseré `--color-border-strong` à l'état éteint. (faible) |
| C5 | Filtres (équipements, interventions, stock, notifications) | `components/app/url-filters.tsx:30` ; `components/ui/segmented-control.tsx:31` | p08, p15, p17 | Puces de filtre et contrôle segmenté à 40 px de haut sur mobile, sous 44 px. | `h-11` sur mobile, `lg:h-10` sur ordinateur. (faible) |
| C6 | Fiche pièce, formulaire pièce | `components/app/stock/part-sheet.tsx:16` (liens vers les machines, 32 px) ; `components/app/stock/part-form.tsx:54` (bouton « Retirer », 32 px) | p18 | Cibles de 32 px sur mobile. | `min-h-11` sur mobile, ou zone de clic élargie. (faible) |
| C7 | Formulaires (panne, équipement, pièce, clôture) et sélecteur de restaurant | `components/app/panne/declare-form.tsx:314`, `components/app/equipements/equipment-form.tsx:165`, `components/app/stock/part-form.tsx:168`, `components/app/interventions/closing-form.tsx:202`, `components/app/restaurant-select.tsx:20`, `components/app/url-filters.tsx:34,101` | p02 (champ au focus : liseré orange et halo), `components/ui/field.tsx:61` | Ces listes déroulantes et recherches font `outline-none` et passent seulement le liseré de brun-gris (#8C7E70, 3,9:1) à orange (#F88F1F, environ 2,3:1 sur blanc). Le focus devient **moins** visible qu'au repos. `Field` ajoute bien le halo `orange-selected`, pas ces champs faits à la main. | Reprendre les classes de `Field` : `focus-within:shadow-[0_0_0_3px_var(--color-orange-selected)]`, ou réutiliser `Field`. (faible) |
| C8 | Fiches équipement, intervention, pièce ; formulaires ; admin ; listes équipements, interventions, stock | `components/app/equipements/equipment-sheet.tsx:207`, `components/app/interventions/intervention-sheet.tsx:82`, `components/app/stock/part-sheet.tsx:52` (h2 seulement) | | Sur mobile, ces fiches s'affichent en page entière sans `h1`. La navigation par titres au lecteur d'écran ne trouve pas le titre de la page. | Titre en `h1` quand la fiche est la page (mobile), ou `h1` en `sr-only` dans les `page.tsx`. (faible) |

## Détails

| # | Écran | Fichier:ligne | Maquette | Écart | Correction (effort) |
|---|---|---|---|---|---|
| D1 | Listes équipements, interventions ; admin | `components/app/equipements/equipment-list.tsx:27`, `components/app/interventions/intervention-list.tsx:253`, `components/app/admin/admin-views.tsx:163` | p28 (la maquette montre elle aussi « — ») | Tiret cadratin « — » affiché pour une valeur vide, contraire à la règle « aucun tiret cadratin ». | Remplacer par « Non prévu » / « Jamais » ou un texte court, avec `aria-label`. (faible) |
| D2 | Fiche pièce | `components/app/stock/part-sheet.tsx:12` | p18 | « Correction d'inventaire » : le mot « inventaire » est absent des maquettes, qui parlent de « Correction » du stock. | « Correction du stock ». (faible) |
| D3 | Menu latéral | `components/app/nav.tsx:77` | p28 | Marque « GMAO Chitir » ; maquette « Chitir Chicken » et, dessous, « Maintenance ». | Reprendre le libellé de la maquette. (faible) |
| D4 | Menu latéral | `components/app/nav.tsx:34,61` | p28 | Compteur des notifications en rouge (`bg-danger`) ; maquette : rouge pour les urgences (Interventions), orange pour les notifications. La section « PROPRIÉTAIRE » au-dessus d'Administration manque aussi. | Pastille `bg-orange text-on-orange` pour les notifications ; intitulé de section si Administration est affichée. (faible) |
| D5 | Couleurs en dur hors `app/globals.css` | `components/app/nav.tsx:94,105,111,123` (#E9DCC8, #3A281C, #A89886, `text-white`) ; `components/app/list-row.tsx:25`, `coming-soon.tsx:10`, `panne/declare-form.tsx:248,292`, `admin/admin-views.tsx:69`, `equipements/equipment-sheet.tsx:203` (#4E2F21) ; `stock/stock-list.tsx:86,94` (#F2D68A) ; `interventions/intervention-list.tsx:183`, `equipements/equipment-sheet.tsx:242` (#F4B8B0) ; `admin/user-form.tsx:29` (#A8DCC0) ; `#D6CBBB` au lieu de `var(--color-ring)` dans 4 formulaires | p01 | Teintes proches de la maquette et contrastes corrects (par exemple #A89886 sur le menu : 5,9:1), mais hors tokens : risque de dérive. `text-white` sur `bg-danger` pour les pastilles : 6,6:1, conforme. | Ajouter les tokens (`--color-sidebar-hover`, `--color-sidebar-muted`, `--color-brown`, bordures de statut) et les utiliser. (faible) |
| D6 | Interventions, état vide | `components/app/interventions/intervention-list.tsx:151-157` | p22 | Texte différent : maquette « Toutes les machines fonctionnent. Si l'une tombe en panne, appuyez sur le bouton orange en bas. » et lien « Voir les interventions terminées », absent. | Reprendre le texte et le lien de p22. (faible) |
| D7 | Connexion | `app/connexion/page.tsx:80-84` | p05, p25 | Le lien « Mot de passe oublié ? » fait environ 36 px (`py-2`) ; la case « Rester connecté » manque (session déjà gardée par défaut, à confirmer). | `min-h-11` ; confirmer l'abandon de « Rester connecté ». (faible) |
| D8 | Déclarer une panne, type d'urgence | `components/app/panne/declare-form.tsx:423-447` | p13 | `role="radio"` sans navigation aux flèches : au clavier on passe d'un choix à l'autre avec Tab, ce qui ne correspond pas au rôle annoncé. Même remarque pour le choix du rôle (`admin/user-form.tsx:172-209`, `aria-pressed` dans un `radiogroup`). | Soit de vrais `input type="radio"` masqués, soit `aria-pressed` sans `radiogroup`. (faible) |

## À vérifier visuellement par le développeur

Captures à 390 px et à 1440 px :

1. Tableau de bord global et par restaurant (p06, p07, p26, p27) : bouton flottant « Déclarer une panne » au-dessus de la barre du bas, sans recouvrir le dernier élément de la liste (`pb-44` dans `app/(app)/layout.tsx:30`).
2. Liste des équipements, avec filtres actifs (p08, p28) : les puces ne débordent pas à 390 px ; le tableau et la fiche à droite sur ordinateur.
3. Fiche équipement vue par un lecteur (p10) : bandeau « lecture seule », pas de bouton de modification.
4. Déclarer une panne, étapes 1 et 2, puis confirmation (p12 à p14, p30) : le bouton « Envoyer la déclaration » reste visible au-dessus du clavier du téléphone.
5. Clôture d'une intervention (p16, p31) : focus visible sur la liste « état après » et sur la zone de texte (C7).
6. Stock et fiche pièce (p17, p18, p32) : bandeau « sous le seuil » et boutons « − / + ».
7. Mes alertes (p19, p33) : interrupteurs éteints bien visibles (C4).
8. Administration, comptes et restaurants (p20, p21, p34, p35).
9. Connexion (p05, p25) : comparer la mise en page ordinateur (C2).
10. Navigation au clavier sur ordinateur (Tab depuis le haut) : ordre logique et contour visible sur chaque lien du menu latéral, chaque bouton, chaque filtre.
11. Couper le réseau puis recharger un écran : ce qui s'affiche aujourd'hui (B1, C1).
