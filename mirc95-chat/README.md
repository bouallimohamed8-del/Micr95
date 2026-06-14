# mIRC95 — Chat rétro (style mIRC / Windows 95)

Application de chat en temps réel inspirée des clients IRC des années 1995-2000.

> ⚠️ Cette version utilise des données simulées en mémoire (pas de vraie base
> de données). Elle fonctionne très bien pour une démo / un test, mais les
> messages ne sont pas partagés entre plusieurs personnes réelles. Pour un
> vrai chat multi-utilisateurs, il faut connecter Firebase (voir section
> "Pour aller plus loin" en bas).

---

## 1. Uploader ce projet sur GitHub (sans terminal, via le site web)

1. Va sur [github.com](https://github.com) et connecte-toi.
2. Clique sur **"New"** (ou le `+` en haut à droite → **"New repository"**).
3. Donne un nom à ton dépôt, par exemple `mirc95-chat`. Laisse-le **Public**.
   Ne coche pas "Add a README" (on en a déjà un).
4. Clique sur **"Create repository"**.
5. Sur la page suivante, clique sur **"uploading an existing file"**
   (lien dans la zone "Quick setup").
6. **Décompresse le fichier .zip** que je t'ai donné sur ton ordinateur, puis
   fais glisser **tout le contenu du dossier** (pas le dossier lui-même, mais
   ce qu'il y a dedans : `src/`, `public/`, `package.json`, `index.html`, etc.)
   dans la zone d'upload de GitHub.
7. Écris un message de commit (ex: "Premier import") et clique sur
   **"Commit changes"**.

Ton code est maintenant sur GitHub ✅

---

## 2. Mettre l'app en ligne (gratuit) — méthode recommandée : Vercel

C'est la méthode la plus simple, et elle se met à jour automatiquement à
chaque modification.

1. Va sur [vercel.com](https://vercel.com) et crée un compte (tu peux te
   connecter directement avec ton compte GitHub).
2. Clique sur **"Add New..." → "Project"**.
3. Sélectionne ton dépôt `mirc95-chat`.
4. Vercel détecte automatiquement que c'est un projet **Vite** — ne change
   rien aux réglages.
5. Clique sur **"Deploy"**.
6. Après ~1 minute, tu obtiens une URL publique (ex:
   `https://mirc95-chat.vercel.app`) que tu peux partager 🎉

---

## 3. Alternative : GitHub Pages

Si tu préfères héberger directement sur GitHub :

1. Ouvre le fichier `vite.config.js` et vérifie que la ligne `base:` contient
   bien le **nom exact de ton dépôt** :
   ```js
   base: '/mirc95-chat/',
   ```
   (remplace `mirc95-chat` par le nom de ton dépôt si différent)

2. Sur ton ordinateur, dans le dossier du projet, ouvre un terminal et tape :
   ```bash
   npm install
   npm run build
   npm run deploy
   ```
3. Dans les **réglages du dépôt GitHub** → **Pages**, choisis la branche
   `gh-pages` comme source.
4. Ton site sera accessible à :
   `https://TON_USERNAME.github.io/mirc95-chat/`

---

## 4. Lancer le projet en local (pour tester avant de publier)

```bash
npm install
npm run dev
```

Ouvre ensuite l'adresse affichée dans le terminal (généralement
`http://localhost:5173`).

---

## Fonctionnalités incluses

- Inscription / connexion / mode invité
- Salon public en temps réel (simulé), notifications d'arrivée/départ
- Messages privés, liste d'amis, blocage d'utilisateurs
- Création de salons publics ou protégés par PIN
- Mentions `@pseudo`, formatage `*gras*` / `_italique_`, émojis
- Statuts en ligne / absent / hors-ligne
- Rangs (Admin, Modérateur, Membre)
- Sons rétro, mode sombre "terminal"
- Interface 100% inspirée de Windows 95 / mIRC, responsive mobile & ordi

---

## Pour aller plus loin : connecter une vraie base de données (Firebase)

Le code est structuré pour qu'il soit facile de remplacer les données
simulées (`SEED_USERS`, `SEED_ROOMS`, `SEED_MESSAGES`, et les fonctions
`setX(prev => ...)`) par de vrais appels à **Firebase Authentication** et
**Firestore** avec des écouteurs `onSnapshot` pour le temps réel. La logique
d'interface (composants, mise en page) n'a pas besoin de changer.

Étapes générales :
1. Crée un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Active **Authentication** (Email/Password) et **Firestore Database**
3. Installe le SDK : `npm install firebase`
4. Crée un fichier `src/firebase.js` avec ta config (clé API, etc.)
5. Remplace les fonctions `handleLogin`, `sendMessage`, etc. par des appels
   Firebase correspondants.

N'hésite pas à demander de l'aide pour cette étape si besoin !
