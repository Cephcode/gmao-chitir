# Chapitre 08 — Référence du code : qui fait quoi

**À consulter, pas à lire d'une traite.** Pour chaque partie de l'application : les **pages** (adresse → fichier), les **lectures** (`lib/`), les **actions** (ce qui écrit) et ce qu'elles appellent en base, les **composants** d'affichage, et les **fonctions SQL**.

💡 Pour trouver une fonction vite : `Ctrl + Maj + F` dans VS Code (recherche dans tout le projet), ou `Ctrl + P` puis le nom du fichier.

Légende : 🖥️ composant serveur · 📱 composant client (`"use client"`) · ⚙️ action serveur (`"use server"`) · 🗄️ fonction SQL.

---

## Sommaire

1. [Le socle : connexion, session, cadre](#1-le-socle--connexion-session-cadre)
2. [Tableau de bord](#2-tableau-de-bord)
3. [Équipements (machines)](#3-équipements-machines)
4. [Déclarer une panne](#4-déclarer-une-panne)
5. [Interventions](#5-interventions)
6. [Photos](#6-photos)
7. [Stock de pièces détachées](#7-stock-de-pièces-détachées)
8. [Consommables (stock des restaurants)](#8-consommables-stock-des-restaurants)
9. [Notifications](#9-notifications)
10. [Administration](#10-administration)
11. [Composants communs et briques](#11-composants-communs-et-briques)
12. [Utilitaires de `lib/`](#12-utilitaires-de-lib)
13. [Fonctions SQL d'aide, triggers, tâche du matin](#13-fonctions-sql-daide-triggers-tâche-du-matin)
14. [Scripts, tests, configuration](#14-scripts-tests-configuration)

---

## 1. Le socle : connexion, session, cadre

| Fichier | Rôle |
|---|---|
| `proxy.ts` | Avant chaque requête : appelle `updateSession`. Son `matcher` exclut les fichiers statiques, le manifeste et le script des push |
| `lib/supabase/middleware.ts` → `updateSession(request)` | Rafraîchit la session ; non connecté → `/connexion` ; connecté sur `/connexion` → `/`. Liste `PUBLIC_PATHS` des pages publiques |
| `lib/supabase/server.ts` → `createClient()` | **Le** client Supabase côté serveur, avec la session de l'usager (cookies). Utilisé par toutes les lectures et actions |
| `lib/supabase/client.ts` → `createClient()` | Client Supabase dans le navigateur (dépôt des photos seulement) |
| `lib/supabase/admin.ts` → `createAdminClient()` | 🔒 Client avec la clé secrète, contourne la RLS. Serveur seulement, administration des comptes |
| `app/layout.tsx` 🖥️ | Cadre racine : `<html lang="fr">`, polices (Figtree, Poppins), titre de l'onglet, réglages iPhone |
| `app/(app)/layout.tsx` 🖥️ | Cadre des pages connectées : profil obligatoire, mot de passe temporaire → `/changer-mot-de-passe`, menu (`Sidebar`, `BottomNav`, `FabPanne`), bandeau d'installation |
| `app/(app)/error.tsx` 📱 | Écran « Impossible d'afficher cette page » + « Réessayer » (`retry`) |
| `app/(app)/loading.tsx` 🖥️ | Chargement par défaut des pages connectées |

**Session** — `lib/session.ts` :

| Fonction | Rôle |
|---|---|
| `getProfile()` | Le profil de l'usager connecté (`id`, `first_name`, `role`, `must_change_password`), lu **une fois par requête** (`cache`). `null` si non connecté |
| `getNavCounts()` | Urgences ouvertes et notifications non lues (pastilles du menu et de la cloche) |
| `ROLE_LABELS` | `proprietaire` → « Propriétaire », etc. |
| type `Role` | `"proprietaire" \| "editeur" \| "commentateur" \| "lecteur"` |

**Connexion** :

| Adresse | Fichier | Action ⚙️ | Ce qu'elle fait |
|---|---|---|---|
| `/connexion` | `app/connexion/page.tsx` 📱 | `seConnecter(_prev, formData)` (`app/connexion/actions.ts`) | Normalise l'e-mail (`normaliserEmail`), `signInWithPassword`, note `last_seen_at` (clé secrète), redirige vers `/` |
| `/changer-mot-de-passe` | `app/changer-mot-de-passe/page.tsx` | `changerMotDePasse(_prev, formData)` | 8 caractères minimum, met à jour le mot de passe, retire `must_change_password` (clé secrète, sa propre ligne), redirige vers `/` |
| (menu) | `lib/auth-actions.ts` | `deconnexion()` | Ferme la session, renvoie vers `/connexion` |

---

## 2. Tableau de bord

| Adresse | Fichier | Contenu |
|---|---|---|
| `/` (`?restaurant=CODE`) | `app/(app)/page.tsx` 🖥️ | Lit directement restaurants, machines, interventions ouvertes, échéances d'entretien à 7 jours, pièces, stocks de consommables. Calcule les 4 indicateurs, « À traiter en priorité » (urgences → autres pannes → retards → pièces sous le seuil → consommables sous le seuil), la synthèse par restaurant |

Composants : `KpiCard` (`components/app/kpi-card.tsx`, indicateur cliquable), `ListRow` (`list-row.tsx`, ligne de « À traiter »), `RestaurantSelect` 📱 (`restaurant-select.tsx`, choix du restaurant dans l'adresse).

---

## 3. Équipements (machines)

**Pages**

| Adresse | Fichier |
|---|---|
| `/equipements` (`?q=&restaurant=&categorie=&etat=&entretien=`) | `app/(app)/equipements/page.tsx` |
| `/equipements/[id]` | `…/[id]/page.tsx` (liste + fiche) |
| `/equipements/nouveau` | `…/nouveau/page.tsx` (propriétaire, éditeur) |
| `/equipements/[id]/modifier` | `…/[id]/modifier/page.tsx` (propriétaire, éditeur) |

**Lectures et règles** — `lib/equipements.ts`

| Nom | Rôle |
|---|---|
| `listEquipments()` | Machines visibles, pannes d'abord, avec catégorie, marque, plan d'entretien |
| `getEquipment(id)` | Une machine |
| `maintenanceOf(plan)` | Statut d'entretien calculé : à jour, en retard, sans plan |
| `readFilters`, `filtersQuery`, `applyFilters` | Filtres de l'adresse : lire, reconstruire, appliquer |
| `listFormOptions(equipments)` | Listes du formulaire : restaurants, catégories, marques |
| `listFilterOptions()` | Listes des puces de filtre |
| `canEditEquipments(role)` | Propriétaire ou éditeur |
| `STATE_LABELS`, `STATE_BADGE`, `FREQUENCY_LABELS` | Libellés et pastilles des états et fréquences |

`lib/equipment-icon.ts` → `categoryIcon(categorie)` : l'icône d'une machine selon sa catégorie.

**Actions** ⚙️ — `app/(app)/equipements/actions.ts`

| Action | Appelle 🗄️ | Effet |
|---|---|---|
| `noterEntretienFait(_prev, formData)` | `noter_entretien_fait` | Entretien fait aujourd'hui : échéance recalculée, journal, fiche de vie |
| `suggererCode(restaurantId, categoryId)` | `prochain_code_equipement` | Propose le prochain code libre (`CTR2-REF-05`) |
| `enregistrerEquipement(input)` | `enregistrer_equipement` | Crée ou modifie une machine (+ catégorie/marque à la volée, plan d'entretien) |
| `supprimerEquipement(id)` | suppression directe (RLS : propriétaire) | Supprime la machine et, en cascade, son historique |

**Composants** — `components/app/equipements/`

| Fichier | Rôle |
|---|---|
| `equipment-list.tsx` 🖥️ | Liste (lignes mobile, tableau ordinateur) |
| `equipment-filters.tsx` 📱 | Recherche et filtres |
| `equipment-sheet.tsx` 🖥️ | Fiche : infos, entretien, historique (fiche de vie), pièces « va avec » |
| `equipment-form.tsx` 📱 | Formulaire création/modification, code proposé automatiquement |
| `maintenance-done-button.tsx` 📱 | Bouton « Noter l'entretien comme fait » |

**Tables** : `equipments`, `categories`, `brands`, `maintenance_plans`, `maintenance_logs`, `equipment_events`.

---

## 4. Déclarer une panne

| Adresse | Fichier | Contenu |
|---|---|---|
| `/panne` | `app/(app)/panne/page.tsx` | Formulaire `DeclareForm` 📱 (`components/app/panne/declare-form.tsx`) : machine, symptômes (liste `SYMPTOMS` dans ce fichier), urgence, photos |
| `/panne/envoyee/[id]` | `…/envoyee/[id]/page.tsx` | Confirmation (`?photos_echec=N` si des photos ont échoué) |

| Action ⚙️ | Appelle 🗄️ | Effet |
|---|---|---|
| `declarerPanne(input)` (`app/(app)/panne/actions.ts`) | `declarer_panne` | Crée l'intervention, met la machine en panne, fiche de vie, notifie les responsables et techniciens du restaurant. Renvoie l'id ; le formulaire envoie ensuite les photos |

---

## 5. Interventions

**Pages**

| Adresse | Fichier |
|---|---|
| `/interventions` (`?statut=&q=&restaurant=&etat=&nature=&type=&technicien=`) | `app/(app)/interventions/page.tsx` |
| `/interventions/[id]` | `…/[id]/page.tsx` (liste + fiche) |
| `/interventions/nouvelle` | `…/nouvelle/page.tsx` (sauf lecteur) |

**Lectures et règles** — `lib/interventions.ts` et `lib/intervention-status.ts`

| Nom | Rôle |
|---|---|
| `listInterventions()` | Toutes les interventions visibles (ouvertes : urgences d'abord) |
| `getIntervention(id)` | Une intervention |
| `loadInterventionList(filters)` | Données de la liste : lignes filtrées, compteurs des onglets, restaurants, techniciens |
| `readFilters`, `filtersQuery`, `applyFilters` | Filtres de l'adresse |
| `listTechnicians(restaurantId?)`, `listTechniciansByRestaurant(ids)` | Qui peut intervenir sur un restaurant |
| `technicianOptions(techniciens)` | Options de la liste de choix du technicien |
| `listPartsFor(equipmentId)` | Pièces du stock, celles prévues pour la machine en tête (clôture) |
| `listUsedParts(interventionId)` | Pièces consommées par une intervention clôturée |
| `machineName(i)`, `problem(i)`, `kindOf(i)` | Nom de la machine, résumé du problème, type |
| `KIND_LABELS`, `KINDS`, `TYPE_BADGE`, `TYPE_GROUPS` | Types (Réparation, Entretien préventif…), priorités, groupes de la liste |
| `STATUS_LABELS`, `STATUS_BADGE`, `OPEN_STATUSES`, `isOpen`, `canSetStatus(role)` | Statuts (`intervention-status.ts`) |

**Actions** ⚙️ — `app/(app)/interventions/actions.ts`

| Action | Appelle 🗄️ | Effet |
|---|---|---|
| `creerIntervention(input)` | `creer_intervention` | Crée une intervention de n'importe quel type ; une réparation met la machine en panne |
| `enregistrerIntervention(input)` | mise à jour directe (RLS, colonnes limitées) | Garde le travail en cours et le technicien, sans clôturer |
| `changerStatutIntervention({ id, statut })` | `changer_statut_intervention` | À planifier / En cours / En attente de pièce ; prévient le déclarant |
| `cloturerIntervention(input)` | `cloturer_intervention` | Termine : pièces décomptées du stock, état de la machine, fiche de vie, compte comme entretien, prévient le déclarant |

**Composants** — `components/app/interventions/`

| Fichier | Rôle |
|---|---|
| `intervention-list.tsx` 🖥️ | Liste, onglets Ouvertes / Terminées, groupes Urgences / Normales |
| `intervention-sheet.tsx` 🖥️ | Fiche : résumé, statut, clôture ou compte rendu |
| `status-selector.tsx` 📱 | Choix du statut |
| `closing-form.tsx` 📱 | « Enregistrer » / « Clôturer » : travail fait, pièces, état après, photos après |
| `technician-picker.tsx` 📱 | Choix du technicien (liste avec recherche) |
| `new-intervention-form.tsx` 📱 | Nouvelle intervention (type, machine, technicien) |
| `intervention-photos.tsx` 📱 | Photos avant/après dans la fiche |

**Tables** : `interventions`, `intervention_parts`, `intervention_photos`.

---

## 6. Photos

| Fichier | Fonctions | Rôle |
|---|---|---|
| `lib/photos.ts` (règles pures) | `PHOTOS_MAX_PAR_TYPE` (3), `PHOTO_MAX_DIMENSION` (1600), `resizeDimensions`, `photoPath`, `takeWithinLimit`, `limitMessage`, `failedPhotosMessage`… | Réglages et calculs, testés |
| `lib/photos-browser.ts` 📱 | `compressPhoto(file)`, `sendPhotos(…)` | Compression dans le navigateur, dépôt dans Storage puis enregistrement |
| `lib/photos-server.ts` | `listPhotos(interventionId)` | Photos d'une intervention avec URL signées (1 h) |
| `components/app/photos/photos.tsx` 📱 | `PhotoGrid`, `PhotoPicker`… | Vignettes, ajout, compteur « 2/3 » |
| `app/(app)/interventions/photos-actions.ts` ⚙️ | `enregistrerPhotos(input)` → 🗄️ `ajouter_photo_intervention` ; `supprimerPhoto({ photoId })` | Enregistrer (3 max par type) ; retirer |

⚠️ La limite de 3 existe **deux fois** : `PHOTOS_MAX_PAR_TYPE` (code) et `photos_max_par_type()` (SQL). À garder égales.

---

## 7. Stock de pièces détachées

Stock **commun à la chaîne** (pas de restaurant). La quantité ne bouge que par des mouvements.

| Adresse | Fichier |
|---|---|
| `/stock` (`?q=&categorie=&statut=sous_seuil`) | `app/(app)/stock/page.tsx` |
| `/stock/[id]` | `…/[id]/page.tsx` |
| `/stock/nouvelle`, `/stock/[id]/modifier` | `…/nouvelle/page.tsx`, `…/[id]/modifier/page.tsx` |

**`lib/stock.ts`**

| Nom | Rôle |
|---|---|
| `listParts()`, `getPart(id)` | Pièces (avec machines « va avec »), sous le seuil d'abord |
| `loadStockList(filters)` | Données de la liste (lignes, total, nombre sous le seuil, catégories) |
| `listMovements(partId)` | Derniers mouvements d'une pièce |
| `listUsedOn(partId)` | Machines sur lesquelles la pièce a servi (d'après les interventions) |
| `listMachinesForPicker()` | Machines proposées dans « Va avec » |
| `isLow(p)`, `plannedSummary(p)`, `unitLabel(unit, n)`, `UNITS` | Sous le seuil ? résumé, unités |
| `readFilters`, `filtersQuery`, `applyFilters`, `canEditStock(role)` | Filtres, droits |

**Actions** ⚙️ — `app/(app)/stock/actions.ts`

| Action | Appelle | Effet |
|---|---|---|
| `enregistrerPiece(input)` | insert/update direct (RLS) + 🗄️ `mouvement_stock` pour le stock initial | Crée (à 0, puis livraison) ou modifie une pièce, et ses machines « va avec » |
| `supprimerPiece(id)` | delete direct (RLS : propriétaire) | Refusé si la pièce a servi dans une intervention |
| `mouvementStock({ partId, delta, reason })` | 🗄️ `mouvement_stock` | Livraison (+) ou correction (±) ; alerte au seuil |

**Composants** — `components/app/stock/` : `stock-list.tsx` 🖥️, `part-sheet.tsx` 🖥️, `stock-controls.tsx` 📱 (− / + et livraison), `part-form.tsx` 📱, `stock-switch.tsx` 🖥️ (sélecteur mobile Pièces | Consommables).

**Tables** : `parts`, `stock_movements`, `part_compatibilities`.

---

## 8. Consommables (stock des restaurants)

Catalogue **commun**, quantités et seuils **par restaurant**. Plan complet : `docs/plan-module-consommables.md`.

| Adresse | Fichier |
|---|---|
| `/consommables` (`?q=&restaurant=CODE&famille=&statut=sous_seuil`) | `app/(app)/consommables/page.tsx` |
| `/consommables/[id]` | `…/[id]/page.tsx` |
| `/consommables/nouveau`, `/consommables/[id]/modifier` | `…/nouveau/page.tsx`, `…/[id]/modifier/page.tsx` |

**Règles pures** — `lib/consommables-rules.ts`

| Nom | Rôle |
|---|---|
| `FAMILLES`, `FAMILLE_LABELS`, `isFamille` | Familles : emballages et jetables, boissons, matériel en gros |
| `UNITES`, `uniteLabel(unit, n)`, `isUnite` | Unités et leur libellé au singulier/pluriel |
| `OPERATIONS`, `OPERATION_LABELS`, `QUANTITE_LABELS`, `isOperation` | Livraison, consommation, perte, inventaire, transfert, seuil |
| `RAISON_LABELS` | Libellés de l'historique |
| `estSousSeuil(s)`, `ecartInventaire(enStock, comptee)` | Calculs |
| `normaliserCode(code)` | « gob 50 » → « GOB-50 » |
| `verifierArticle(a)`, `verifierOperation(o)` | Validation des saisies (message + champ) |
| `resumeArticle(stocks, restaurantId)` | Quantité, seuil, restaurants sous le seuil, statut (suffisant, sous le seuil, non suivi) |
| `lireFiltres`, `filtresQuery`, `appliquerFiltres`, `trierArticles` | Filtres et tri de la liste |

**Lectures** — `lib/consommables.ts` : `listArticles()`, `getArticle(id)`, `listMouvementsArticle(id)`, `listRestaurantsAccessibles()`, `chargerListe(filtres)`, `canEditConsommables(role)`.

**Actions** ⚙️ — `app/(app)/consommables/actions.ts`

| Action | Appelle | Effet |
|---|---|---|
| `enregistrerArticle(input)` | insert/update direct (RLS) | Crée ou modifie un article du catalogue |
| `supprimerArticle(id)` | delete direct (RLS : propriétaire) | Refusé s'il a des mouvements |
| `operationArticle(input)` | 🗄️ `mouvement_article`, `inventaire_article`, `transferer_article` ou `regler_seuil_article` | Selon l'opération choisie |
| `arreterSuivi(articleId, restaurantId)` | 🗄️ `ne_plus_suivre_article` | Ne plus suivre l'article dans un restaurant (quantité à 0) |

**Composants** — `components/app/consommables/` : `article-list.tsx` 🖥️, `article-sheet.tsx` 🖥️, `article-operation.tsx` 📱, `article-form.tsx` 📱.

**Fonctions SQL** 🗄️ : `mouvement_article`, `inventaire_article`, `transferer_article`, `regler_seuil_article`, `ne_plus_suivre_article` ; internes : `consommable_controle`, `alerte_article_bas`.
**Tables** : `articles`, `article_stocks`, `article_mouvements`.

---

## 9. Notifications

| Adresse | Fichier |
|---|---|
| `/notifications` (`?categorie=&lu=`) | `app/(app)/notifications/page.tsx` |
| `/notifications/alertes` | `…/alertes/page.tsx` (« Mes alertes ») |

**`lib/notifications.ts`** : `listNotifications()`, `getSettings()`, `TYPE_STYLE` (icône et couleur par type), `CATEGORIES` (filtres), `SETTINGS` (interrupteurs de « Mes alertes »), `dayGroup`, `whenLabel` (Aujourd'hui, Hier…), `safeLink` (seuls les liens internes sont suivis).

**Push** : `lib/firebase-client.ts` (`pushSupported`, `obtenirJetonPush`, `supprimerJetonPush`), `lib/push-appareil.ts` (`lireJetonLocal`, `ecrireJetonLocal`, `oublierCetAppareil`), `app/firebase-messaging-sw.js/route.ts` (script du service worker).

**Actions** ⚙️ — `app/(app)/notifications/actions.ts`

| Action | Effet |
|---|---|
| `ouvrirNotification(formData)` | Marque comme lue puis ouvre le lien (formulaire « Voir ») |
| `toutMarquerLu()` | Tout marquer comme lu |
| `reglerAlerte(type, enabled)` | Interrupteur de « Mes alertes » (`notification_settings`) |
| `enregistrerAppareil(token, userAgent)` | Cet appareil reçoit les push (`push_tokens`) |
| `oublierAppareil(token)` | Ne plus recevoir les push ici (aussi à la déconnexion) |

**Composants** : `alert-settings.tsx` 📱, `push-toggle.tsx` 📱.
**Envoi** : `supabase/functions/envoyer-notification/index.ts` (Edge Function, Deno) : push Firebase + e-mails Resend (`EMAIL_TYPES` : urgence, panne, attribution).
**Tables** : `notifications`, `notification_settings`, `push_tokens`. Types : enum `notification_type`.

---

## 10. Administration

Garde : `app/(app)/admin/layout.tsx` (propriétaire, éditeur ; sinon → `/`).

| Adresse | Contenu |
|---|---|
| `/admin` | Redirige vers `/admin/utilisateurs` |
| `/admin/utilisateurs`, `/nouveau`, `/[id]` | Comptes : liste, création, modification |
| `/admin/restaurants`, `/nouveau` | Restaurants (propriétaire) |
| `/admin/categories`, `/nouveau`, `/[id]` | Catégories de machines |

**Règles** — `lib/admin-rules.ts` (pures, testées) : `canAccessAdmin(role)`, `assignableRoles(acteur)`, `assignableRestaurants(acteur, ids)`, `canManage(acteur, cible)`, `checkAssignment(acteur, saisie, ids)`, `normaliserAcces`, `ROLE_HELP`.
**Lectures** — `lib/admin.ts` : `getActor()` (l'usager qui agit, relu en base), `listUsers()`, `listRestaurants()`, `loadAdmin()`, `restaurantStats(users)`, `motDePasseTemporaire()`, `displayName`, `initials`.
**Catégories** — `lib/categories-rules.ts` (`CATEGORY_ICONS`, `normaliserCode`, `codeDepuisNom`, `checkCategory`) et `lib/categories.ts` (`listCategoriesAdmin`, `machinesParCategorie`).

**Actions** ⚙️

| Action | Fichier | Effet |
|---|---|---|
| `creerCompte(saisie)` | `admin/actions.ts` | Vérifie la délégation (`checkAssignment`), crée le compte Auth + profil (🔒 clé secrète), renvoie le mot de passe temporaire |
| `modifierCompte(saisie)` | idem | Rôle, restaurants, prénom (après `canManage`) |
| `reinitialiserMotDePasse(id)` | idem | Nouveau mot de passe temporaire, à changer à la connexion |
| `supprimerCompte(id)` | idem | Supprime le compte (pas soi-même) |
| `ajouterRestaurant(input)` | idem → 🗄️ `ajouter_restaurant` | Crée un restaurant, copie éventuelle des machines d'un autre |
| `enregistrerCategorie(saisie)`, `supprimerCategorie(id)` | `admin/categories/actions.ts` | Catégories (RLS ; suppression refusée si des machines l'utilisent) |

**Composants** — `components/app/admin/` : `admin-views.tsx` (onglets, listes), `user-form.tsx` 📱, `restaurant-form.tsx` 📱, `category-views.tsx`, `category-form.tsx` 📱.

---

## 11. Composants communs et briques

**`components/app/`** (communs à plusieurs écrans)

| Fichier | Rôle |
|---|---|
| `nav.tsx` 📱 | `Sidebar` (menu ordinateur, liste `MAIN_ITEMS` + `CONSOMMABLES_ITEM`), `BottomNav` (4 onglets mobile), `FabPanne` (bouton flottant) |
| `url-filters.tsx` 📱 | `UrlFilters` : recherche (300 ms) + puces de filtre, dans l'adresse |
| `restaurant-select.tsx` 📱 | Choix du restaurant (tableau de bord) |
| `loading-state.tsx` | Squelette de chargement (`loading.tsx`) |
| `list-row.tsx`, `kpi-card.tsx` | Ligne de liste, indicateur |
| `sheet-title.tsx` | Titre de fiche (h1 sur mobile, h2 sur ordinateur) |
| `install-banner.tsx` 📱 | « Installer l'application » |
| `coming-soon.tsx` | Écran d'attente d'une rubrique pas encore faite |

**`components/ui/`** (briques de base, à réutiliser)

| Brique | Props principales | Rôle |
|---|---|---|
| `Button`, `buttonClass()` | `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`md`, `sm`, `cta`), `icon` | Bouton ; `buttonClass` donne l'apparence d'un bouton à un `<Link>` |
| `Field`, `TextInput` | `label`, `error`, `hint`, `optional` ; `invalid`, `leadingIcon` | Champ avec libellé et message |
| `Card` | `padded` | Encadré blanc |
| `Alert`, `Toast` | `variant` (`success`, `danger`, `warning`, `info`), `title`, `action` | Bandeau de message |
| `Combobox` | options, création à la volée | Liste avec recherche |
| `SegmentedControl` | `options`, `value`, `onChange` | Choix parmi quelques boutons |
| `StatusBadge` | `status` (clé de `statuses`), `label` | Pastille couleur + icône + texte |
| `Icon` (`components/icons.tsx`) | `name`, `size` | Icône ; liste `iconPaths` |

---

## 12. Utilitaires de `lib/`

| Fichier | Fonctions |
|---|---|
| `format.ts` | `depuis(date)` (« 25 min », « hier »), `dateCourte(date)` (« 6 oct. »), `aujourdhui()` (AAAA-MM-JJ), `plusJours(date, n)`, `nomPersonne(u)` (prénom sinon e-mail) |
| `identifiant.ts` | `normaliserEmail(saisie)` : minuscules, vérifié, ou `null` |
| `session.ts` | voir section 1 |

---

## 13. Fonctions SQL d'aide, triggers, tâche du matin

Version en vigueur de chaque fonction et migration où elle se trouve : `docs/base-de-donnees.md`, section 4.

**Fonctions métier** (appelées par `supabase.rpc`) : `declarer_panne`, `creer_intervention`, `changer_statut_intervention`, `cloturer_intervention`, `ajouter_photo_intervention`, `enregistrer_equipement`, `prochain_code_equipement`, `noter_entretien_fait`, `mouvement_stock`, `ajouter_restaurant`, et celles des consommables (section 8).

**Fonctions d'aide** (dans les règles RLS et les fonctions)

| Fonction | Rôle |
|---|---|
| `auth_role()` | Rôle de l'usager connecté, `null` sans profil |
| `has_restaurant(id)` | Accès au restaurant |
| `equipment_restaurant(id)`, `intervention_restaurant(id)` | Restaurant d'une machine, d'une intervention |
| `shares_restaurant(user)` | Partage un restaurant avec ce compte (lecture des comptes) |
| `peut_intervenir(user, restaurant)` | Peut être technicien sur ce restaurant |
| `next_due_date(fréquence, date)` | Prochaine échéance d'entretien |
| `nom_equipement_normalise(nom)` | Nom sans casse ni accents (unicité) |
| `photos_max_par_type()` | 3 |
| `date_courte_fr(d)` | « 6 oct. » dans les notifications |
| `set_updated_at()` | Remplit `updated_at` |

**Triggers** : `trg_notifications_envoi` (→ Edge Function), `trg_interventions_attribution` (prévient le technicien), `trg_equipments_avant_ecriture`, `trg_*_updated`.
**Tâche du matin** : `taches_quotidiennes()` via pg_cron à 7 h (rappels et retards d'entretien).

---

## 14. Scripts, tests, configuration

| Fichier | Rôle |
|---|---|
| `scripts/dev-local.sh` | Lance l'application sur la base locale |
| `scripts/creer-proprietaire.mjs` | Crée le premier compte propriétaire d'une base neuve |
| `scripts/remettre-compte.mjs` | Change l'e-mail de connexion d'un compte + mot de passe temporaire (remise au client) |
| `scripts/vercel-env.sh` | Copie les variables d'environnement vers Vercel |
| `scripts/verification-production.sql`, `scripts/reperage-donnees.sql` | Contrôles en lecture seule de la base hébergée |
| `supabase/tests/run.sh` | Lance tous les tests (SQL + node) |
| `supabase/tests/_fixture.sql` | Jeu de données des tests SQL |
| `supabase/tests/NN_*.sql` | Un fichier de tests par thème (stock, clôture, droits, consommables…) |
| `tests/*.test.ts` | Tests des règles pures (`node --test`) |
| `supabase/config.toml` | Réglages de la base **locale** |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vercel.json` | Réglages de Next, TypeScript, ESLint, Tailwind, Vercel (région Dublin) |
| `.env.example` | Liste des variables d'environnement (sans valeurs) |

👉 Chapitre suivant : [Ajouter tes fonctionnalités](09-ajouter-une-fonctionnalite.md)
