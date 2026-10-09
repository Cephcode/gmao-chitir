# Formation : reprendre la GMAO Chitir en main

Bienvenue. Cette formation est écrite pour **toi**, qui vas reprendre ce projet **sans être développeur web confirmé** et sans connaître Next.js. Elle part de zéro, mais elle ne parle jamais « dans le vide » : chaque notion est expliquée **avec le vrai code de la GMAO**, en te montrant le fichier où elle se trouve.

À la fin, tu sauras :
- comment le web fonctionne, et comment **Next.js** fabrique les pages ;
- comment **ce projet** est organisé (son architecture) et **à quoi sert chaque fonction** ;
- comment **modifier** un écran existant et **ajouter tes propres fonctionnalités** ;
- comment **tester**, **trouver une erreur** et **mettre en ligne**.

---

## Le parcours

Les chapitres se lisent **dans l'ordre**. Chacun se termine par un petit **« Ce qu'il faut retenir »** et, souvent, un **exercice** à faire sur ton poste (les solutions sont au chapitre 11).

| N° | Chapitre | Ce que tu y apprends | Temps |
|---|---|---|---|
| 01 | [Installer ton poste](01-installer-son-poste.md) | Les outils, le terminal, récupérer et lancer le projet | 1 h |
| 02 | [Les bases du web](02-bases-du-web.md) | Navigateur, serveur, HTTP, HTML/CSS/JS, base de données, session | 45 min |
| 03 | [JavaScript et TypeScript utiles](03-javascript-typescript.md) | Juste ce qu'il faut pour lire et écrire le code du projet | 1 h 30 |
| 04 | [React](04-react.md) | Composants, props, JSX, état, formulaires | 1 h 30 |
| 05 | [Next.js, comment ça marche](05-nextjs.md) | Le fonctionnement global de Next, appliqué à la GMAO | 2 h |
| 06 | [L'architecture du projet](06-architecture.md) | Les couches, les dossiers, l'anatomie d'un module, les flux | 1 h |
| 07 | [La base de données](07-base-de-donnees.md) | SQL, Supabase, migrations, droits (RLS), fonctions SQL | 1 h 30 |
| 08 | [Référence du code : qui fait quoi](08-reference-du-code.md) | Chaque fichier, chaque fonction, chaque action, chaque fonction SQL | à consulter |
| 09 | [Ajouter tes fonctionnalités](09-ajouter-une-fonctionnalite.md) | La méthode, puis des recettes pas à pas, du petit changement au module complet | 2 h |
| 10 | [Tester, déboguer, livrer](10-tester-deboguer-livrer.md) | Tests, lecture des erreurs, Git, mise en production | 1 h |
| 11 | [Exercices et solutions](11-exercices.md) | Pour vérifier que tu as compris | 2 h |
| 12 | [Lexique](12-lexique.md) | Tous les mots techniques, expliqués simplement | à consulter |

**Rythme conseillé** : chapitres 01 à 04 le premier jour, 05 à 07 le deuxième, 09 à 11 le troisième. Le 08 et le 12 se consultent au besoin.

**Déjà à l'aise avec le web ?** Lis directement 05, 06 et 09.

---

## Les autres documents du projet

Cette formation **enseigne**. Les autres documents servent de **références** une fois que tu as compris :

| Document | Quand l'ouvrir |
|---|---|
| `docs/comprendre-le-projet.md` | Le résumé de cette formation en une page : à garder ouvert comme aide-mémoire |
| `docs/guide-developpeur.md` | La carte détaillée : chaque écran, les pièges déjà rencontrés |
| `docs/base-de-donnees.md` | La liste complète des tables, fonctions SQL et droits |
| `docs/taches-restantes.md` | Où en est le projet, ce qu'il reste à faire |
| `docs/journal-decisions.md` | Pourquoi telle chose a été faite comme ça |
| `docs/plan-module-consommables.md` | Un exemple réel de module ajouté de A à Z |

---

## Comment lire les exemples

- Un bloc comme celui-ci est une **commande à taper dans le terminal** :
  ```bash
  npm run dev
  ```
- Un bloc avec `ts` ou `tsx` est du **code** (TypeScript). Le nom du fichier est indiqué juste au-dessus ou en commentaire en première ligne.
- `app/(app)/stock/page.tsx` est un **chemin de fichier**, à partir du dossier du projet.
- Les commentaires dans le code commencent par `//`. Ils sont là pour toi : ils expliquent, ils ne s'exécutent pas.
- 💡 = astuce. ⚠️ = piège fréquent. 🔒 = sécurité.

**La règle d'or de l'apprentissage** : ne te contente pas de lire. **Ouvre chaque fichier cité** dans ton éditeur, et fais les exercices. On comprend un projet en le manipulant.

👉 Commence par le [chapitre 01](01-installer-son-poste.md).
