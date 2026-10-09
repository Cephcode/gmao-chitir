# Chapitre 10 — Tester, déboguer, livrer

**Objectif** : savoir vérifier ton travail, trouver d'où vient une erreur, utiliser Git sans crainte, et mettre une modification en production **dans le bon ordre**.

---

## 1. Les quatre vérifications

| Commande | Ce qu'elle vérifie | Durée |
|---|---|---|
| `npx tsc --noEmit` | **Types** : une donnée mal utilisée, un champ oublié, un import cassé | 10 s |
| `npx eslint .` | **Style et erreurs courantes** : variable inutilisée, hook mal placé, apostrophe non échappée | 20 s |
| `bash supabase/tests/run.sh` | **La base** (droits, règles métier) et les **règles pures** de `lib/*-rules.ts` | 1 à 2 min (base locale démarrée) |
| `npm run build` | Que **la version de production** se fabrique (ce que fera Vercel) | 1 min |

Lance les trois premières **avant chaque commit**. Le résultat attendu :

```
TOTAL : 801 réussis, 0 échoués
```

Si un test échoue, demande-toi d'abord : **est-ce le code ou le test qui a tort ?** Si tu as volontairement changé une règle, mets le test à jour ; sinon, c'est que tu as cassé quelque chose.

### Les deux sortes de tests du projet

| Où | Quoi | Outil | Exemple |
|---|---|---|---|
| `supabase/tests/*.sql` | Droits par rôle et restaurant, règles en base (stock jamais négatif, alertes…) | pgTAP | `13_consommables.sql` |
| `tests/*.test.ts` | Règles pures de `lib/*-rules.ts` (calculs, validations, filtres) | `node --test` | `consommables-rules.test.ts` |

Un test de règle pure ressemble à ceci :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ecartInventaire } from "@/lib/consommables-rules";

test("écart d'inventaire = compté − en stock", () => {
  assert.equal(ecartInventaire(12, 15), 3);
  assert.equal(ecartInventaire(15, 10), -5);
});
```

Lancer un seul fichier : `node --test --import ./tests/register.mjs tests/consommables-rules.test.ts`.

**Les écrans ne sont pas testés automatiquement** : vérifie-les à la main, avec **chaque rôle concerné**, sur **mobile (390 et 360 px) et ordinateur**.

---

## 2. Déboguer : la méthode

Quand quelque chose ne marche pas :

```
1. LIRE le message d'erreur en entier (pas seulement la 1re ligne)
2. TROUVER où il s'affiche → ça dit quelle couche a planté
3. ALLER à la première ligne de la pile qui pointe vers TON code
4. VÉRIFIER une hypothèse à la fois (console.log, Studio, F12)
5. CORRIGER, puis relancer les vérifications
```

### Où regarder

| L'erreur s'affiche… | Elle vient de… | Où chercher |
|---|---|---|
| dans le **terminal** de `npm run dev` | le serveur : page, layout, action, lecture en base | le fichier et la ligne indiqués |
| dans un **panneau rouge** en bas de la page (dev) | idem, ou un composant client | cliquer pour voir la pile |
| dans la **console du navigateur** (F12) | un composant **client** | le fichier `.tsx` indiqué |
| à l'écran, en **français**, dans un formulaire | la **base** (message d'une fonction SQL ou d'une contrainte) | `grep -rn "le message" supabase/migrations` |
| la page « Impossible d'afficher cette page » | une erreur serveur non prévue (`error.tsx`) | le terminal (dev) ou les logs Vercel (en ligne) |
| **en ligne seulement** | configuration, variables, base hébergée | Vercel → Deployments → Logs ; Supabase → Logs |

### Les erreurs les plus fréquentes

| Message | Cause | Solution |
|---|---|---|
| `Property 'x' does not exist on type 'Promise<…>'` | `await` oublié | ajouter `await` |
| `Cannot read properties of undefined (reading 'name')` | une donnée vide | `?.`, ou vérifier que la lecture renvoie bien quelque chose |
| `You're importing a component that needs useState…` | `"use client"` manquant | l'ajouter en 1re ligne |
| `params should be awaited` / `searchParams…` | Next 16 | `await props.params` |
| `Cannot find name 'PageProps'` | types de Next pas générés | `npx next typegen` |
| `permission denied for function …` | `grant execute` oublié | nouvelle migration avec le `grant` |
| `new row violates row-level security policy` (code `42501`) | la RLS refuse l'écriture | vérifier le rôle et le restaurant de l'usager, et les règles de la table |
| la donnée existe mais ne s'affiche pas | la RLS filtre la lecture (pas d'erreur, zéro ligne) | se connecter avec un compte qui y a accès |
| l'écran ne se met pas à jour après un enregistrement | `revalidatePath` oublié | l'ajouter dans l'action |
| `duplicate key value violates unique constraint` (code `23505`) | doublon | traduire l'erreur en message clair dans l'action |
| `unsafe use of new value` | valeur d'enum utilisée dans sa propre migration | deux migrations séparées |
| `Hydration failed` | le serveur et le navigateur dessinent différemment (date, aléatoire) | calculer la valeur côté serveur et la passer en prop |

