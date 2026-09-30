# Résumé des maquettes (Claude Design)

Source : `/home/bere/Bureau/Projets/GMAO Chitir Chicken.pdf` (24 Mo, 36 pages). Ne jamais le lire en entier : il est découpé écran par écran et par section dans `/home/bere/Bureau/Projets/gmao/webapp/maquettes/` (voir `INDEX.md`, script `decouper.py`). Ce résumé suffit pour démarrer ; pour un écran précis, ouvrir son dossier (`apercu.jpg`, `texte.txt`, puis les `section-N.jpg` utiles).

## Couleurs (contrastes WCAG déjà calculés)

| Usage | Hex | Texte dessus |
|---|---|---|
| Orange Chitir (action principale) | #F88F1F | #2B1A10 (jamais blanc, 2,3:1) |
| Survol, appui | #E97F10, #D06F08 | #2B1A10 |
| Fond léger, fond sélection | #FEF1E2, #FDE3C6 | #A34E00, #2B1A10 |
| Texte orange (liens) | #A34E00 | sur blanc |
| Rouge Chitir (logo seulement) | #ED1A26 | identité, pas d'usage dans l'app |
| Fond de l'app, surface, secondaire | #FBF8F3, #FFFFFF, #F4EEE5 | #22170F |
| Bordure carte, bordure champ | #E9E1D5, #8C7E70 | |
| Texte principal, secondaire | #22170F, #6E6053 | |
| Menu latéral | #2A1B12 | #F4E9D5 |
| Filtre actif | #2B1A10 | #FBF8F3 |

## Statuts (couleur, icône et texte toujours ensemble)

| Famille | Couleur texte / fond | Statuts |
|---|---|---|
| Succès | #1B7A4B / #E5F4EC | Opérationnel, À jour, Terminé, Suffisant |
| Avertissement | #7A4A00 / #FFF4D6 (accent #F5B800) | En retard, Sous le seuil |
| Danger | #B42318 / #FDECEA | En panne, Urgence, erreurs de saisie |
| Information | #1D5FA8 / #E6EFFA | En maintenance, En cours |
| Neutre | à relever dans l'écran composants | Hors service, Normal |

Icônes : coche (ok), croix (en panne), horloge (en retard), clé (en maintenance), interdit (hors service), flèches (en cours), éclair (urgence), flèche basse (sous le seuil).

## Typographie
Poppins 600 pour titres et chiffres (32/40 ordinateur, 24/32 mobile, 18/26 sections, 28 chiffres). Figtree 400 et 600 pour le texte (16/24, libellés 14/20).

## Composants
Bouton principal orange, une seule action par écran, hauteur normale ou compacte 36 px. Bouton mobile "Déclarer une panne" de 56 px, ombre, au dessus de la barre basse, visible pour tous les rôles. Barre basse : Accueil, Équipements, Interventions, Stock. Menu latéral ordinateur : Tableau de bord, Équipements, Interventions, Stock, Notifications, Administration (Propriétaire).

## Écrans (36)
Connexion (mobile 2 étapes, ordinateur), tableau de bord global et par restaurant, équipements (liste, fiche Éditeur et Lecteur, ajout, modification), interventions (liste, clôture), déclarer une panne (2 étapes mobile, 1 page ordinateur, confirmation), stock (liste, fiche pièce), notifications et réglage des alertes, administration (utilisateurs, inviter, ajouter un restaurant), états vide, chargement, erreur (mobile, ordinateur), page de choix mobile ou ordinateur, système de design.

## Écarts avec les décisions validées (à traiter à l'écran concerné)
- Choix du rôle à la connexion : retiré (le serveur connaît les rôles).
- Commentaires : retirés (fiche équipement, notifications).
- Photo à la déclaration de panne : hors périmètre.
- "Inviter par lien" : remplacé par mot de passe temporaire généré.
- Le type Alerte n'existe pas dans les maquettes (seulement Urgence et Normal) : à ajouter avec un badge neutre à confirmer.
- Rôle Responsable technique absent des maquettes : à ajouter dans les listes de rôles.
- "Va avec" affiché en une seule liste : à séparer en "prévu" et "utilisé".
