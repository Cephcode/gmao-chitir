# Guide de présentation de la GMAO au client

Ce document est le fil conducteur de la démonstration. Chaque partie indique **ce que tu montres** (▶), **ce que tu dis** (💬), avec des mots simples, sans jargon, et les points à ne pas oublier (⚠️).
Durée conseillée : 45 minutes de démonstration, puis 15 minutes de questions.

---

## 1. Préparer la démonstration (la veille)

### Le matériel
- [ ] **Un ordinateur** connecté à l'adresse https de l'application (jamais `http://192.168…` : les notifications et l'installation n'y fonctionnent pas).
- [ ] **Deux téléphones**, avec l'application **installée depuis l'adresse https** et les notifications **activées** (Notifications, puis Mes alertes, puis « Notifications sur cet appareil », puis Activer). Idéalement un Android et un iPhone.
- [ ] Une connexion internet fiable (le partage de connexion d'un téléphone fait l'affaire).

### Les comptes de démonstration
Créer dans Administration, puis Utilisateurs, un compte par rôle, avec des prénoms parlants. Se connecter une fois avec chacun pour changer le mot de passe temporaire.

| Compte | Rôle | Appareil pendant la démo |
|---|---|---|
| Le patron (le client lui-même) | Propriétaire | Ordinateur, et son téléphone s'il veut |
| Le responsable du restaurant | Éditeur | — |
| Le technicien | Commentateur (technicien) | Téléphone 1 |
| Un employé en cuisine | Lecteur | Téléphone 2 |

⚠️ **On n'est jamais prévenu de sa propre action.** Si tu déclares une panne avec le compte du patron, le patron ne reçoit rien. Pour montrer une notification, il faut **agir avec un compte et recevoir sur un autre** : le technicien déclare, le patron reçoit.

### Les données
- [ ] Nettoyer les pannes, photos et catégories de test créées pendant les essais.
- [ ] Garder une ou deux interventions réalistes déjà en cours, par exemple « Grand frigo 2, CTR1 : ne refroidit pas, en attente de pièce ».
- [ ] Mettre une ou deux pièces juste au-dessus de leur seuil, pour montrer l'alerte « stock bas » pendant la clôture.
- [ ] Donner un plan d'entretien à quelques machines, dont une en retard, pour que le tableau de bord ne soit pas vide.

### Les mails
Sans nom de domaine, Resend n'envoie qu'à **une seule adresse** : celle du compte Resend. Pour que ce soit le client qui reçoive les mails pendant la présentation, il faut **son** compte Resend (voir `docs/guide-developpeur.md`, « Mails : passer de mon e-mail à celui du client »).
💬 Si on lui pose la question : « Pour la démonstration, tous les mails arrivent dans une seule boîte. En production, avec un nom de domaine, chacun recevra les siens. »

### Répétition
- [ ] Faire le parcours complet une fois, en entier, la veille.
- [ ] Vérifier qu'une notification arrive bien sur le téléphone du patron quand le technicien déclare une panne.

---

## 2. Introduction (3 minutes)

💬 « Aujourd'hui, quand une machine tombe en panne, l'information passe par téléphone ou WhatsApp, et on perd la trace de ce qui a été fait, des pièces utilisées et du coût. Cette application sert à trois choses :
1. **déclarer une panne en 30 secondes**, depuis le téléphone, par n'importe qui dans le restaurant ;
2. **suivre la réparation** jusqu'au bout, en sachant qui s'en occupe et où elle en est ;
3. **prévenir plutôt que réparer** : les entretiens réguliers et le stock de pièces sont suivis automatiquement. »

💬 « Elle fonctionne sur téléphone et sur ordinateur, sans rien installer depuis un magasin d'applications. Vos deux restaurants y sont déjà, avec leurs 49 machines. »

---

## 3. La connexion (2 minutes)

▶ Page de connexion, sur l'ordinateur.