### `console.log`, ton meilleur outil

```ts
console.log("filtres =", filters);
console.log("résultat de la base =", { data, error });
```

- dans une page, un layout, une action : la sortie est dans le **terminal** ;
- dans un composant `"use client"` : dans la **console du navigateur**.

**Retire-les avant de commiter.**

### Regarder les données

- **Studio local** (chapitre 07) : la ligne a-t-elle bien été écrite ? avec quelles valeurs ?
- **Se connecter avec un autre rôle** (fenêtre de navigation privée) pour voir ce qu'il voit.

---

## 3. Git, l'essentiel

Git garde **l'historique** de chaque modification. Tu peux toujours revenir en arrière.

### Les notions

| Mot | Sens |
|---|---|
| **dépôt** (*repository*) | le projet et tout son historique |
| **commit** | une « photo » enregistrée des fichiers, avec un message |
| **branche** | une ligne de travail parallèle ; on y travaille sans toucher aux autres |
| **`staging`** | la branche de travail du projet |
| **`main`** | la branche de **production** : ce qui y entre part en ligne |
| **push / pull** | envoyer vers GitHub / récupérer depuis GitHub |
| **pull request** (PR) | sur GitHub, une demande de fusion d'une branche dans une autre, avec relecture |

### Le cycle de travail quotidien

```bash
git checkout staging            # aller sur la branche de travail
git pull                        # récupérer les dernières modifications
git checkout -b ajout-unite-boite    # créer TA branche pour cette tâche

# … modifier, vérifier …

git status                      # voir ce qui a changé
git diff                        # voir le détail des changements
git add -A                      # préparer tous les changements
git commit -m "Consommables : unité « boîte »"    # enregistrer, avec un message clair en français
git push -u origin ajout-unite-boite              # envoyer sur GitHub
```

Puis sur GitHub : **Pull request** de ta branche vers `staging`, relecture, **Merge**.

**Messages de commit** : commence par le module, puis ce qui change : « Stock : alerte au seuil », « Docs : formation ». Regarde `git log --oneline` pour voir le style du projet.

### Les commandes de secours

