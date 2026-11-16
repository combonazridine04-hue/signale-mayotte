# Signale Mayotte

[![Intégration continue](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml/badge.svg)](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml)

Plateforme citoyenne pour signaler les problèmes du quotidien — dépôts sauvages, voirie, éclairage public, eau — dans les communes de Mayotte, et suivre publiquement leur traitement.

## Structure du projet

```
signale-mayotte/
├── backend/                API Express + MariaDB (SQL) + NeDB (journal) → alwaysdata
│   ├── database/           schema.sql : création des tables
│   ├── src/
│   │   ├── config/         connexion à la base, stockage des photos
│   │   ├── controllers/    ce que fait chaque route
│   │   ├── middlewares/    connexion obligatoire, limites, CORS, upload…
│   │   ├── models/         requêtes SQL (une par table)
│   │   ├── routes/         chemins de l'API
│   │   ├── services/       logique métier (emails, sessions, journal…)
│   │   ├── shared/         règles communes avec le front
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   └── scripts/
├── frontend/               Site Vue 3 (Vite) → alwaysdata
│   ├── public/
│   └── src/
│       ├── assets/         CSS et images
│       ├── components/     composants réutilisables (+ admin/)
│       ├── data/           listes de référence (catégories, communes…)
│       ├── router/         routes du site
│       ├── services/       appels à l'API
│       ├── shared/         règles communes avec le back
│       ├── stores/         état partagé (Pinia)
│       ├── utils/          petites fonctions utiles
│       ├── views/          écrans (+ admin/, auth/, partenaire/)
│       ├── App.vue
│       └── main.js
├── docs/                   base de données, maquettes, déploiement, pentest
└── .github/                intégration continue (lint, tests, build)
```

| Dossier                 | Rôle                                                  | Détails                                    |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------ |
| [`backend/`](backend)   | L'API : comptes, signalements, photos, administration | [`backend/README.md`](backend/README.md)   |
| [`frontend/`](frontend) | Le site affiché dans le navigateur, qui appelle l'API | [`frontend/README.md`](frontend/README.md) |

## Lancer le projet en local

**Prérequis :** Node.js 20.19 ou plus récent et MariaDB (voir [`backend/README.md`](backend/README.md) pour créer la base).

Deux terminaux :

```bash
# Terminal 1 — l'API sur http://localhost:3001
cd backend
npm install
cp .env.example .env    # puis renseigner les valeurs
npm run dev
```

```bash
# Terminal 2 — le site sur http://localhost:5173
cd frontend
npm install
npm run dev
```

## Comment le front et le back sont liés

- **En local :** le front envoie ses appels `/api` et `/uploads` au back sur `http://localhost:3001` (réglé dans [`frontend/vite.config.js`](frontend/vite.config.js)). Rien à configurer.
- **En ligne :**
  - le front appelle l'adresse de l'API définie dans `VITE_API_URL` (fichier `frontend/.env.production`, lu au build) ;
  - le back n'accepte que l'adresse du front définie dans `FRONTEND_URL` (fichier `backend/.env` sur alwaysdata).

## Mise en ligne

Front-end et back-end sont tous les deux hébergés chez alwaysdata : [`docs/deploiement.md`](docs/deploiement.md).

## Documentation

| Document                                             | Contenu                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| [`docs/maquettes.md`](docs/maquettes.md)             | Arborescence, parcours, zonage des écrans, charte graphique |
| [`docs/base-de-donnees.md`](docs/base-de-donnees.md) | MCD, MLD, diagramme des tables, base NoSQL du journal       |
| [`docs/deploiement.md`](docs/deploiement.md)         | Mise en production sur alwaysdata, pas à pas                |
| [`docs/pentest.md`](docs/pentest.md)                 | Méthode de test d'intrusion de l'application                |