💬 « Chacun a son compte, avec son e-mail et son mot de passe. Personne ne peut s'inscrire tout seul : c'est vous, ou votre responsable, qui créez les comptes. À la première connexion, la personne doit choisir son propre mot de passe. »

▶ Se connecter avec le compte du patron.

---

## 4. Le tableau de bord (5 minutes)

▶ La page d'accueil.

💬 « C'est la première chose que vous voyez chaque matin. En haut, quatre chiffres :
- **Urgences en cours** : les pannes urgentes pas encore réparées ;
- **Machines en panne** ;
- **Entretiens en retard** ;
- **Pièces sous le seuil** : les pièces qu'il faut racheter.

Un chiffre coloré demande votre attention. S'il n'y a rien, c'est « Tout fonctionne ». »

▶ Descendre : **À traiter en priorité**, puis **Par restaurant**.

💬 « Ici, la liste de ce qu'il faut traiter d'abord, les urgences en tête. En dessous, l'état de chaque restaurant, pour voir d'un coup d'œil lequel a des soucis. »

▶ Sur ordinateur, montrer **Entretiens des 7 jours** et **Stock sous le seuil**, puis le **sélecteur de restaurant** (CTR1 / CTR2).

💬 « Vous pouvez tout regarder, ou un seul restaurant. »

---

## 5. Les équipements (7 minutes)

▶ Menu **Équipements** : la liste.

💬 « Toutes vos machines sont ici, restaurant par restaurant. Chacune a un code unique, par exemple CTR1-REF-01 : le restaurant, le type de machine, puis un numéro. Les pannes apparaissent toujours en premier. »

▶ Taper « frigo » dans la recherche, puis utiliser les filtres (restaurant, catégorie, état, entretien).

▶ Ouvrir une machine : sa **fiche**.

💬 « Sur la fiche, vous trouvez l'état de la machine, sa marque, son plan d'entretien, et surtout sa **fiche de vie** : toutes les pannes, réparations et entretiens depuis le début. Au bout d'un an, vous saurez quelle machine vous coûte le plus et quand il vaut mieux la remplacer. »

▶ Montrer **le plan d'entretien** (tous les mois, 3 mois, 6 mois ou chaque année) et le bouton **« Noter l'entretien »**.

💬 « Quand le technicien fait un entretien, il appuie ici. L'application calcule la prochaine date et vous prévient 3 jours avant, puis chaque matin si c'est en retard. »

▶ Montrer **Ajouter un équipement** : le code proposé automatiquement, la catégorie, la marque.

💬 « Pour une nouvelle machine, le code se crée tout seul. »

---

## 6. Déclarer une panne (8 minutes, le moment fort)

▶ Prendre le **téléphone du technicien**, ou de l'employé.

💬 « Une machine tombe en panne pendant le service. N'importe qui dans le restaurant peut la déclarer, avec le gros bouton orange **Déclarer une panne**, présent sur tous les écrans. »

▶ Étape 1 : choisir le restaurant, chercher la machine (« friteuse »), la choisir.

💬 « Si la machine n'est pas dans la liste, on peut la décrire avec ses mots. »

▶ Étape 2 :
- choisir les **symptômes** (Ne démarre pas, Ne chauffe pas, Ne refroidit pas, Fuite, Bruit anormal, Odeur de brûlé), et ajouter un détail si besoin ;
- répondre à **« Est-ce urgent ? »** : c'est obligatoire, il n'y a pas de choix par défaut ;
- choisir **l'état de l'intervention** (À planifier, En cours, En attente de pièce) ; ce choix n'apparaît que pour le technicien, le responsable et le patron ;
- **prendre une photo** de la panne, jusqu'à 3.

💬 « La photo aide le technicien à comprendre avant même de se déplacer. Elle est réduite automatiquement pour ne pas consommer trop de données. »

▶ Envoyer. Écran de confirmation.

