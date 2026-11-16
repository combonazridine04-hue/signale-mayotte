# Signale Mayotte — front-end

Interface web de Signale Mayotte : plateforme citoyenne pour signaler les problèmes du quotidien (déchets, voirie, éclairage, eau) dans les communes de Mayotte et suivre leur traitement.

Ce dossier contient le **front-end** (Vue 3). Il appelle l'API du **back-end**, dans le dossier voisin [`../backend`](../backend) (Express, MariaDB, NeDB).

## Stack

Vue 3 (`<script setup>`), Vue Router, Pinia, Vite, Bootstrap 5, Leaflet (carte), Three.js (globe d'accueil), ESLint, Prettier.

## Structure

```
frontend/
├── public/                 copiés tels quels (favicon, robots.txt, .htaccess d'Apache…)
├── src/
│   ├── assets/             css/ (un fichier par écran ou composant) et img/ (logo)
│   ├── components/         composants réutilisables (navigation, carte, dépôt de photos…)
│   │   └── admin/          composants du tableau de bord admin (journal d'activité)
│   ├── data/               listes de référence (catégories, communes, statuts)
│   ├── router/             routes et accès réservés (admin, partenaire, citoyen connecté)
│   ├── services/
│   │   ├── adresseApi.js   adresse de l'API (VITE_API_URL), appels avec cookie, photos
│   │   └── api.js          appels à l'API avec reprise automatique des lectures
│   ├── shared/             règles de validation communes avec le back-end
│   ├── stores/             état partagé (Pinia) : session, signalements, profil…
│   ├── utils/              petites fonctions utiles (dates, session, fonds de carte…)
│   ├── views/              écrans (accueil, signaler, carte, détail, profil, contact…)
│   │   ├── admin/          connexion et tableau de bord admin
│   │   ├── auth/           connexion, inscription, mot de passe oublié, vérification email
│   │   └── partenaire/     connexion et tableau de bord partenaire
│   ├── App.vue
│   └── main.js
├── index.html
├── package.json
└── vite.config.js
```

`src/shared/` et `src/data/signalement.js` existent aussi dans le back-end (`backend/src/shared/`), qui fait le contrôle final : **toute modification doit être reportée dans les deux dossiers**.

## Démarrage

Le back-end doit tourner (`npm run dev` dans son dossier, API sur `http://localhost:3001`).

```bash
npm install
cp .env.example .env    # VITE_API_URL vide en développement
npm run dev             # site sur http://localhost:5173
```

En développement, Vite relaie `/api` et `/uploads` vers l'API (voir `vite.config.js`) : le navigateur voit une seule adresse, sans CORS.

## Mise en production

```bash
echo "VITE_API_URL=https://api.COMPTE.alwaysdata.net" > .env.production
npm ci && npm run build    # produit dist/, à servir comme site statique
```

- `VITE_API_URL` est lue **au build** : la changer impose de relancer `npm run build`.
- Le build inscrit dans `index.html` une **politique de sécurité du contenu** (CSP) qui n'autorise que le site, l'API, le widget anti-robot de Cloudflare et les fonds de carte.
- Le site est une application à page unique : l'hébergeur doit renvoyer `index.html` pour toute adresse inconnue (ex. `/signalements/42`).
- L'API doit déclarer l'adresse exacte de ce site dans sa variable `FRONTEND_URL` (CORS).

Procédure complète d'hébergement chez alwaysdata : [`docs/deploiement.md`](../docs/deploiement.md).

## Scripts

| Commande               | Rôle                                          |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Site en développement (http://localhost:5173) |
| `npm run build`        | Compile le site dans `dist/`                  |
| `npm run preview`      | Sert `dist/` en local pour vérifier le build  |
| `npm run lint`         | Analyse statique (ESLint)                     |
| `npm run format`       | Met le code en forme (Prettier)               |
| `npm run format:check` | Vérifie la mise en forme sans rien modifier   |

## Tests

Le parcours complet dans un vrai navigateur est lancé depuis le back-end (`npm run test:e2e`) : il compile ce dossier, le sert à une adresse et l'API à une autre, puis vérifie inscription, signalement avec photo, carte, administration… ainsi que le CORS, le cookie de session et la CSP.
