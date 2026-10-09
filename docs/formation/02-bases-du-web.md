# Chapitre 02 — Les bases du web

**Objectif** : comprendre ce qui se passe entre le moment où quelqu'un ouvre la GMAO sur son téléphone et celui où la page s'affiche. Sans ces bases, Next.js paraît magique ; avec elles, tout devient logique.

---

## 1. Client et serveur

Deux ordinateurs discutent :

- le **client** : le navigateur (Chrome, Safari) sur le téléphone ou l'ordinateur de l'usager ;
- le **serveur** : un ordinateur allumé en permanence, quelque part, qui répond aux demandes. Pour la GMAO, c'est **Vercel** (en Irlande, à Dublin).

```
  Téléphone (client)                          Vercel (serveur)
  ──────────────────                          ────────────────
  « Donne-moi la page /stock »   ───────►     fabrique la page
                                 ◄───────     renvoie la page (HTML)
  affiche la page
```

Le serveur lui-même discute avec un troisième ordinateur : la **base de données** (Supabase, aussi en Irlande), qui garde les données.

🔒 **Pourquoi c'est important** : ce qui tourne **sur le client** peut être lu et modifié par l'usager (n'importe qui peut ouvrir les outils du navigateur). Ce qui tourne **sur le serveur** est hors de sa portée. Les secrets et les vérifications de droits vivent donc côté serveur et côté base.

---

## 2. HTTP : la langue du web

Le client et le serveur parlent **HTTP**. Chaque échange est une **requête** puis une **réponse**.

Une requête contient :
- une **adresse** (URL) : `https://gmao-chitir.vercel.app/stock?statut=sous_seuil`
- une **méthode** : `GET` (« donne-moi », pour afficher une page) ou `POST` (« voici des données », pour envoyer un formulaire) ;
- des **en-têtes**, dont les **cookies** (voir section 6) ;
- parfois un **corps** (les données d'un formulaire).

Décortiquons l'adresse :

```
https://gmao-chitir.vercel.app/stock/8f3a…?statut=sous_seuil&q=filtre
└─┬─┘   └────────┬──────────┘└────┬────┘ └──────────┬───────────┘
protocole   nom du site       chemin       paramètres (après le « ? »,
(chiffré)                    (la page)      séparés par « & »)
```

Dans la GMAO :
- le **chemin** (`/stock/8f3a…`) dit **quelle page** : la fiche de la pièce n° 8f3a… ;
- les **paramètres** (`?statut=sous_seuil`) disent **quels filtres** appliquer.

La réponse contient un **code** : `200` (tout va bien), `307` (va plutôt à telle adresse : une *redirection*), `404` (page introuvable), `500` (erreur du serveur).

💡 Tu peux voir tous ces échanges : dans Chrome, **F12 → onglet Réseau (Network)**, puis recharge la page.

---

## 3. HTML, CSS, JavaScript : les trois langages du navigateur

Le navigateur ne comprend que trois langages :

| Langage | Rôle | Analogie |
|---|---|---|
| **HTML** | La **structure** : titres, paragraphes, boutons, champs | le squelette |
| **CSS** | L'**apparence** : couleurs, tailles, positions | les vêtements |
| **JavaScript** (JS) | Le **comportement** : réagir à un clic, envoyer un formulaire sans recharger | les muscles |

Un bout de HTML :

```html
<h1>Stock</h1>
<button class="bouton">Enregistrer une livraison</button>
```

Du CSS qui l'habille :

```css
.bouton { background: orange; border-radius: 8px; }
```

Du JavaScript qui le fait réagir :

```js
document.querySelector(".bouton").addEventListener("click", () => alert("Cliqué !"));
```

**Dans la GMAO, tu n'écris presque jamais ces trois langages séparément** :
- le HTML s'écrit **dans le code TypeScript**, sous une forme appelée **JSX** (chapitre 04) ;
- le CSS s'écrit **avec des classes Tailwind** directement sur les éléments (`className="bg-orange rounded"`) ;
- le JavaScript s'écrit en **TypeScript** (du JavaScript avec des types, chapitre 03).

Mais au final, c'est bien du HTML, du CSS et du JavaScript que le navigateur reçoit.

---

## 4. Le DOM et les outils du navigateur

Quand le navigateur reçoit le HTML, il le transforme en un **arbre d'éléments** en mémoire : le **DOM**. C'est ce que tu vois, et ce que JavaScript modifie quand la page change sans recharger.

**Les outils de développement** (F12 ou clic droit → **Inspecter**) sont ton meilleur ami :

| Onglet | À quoi il sert |
|---|---|
| **Éléments** | Voir le HTML et le CSS de chaque élément (survole, clique) |
| **Console** | Voir les erreurs JavaScript et les messages `console.log` |
| **Réseau** | Voir chaque requête, sa réponse, son code |
| **Application** | Voir les cookies (dont la session) |
| Icône 📱 en haut à gauche | **Simuler un téléphone** (choisis une largeur de 390 px, puis 360 px) |

🏋️ Ouvre la GMAO en local, appuie sur F12, choisis l'icône 📱 et une largeur de 390 px : tu vois la version mobile.

---

## 5. La base de données

Une **base de données** range les informations dans des **tables**, comme des feuilles de tableur :

Table `restaurants` :

| id | name | short_code |
|---|---|---|
| a1b2… | Chitir Chicken Ouaga 2000 | CTR1 |
| c3d4… | Chitir Chicken Kamboinsin | CTR2 |

- Chaque **ligne** est un enregistrement (un restaurant).
- Chaque **colonne** est une information (son nom, son code).
- La colonne **`id`** est l'identifiant unique de la ligne (une longue suite de caractères appelée **UUID**).
- Une table peut **pointer** vers une autre : la table `equipments` a une colonne `restaurant_id` qui contient l'`id` d'un restaurant. C'est une **clé étrangère** : elle relie chaque machine à son restaurant.

On parle à la base en **SQL** :

```sql
select name, short_code from restaurants order by short_code;
```

La GMAO utilise **PostgreSQL** (une base SQL très répandue), hébergée par **Supabase**. Le chapitre 07 y revient en détail.

---

## 6. La session : comment le site sait qui tu es

HTTP **oublie tout** entre deux requêtes : le serveur ne sait pas, à la deuxième page, que tu t'es connecté à la première. La solution : le **cookie**.

1. Tu te connectes : le serveur vérifie ton e-mail et ton mot de passe auprès de Supabase.
2. Supabase renvoie un **jeton** (une longue chaîne signée qui dit « c'est bien l'usager 5ad9… »).
3. Le serveur range ce jeton dans un **cookie** : un petit fichier que le navigateur garde et **renvoie automatiquement à chaque requête**.
4. À chaque page, le serveur lit le cookie, et sait qui tu es.

Dans la GMAO, tout cela est géré par la bibliothèque `@supabase/ssr`, dans `lib/supabase/server.ts` et `lib/supabase/middleware.ts`. Tu n'as pas à y toucher, mais tu sais maintenant ce qu'il se passe.

---

## 7. API, bibliothèque, framework

- Une **bibliothèque** est du code écrit par d'autres, que tu utilises : `@supabase/supabase-js` (parler à Supabase), `firebase` (notifications).
- Un **framework** est une bibliothèque qui impose une **organisation** : tu écris ton code là où il l'attend, et il s'occupe du reste. **Next.js est un framework.** C'est lui qui décide que le fichier `app/(app)/stock/page.tsx` répond à l'adresse `/stock`.
- Une **API** est une « porte » par laquelle un programme parle à un autre. Supabase offre une API : notre code lui envoie des demandes (« donne-moi les pièces ») et reçoit des réponses en **JSON** (un format texte de données : `{ "name": "Filtre", "quantity": 10 }`).

---

## 8. L'application « installable » (PWA)

La GMAO peut s'**ajouter à l'écran d'accueil** du téléphone et s'ouvrir comme une application. On appelle ça une **PWA** (Progressive Web App). Ce n'est pas une application des stores : c'est le même site, avec :
- un **manifeste** (`app/manifest.ts`) : le nom et les icônes de l'application ;
- un **service worker** (`app/firebase-messaging-sw.js/route.ts`) : un petit programme qui tourne en arrière-plan dans le navigateur et **reçoit les notifications push** même quand l'application est fermée.

---

## ✅ Ce qu'il faut retenir

- **Client** (navigateur) ↔ **serveur** (Vercel) ↔ **base** (Supabase).
- Une page = une **requête HTTP** vers une **adresse** ; les **paramètres** après le `?` portent les filtres.
- Le navigateur ne comprend que **HTML, CSS, JavaScript** ; dans le projet, on les écrit en **JSX, Tailwind, TypeScript**.
- La **session** passe par un **cookie** renvoyé à chaque requête.
- 🔒 Tout ce qui est côté client peut être modifié par l'usager : **les droits se vérifient côté serveur et base**.

## 🏋️ Exercice 2

1. Dans la GMAO, va sur **Stock**, clique sur l'onglet « Sous le seuil ». Regarde l'adresse : qu'est-ce qui a changé ?
2. Ouvre F12 → **Réseau**, recharge la page : trouve la requête vers `/stock` et son code de réponse.
3. F12 → **Application → Cookies** : trouve le cookie de session (son nom commence par `sb-`). Supprime-le et recharge : que se passe-t-il ?

👉 Chapitre suivant : [JavaScript et TypeScript utiles](03-javascript-typescript.md)