▶ **Sur le téléphone du patron** (ou l'ordinateur) : la notification arrive.

💬 « Le patron, le responsable et les techniciens du restaurant sont prévenus immédiatement, sur leur téléphone, même application fermée. Pour une urgence ou une panne, un mail part aussi. »

⚠️ Si une panne est déjà en cours sur cette machine, un avertissement s'affiche. On peut quand même envoyer, pour ne jamais bloquer une vraie urgence.

---

## 7. Suivre et clôturer une intervention (8 minutes)

▶ Menu **Interventions**.

💬 « Chaque panne devient une intervention. L'onglet **En cours** montre tout ce qui n'est pas terminé : ce qui est à planifier, en cours, ou en attente d'une pièce. Les urgences sont en haut. »

▶ Ouvrir l'intervention qu'on vient de créer. Montrer le **statut** et le changer : À planifier → En cours.

💬 « Le technicien, le responsable ou vous-même faites avancer le statut. La personne qui a déclaré la panne est prévenue à chaque changement : elle sait que quelqu'un s'en occupe. »

▶ Passer en **En attente de pièce**.

💬 « Si on attend une pièce, tout le monde le voit, et personne ne rappelle le technicien pour rien. »

▶ Montrer **Enregistrer sans clôturer** : noter le travail en cours et choisir le technicien.

▶ **Clôturer** :
- « ce qui a été fait » (obligatoire) ;
- les **pièces utilisées** et leur quantité, avec le stock restant affiché ; montrer l'avertissement « sous le seuil » ;
- **l'état de la machine** après la réparation (Opérationnel, En panne, Hors service) ;
- le technicien ;
- **les photos « après »**, jusqu'à 3.

💬 « En clôturant, trois choses se font toutes seules : le stock des pièces diminue, la machine redevient opérationnelle, et la réparation s'inscrit dans sa fiche de vie. Si une pièce passe sous le seuil, vous êtes prévenu qu'il faut en racheter. »

▶ Rouvrir la fiche de la machine : la réparation est dans la fiche de vie, avec les photos avant et après dans l'intervention.

⚠️ Une intervention terminée ne peut plus être rouverte. Si la machine retombe en panne, on déclare une nouvelle panne : l'historique reste propre.

---

## 8. Le stock (5 minutes)

▶ Menu **Stock**.

💬 « Le stock est commun à toute la chaîne. Les pièces sous leur seuil sont en premier. »

▶ Ouvrir une pièce : sa fiche, **« Va avec »** (les machines prévues pour cette pièce) et **« Utilisée sur »** (les machines où elle a vraiment servi).

▶ Montrer **Livraison** (on ajoute des pièces reçues) et les boutons **− / +** (correction d'inventaire).

💬 « Les quantités ne se tapent jamais à la main : elles bougent seulement par une livraison, une correction d'inventaire ou une réparation. Chaque mouvement est tracé, donc le chiffre est toujours juste. »

▶ Montrer **Nouvelle pièce** et le seuil d'alerte.

---

## 9. Notifications et alertes (4 minutes)

▶ Menu **Notifications** (la cloche).

💬 « Tout ce qui se passe arrive ici : urgences, pannes, entretiens à prévoir ou en retard, stock bas, réparations terminées, suivi de vos pannes. »

▶ Ouvrir **Mes alertes**.

💬 « Chacun choisit ce qu'il veut recevoir. Le technicien peut couper les alertes de stock, par exemple. Et c'est ici qu'on active les notifications sur son téléphone. »

▶ Montrer **Tout marquer comme lu**.

---

## 10. L'administration (5 minutes)

▶ Menu **Administration** (réservé au patron et au responsable).

**Utilisateurs**
💬 « Vous créez les comptes ici. Vous choisissez le rôle et le ou les restaurants. L'application donne un mot de passe temporaire, qui ne s'affiche qu'une fois : vous le transmettez à la personne, qui le change à sa première connexion. »

Les rôles, en une phrase chacun :

| Rôle | En clair |
|---|---|
| **Propriétaire** | Vous. Vous voyez et faites tout, dans tous les restaurants. |
| **Éditeur** | Le responsable. Il gère les machines, le stock, les interventions et les comptes de son équipe, dans ses restaurants. |
| **Technicien** | Il fait avancer et clôture les interventions, note les entretiens et déclare les pannes. |
| **Lecteur** | Un employé. Il consulte et déclare une panne, c'est tout. |

💬 « Ces droits sont protégés dans la base de données elle-même, pas seulement à l'écran. Un technicien de Ouaga 2000 ne voit pas les données de Kamboinsin. »

**Restaurants** (propriétaire seulement)
💬 « Pour ouvrir un troisième restaurant, vous l'ajoutez ici. Vous pouvez même copier la liste des machines d'un restaurant existant : les codes se créent tout seuls. »

**Catégories**
💬 « Les familles de machines (Réfrigération, Cuisson…) avec leur code et leur icône. Vous pouvez en ajouter. »

---

## 11. Installer l'application sur le téléphone (3 minutes)

▶ Sur un téléphone, montrer le bandeau **« Installez l'application pour recevoir les urgences »**.

- **Android** : bouton **Installer**.
- **iPhone** : bouton **Partager**, puis **« Sur l'écran d'accueil »**, puis ouvrir l'application depuis sa nouvelle icône.

Ensuite, dans les deux cas : Notifications, Mes alertes, **Activer**.

💬 « L'application s'installe comme une vraie application, avec son icône. Sur iPhone, c'est même obligatoire pour recevoir les notifications. Chaque personne le fait une fois sur son téléphone. »

---

## 12. Questions probables et réponses

| Question | Réponse |
|---|---|
| Mes données sont-elles en sécurité ? | Elles sont hébergées chez Supabase (en Europe), avec une connexion chiffrée. Chaque personne ne voit que ses restaurants, et les droits sont vérifiés par la base de données elle-même. Les photos ne sont pas publiques. |
| Et sans internet ? | Il faut une connexion (4G ou Wi-Fi) pour déclarer ou consulter. Il n'y a pas de mode hors ligne. |
| Combien d'utilisateurs ? | Autant que nécessaire : chaque employé peut avoir son compte. |
| Combien ça coûte à faire tourner ? | Les services utilisés ont une offre gratuite suffisante pour deux restaurants. Des offres payantes existent si l'usage grandit (plus de photos, sauvegardes plus longues). |
| Les mails vont-ils à chacun ? | En démonstration, ils arrivent dans une seule boîte. En production, avec un nom de domaine (le vôtre ou un nom acheté, environ 10 € par an), chacun reçoit les siens. |
| Peut-on mettre plus de 3 photos ? | Oui, avec l'offre payante de stockage. C'est un réglage, pas un développement. |
| Ajouter un restaurant ? | Oui, en quelques clics, dans Administration. |
| Un employé part ? | Vous supprimez son compte dans Administration. Les pannes et réparations qu'il a faites restent dans l'historique, sans son nom. |
| Les données sont-elles sauvegardées ? | Oui, par l'hébergeur, avec en plus des copies manuelles possibles avant chaque grosse mise à jour. |

---

## 13. Ce qu'il faut annoncer honnêtement

Des limites connues, à présenter comme des évolutions possibles :
- **pas de mode hors ligne** ;
- **les mails ne partent vers chaque destinataire qu'avec un nom de domaine** ;
- **pas encore d'intervention sans panne** (par exemple des travaux planifiés) : on passe par une déclaration ;
- **une intervention terminée ne se rouvre pas** ;
- **3 photos avant et 3 photos après** par intervention avec l'offre gratuite.

---

## 14. Conclusion et suite (2 minutes)

💬 « Pour démarrer, il reste trois étapes :
1. créer les comptes de votre équipe (je peux le faire avec vous) ;
2. installer l'application sur le téléphone de chacun et activer les notifications ;
3. si vous le souhaitez, brancher votre nom de domaine pour que chacun reçoive ses mails. »

Évolutions possibles à proposer :
- rapports mensuels (coût par machine, pannes les plus fréquentes) ;
- interventions planifiées sans panne ;
- mail de bienvenue à la création d'un compte ;
- plus de photos.