| Situation | Commande |
|---|---|
| Annuler mes modifications d'un fichier (pas encore commitées) | `git checkout -- chemin/du/fichier` |
| Mettre de côté mes modifications pour changer de branche | `git stash` (puis `git stash pop` pour les reprendre) |
| Voir l'historique | `git log --oneline -20` |
| Annuler un commit déjà poussé (sans réécrire l'historique) | `git revert <identifiant du commit>` |

🔒 **Jamais** de fichier `.env…` ni de clé dans un commit. `.gitignore` les exclut ; vérifie avec `git status` avant `git add`.

---

## 4. Livrer : de ton poste à la production

### Les trois environnements (rappel du chapitre 06)

```
ton poste (base locale)  ──push──►  prévisualisation Vercel (base hébergée)  ──fusion dans main──►  PRODUCTION
```

### L'ordre de livraison, à respecter

```
① Tout vérifier en local : tsc, eslint, tests, essai à la main
② Pousser ta branche ; PR vers staging ; fusion
   → Vercel construit une adresse de PRÉVISUALISATION (https) : teste sur un vrai téléphone
③ SI la base change : mettre à jour la base hébergée
      cat supabase/.temp/project-ref      # ⚠️ vérifier qu'on vise le bon projet
      supabase db push --dry-run          # voir ce qui partirait (seulement tes nouvelles migrations)
      supabase db push                    # appliquer
      supabase migration list             # vérifier : local et hébergé alignés
④ SI l'Edge Function change : supabase functions deploy envoyer-notification
⑤ PR staging → main ; fusion → Vercel met en PRODUCTION (2 à 3 minutes)
⑥ Vérifier en production : https://gmao-chitir.vercel.app
```

**Pourquoi la base avant le code ?** Le nouveau code a besoin des nouvelles tables. Pendant les quelques minutes entre ③ et ⑤, l'**ancien** code tourne avec la **nouvelle** base : c'est pourquoi une migration doit **ajouter** sans casser (pas de renommage ni de suppression de colonne utilisée).

⚠️ La prévisualisation (②) utilise la **base hébergée**. Si ta modification ajoute une table, la prévisualisation ne fonctionnera qu'après ③. Pour un changement de base, tu peux faire ③ avant ②, puisque la migration est compatible avec l'ancien code.

### Si quelque chose casse en production

1. **Vercel → Deployments** : choisis le déploiement précédent qui fonctionnait → **Promote / Instant Rollback**. L'ancienne version revient en une minute.
2. Corrige ensuite tranquillement sur une branche, et relivre.
3. Une migration ne s'annule pas toute seule : écris une **nouvelle migration** qui corrige.

### Avant une grosse modification de base : une sauvegarde

```bash
supabase db dump -f sauvegarde-AAAA-MM-JJ.sql     # garder ce fichier HORS du dépôt
```

---

## 5. Surveiller après une livraison

| Quoi | Où |
|---|---|
| Erreurs du serveur | Vercel → Deployments → le déploiement → **Logs** |
| Erreurs de la base, des fonctions SQL | Supabase → **Logs** → Postgres |
| Notifications non envoyées | Supabase → Edge Functions → `envoyer-notification` → Logs ; table `notifications` (`delivered_at`) |
| E-mails | Resend → **Emails** |
| Tâche du matin | Supabase → Database → **Cron** |

La liste complète des pièges déjà rencontrés et de leurs solutions : `docs/guide-developpeur.md`, section 12.

---

## ✅ Ce qu'il faut retenir

- Avant chaque commit : `npx tsc --noEmit`, `npx eslint .`, `bash supabase/tests/run.sh`.
- Déboguer = **lire** l'erreur, **où** elle s'affiche, **première ligne de ton code**, une hypothèse à la fois.
- Une **branche par tâche** ; PR vers `staging` ; `main` = production.
- Livraison : **base (`supabase db push`) avant code (fusion dans `main`)** ; migrations qui ajoutent sans casser.
- En cas de problème en ligne : **Instant Rollback** sur Vercel.

## 🏋️ Exercice 10

1. Lance les trois vérifications sur ton poste. Combien de tests réussissent ?
2. Crée une branche `essai-git`, change un libellé, commite, puis reviens sur `staging` : le libellé a-t-il changé ? Reviens sur `essai-git` : et maintenant ?
3. Dans `lib/consommables-rules.ts`, casse volontairement `ecartInventaire` (inverse la soustraction) et lance `bash supabase/tests/run.sh`. Quel test échoue ? Remets la fonction en état.

👉 Chapitre suivant : [Exercices et solutions](11-exercices.md)
