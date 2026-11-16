# Signale Mayotte — back-end (API)

[![Intégration continue](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml/badge.svg)](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml)

Plateforme citoyenne pour signaler les problèmes du quotidien — dépôts sauvages, voirie, éclairage public, eau — dans les communes de Mayotte, et suivre publiquement leur traitement.

Ce dossier contient le **back-end** : l'API Express, la base MariaDB (SQL) et le journal NeDB (NoSQL). Le **front-end** (Vue 3), qui appelle cette API, est dans le dossier voisin [`../frontend`](../frontend).

**En ligne :** hébergé chez [alwaysdata](https://www.alwaysdata.com) (France).

## Fonctionnalités

- **Signaler** un problème avec une photo, une catégorie et un point précis sur la carte. Le service compétent (mairie, Conseil départemental, SMAE…) est indiqué automatiquement selon la catégorie.
- **Éviter les doublons** : au moment de la saisie, les signalements similaires à moins de 400 m sont proposés, pour les soutenir plutôt que d'en créer un nouveau.
- **Suivre** l'avancement (Signalé → En cours → Résolu), avec notifications dans le site et par email.
- **Participer** : soutenir un signalement, le commenter, répondre à un commentaire.
- **Marquer une urgence** : un signalement présentant un danger immédiat passe en tête de liste.
- **Consulter** sans compte : liste filtrable, carte, statistiques publiques de transparence.
- **Administrer** : modération, changement de statut avec photo de résolution, suivi officiel, export CSV, journal d'activité.

L'identité des contributeurs n'est jamais affichée : un pseudo, ou à défaut le prénom suivi de l'initiale du nom.

## Stack

|                 | Technologies                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Front-end**   | Projet séparé : Vue 3 (`<script setup>`), Vue Router, Pinia, Vite, Bootstrap 5, Leaflet, Three.js    |
| **Back-end**    | Node.js, Express 5, `mysql2`, bcryptjs, helmet, express-rate-limit, multer, sharp                    |
| **Données**     | MariaDB (données métier, SQL), NeDB (journal d'activité, NoSQL), photos sur le disque du serveur     |
| **Services**    | Brevo (emails, par API HTTPS), nsfwjs (modération des photos), Cloudflare Turnstile (anti-robot)     |
| **Qualité**     | ESLint, Prettier, EditorConfig, GitHub Actions, tests `node:test` et Playwright                      |
| **Hébergement** | alwaysdata (France) : un site pour le front, un site Node.js pour l'API, MariaDB et disque permanent |

## Architecture

```
                 ┌──────────── front-end (projet séparé) ────────────┐
 Navigateur ────▶│ Vue 3 compilé (HTML, CSS, JS)                      │
     │           └────────────────────────────────────────────────────┘
     │ fetch(VITE_API_URL + "/api/…", { credentials: "include" })
     ▼
 ┌──────────── back-end (ce dépôt) ───────────────────────────────────┐
 │ Express : CORS (FRONTEND_URL) → anti-CSRF → routes /api/*            │
 │   ├──▶ MariaDB           (données métier, SQL)                       │
 │   ├──▶ NeDB              (journal d'activité, NoSQL, fichier local)  │
 │   ├──▶ disque            (photos, servies sous /uploads)             │
 │   ├──▶ API Brevo         (emails)                                    │
 │   └──▶ Turnstile         (anti-robot)                                │
 └──────────────────────────────────────────────────────────────────────┘
```

Le front et l'API sont à **deux adresses différentes**. L'API n'accepte que l'adresse du front déclarée dans `FRONTEND_URL` : en-têtes CORS pour lui seul, et refus (403) de toute requête de modification venue d'ailleurs (anti-CSRF). Le cookie de session reste `HttpOnly`, illisible par le JavaScript.

```
backend/
├── src/
│   ├── server.js       point d'entrée : démarre le serveur (port, purge automatique)
│   ├── app.js          application Express : sécurité (helmet, CORS, anti-CSRF), routes, erreurs
│   ├── config/         connexion MariaDB et schéma (db.js), stockage des photos (storage.js)
│   ├── middlewares/    authentification, CORS, anti-CSRF, limites de débit, upload, validation
│   ├── routes/         un fichier par ressource (signalements.routes.js, auth.routes.js…)
│   ├── services/       logique métier : authService, emailService, journalService (NeDB)…
│   │   ├── signalements/   contrôles d'accès, conversion des données, photos
│   │   └── partenaires/    alertes envoyées aux partenaires
│   └── shared/         règles communes avec le front (téléphone, mot de passe, listes…)
├── tests/              tests d'API, tests unitaires (unitaires/) et parcours complet (e2e/)
├── scripts/            mise à jour du serveur alwaysdata
└── data/               photos et journal (créé au démarrage, ignoré par git)
```

Le dossier `src/shared/` contient les règles de validation contrôlées des deux côtés (retour immédiat dans le navigateur, contrôle final sur le serveur). Le front en garde une copie dans son propre dossier `shared/` : **toute modification doit être reportée dans les deux dossiers**.

## Démarrage

**Prérequis :** Node.js 20.19 ou plus récent, MariaDB installé sur le PC.

Créer les deux bases (développement et tests) et le compte de l'application, en `root` (par exemple dans DBeaver) :

```sql
CREATE DATABASE signale_mayotte CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE signale_mayotte_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'signale'@'localhost' IDENTIFIED BY 'un-mot-de-passe-long';
GRANT ALL PRIVILEGES ON signale_mayotte.* TO 'signale'@'localhost';
GRANT ALL PRIVILEGES ON signale_mayotte_test.* TO 'signale'@'localhost';
```

Puis, dans `.env` : `DATABASE_URL=mysql://signale:un-mot-de-passe-long@localhost:3306/signale_mayotte` (et `TEST_DATABASE_URL` vers `signale_mayotte_test`). Les tables se créent seules au premier démarrage. Pour consulter la base : dans DBeaver, connexion MariaDB `localhost:3306`, base `signale_mayotte`, utilisateur `signale`.

Deux terminaux :

```bash
# 1. le back-end (ce dossier) — API sur http://localhost:3001
npm install
cp .env.example .env    # puis renseigner les valeurs
npm run dev

# 2. le front-end (dossier ../frontend) — site sur http://localhost:5173
npm install
npm run dev
```

En développement, le serveur Vite du front relaie `/api` et `/uploads` vers l'API : le navigateur voit une seule adresse, sans CORS. Au premier démarrage de l'API, le schéma de la base et le premier compte administrateur sont créés.

## Configuration

Toutes les variables sont décrites dans [`.env.example`](.env.example). Les principales :

| Variable                                  | Rôle                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                            | Connexion MariaDB (`mysql://…`) — **obligatoire**                       |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE` | Premier compte administrateur, créé au tout premier démarrage           |
| `FRONTEND_URL`                            | Adresse exacte du front autorisée à appeler l'API (production)          |
| `COOKIE_SAMESITE`                         | `strict` (même site) ou `none` (front et API sur deux sites différents) |
| `SITE_URL`                                | Adresse publique du front, pour les liens des emails                    |
| `BREVO_API_KEY`, `BREVO_EXPEDITEUR`       | Envoi des emails. Sans eux, le site fonctionne mais n'envoie rien       |
| `TEST_DATABASE_URL`                       | Base **distincte** pour les tests (voir plus bas)                       |

> Les emails passent par l'API HTTPS de Brevo et non par SMTP : beaucoup d'hébergeurs bloquent les connexions SMTP sortantes, et un envoi SMTP y échouerait en silence.

## Scripts

| Commande               | Rôle                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | API en développement (redémarre à chaque modification)            |
| `npm start`            | API en production                                                 |
| `npm run lint`         | Analyse statique (ESLint)                                         |
| `npm run format`       | Met le code en forme (Prettier)                                   |
| `npm run format:check` | Vérifie la mise en forme sans rien modifier                       |
| `npm run test:unit`    | Tests unitaires (sans base de données)                            |
| `npm run test:api`     | Tests de l'API (`node:test`)                                      |
| `npm run test:e2e`     | Parcours utilisateur dans un vrai navigateur, front + API séparés |
| `npm test`             | Tous les tests                                                    |

## Tests

Les tests remettent la base à zéro à chaque exécution. Ils exigent donc une base de données **séparée**, désignée par `TEST_DATABASE_URL` (la base MariaDB `signale_mayotte_test`), et **refusent de démarrer** si cette variable est absente ou identique à `DATABASE_URL`.

Le test de parcours ([`tests/e2e/parcours.spec.js`](tests/e2e/parcours.spec.js)) compile le front (dossier `FRONTEND_DIR`, par défaut `../frontend`), le sert à une adresse et l'API à une autre, puis pilote un vrai navigateur : inscription, signalement avec photo et position, carte, modification et suppression par l'auteur, connexion admin, suppression depuis le tableau de bord, déconnexion. Il vérifie ainsi le CORS, le cookie de session et la politique de sécurité du front.

## Qualité du code

À chaque `push`, GitHub Actions vérifie le lint, la mise en forme et les tests unitaires ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)). Avant de pousser :

```bash
npm run lint && npm run format:check && npm test
```

## Déploiement

Hébergé chez **alwaysdata** (France) : un site Node.js pour l'API (avec sa base MariaDB et un disque permanent pour les photos et le journal), et un site statique pour le front. Procédure complète : [`docs/deploiement.md`](../docs/deploiement.md). Mise à jour de l'API en une commande : [`scripts/mettre-a-jour.sh`](scripts/mettre-a-jour.sh).

## Documentation

| Document                                                | Contenu                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| [`docs/maquettes.md`](../docs/maquettes.md)             | Arborescence, parcours, zonage des écrans, charte graphique |
| [`docs/base-de-donnees.md`](../docs/base-de-donnees.md) | MCD, MLD, diagramme des tables, base NoSQL du journal       |
| [`docs/deploiement.md`](../docs/deploiement.md)         | Mise en production sur alwaysdata, pas à pas                |
| [`docs/pentest.md`](../docs/pentest.md)                 | Méthode de test d'intrusion de l'application                |

## Sécurité

- Mots de passe hachés avec bcrypt ; comparaison factice quand un compte n'existe pas, pour ne pas révéler son existence par le temps de réponse.
- Requêtes SQL toujours paramétrées ; tri choisi dans une liste blanche.
- CORS limité à l'adresse exacte du front ; toute requête de modification venue d'une autre origine est refusée (anti-CSRF).
- Cookie de session `HttpOnly` et `Secure` (préfixe `__Host-` en HTTPS) : jamais lisible par le JavaScript.
- En-têtes HTTP via helmet ; le front porte sa propre politique de sécurité du contenu, qui n'autorise que l'API, le widget anti-robot de Cloudflare et les fonds de carte.
- Limites de débit sur toutes les routes sensibles, champ piège et captcha Turnstile contre les robots.
- Double authentification (TOTP) des administrateurs, avec protection contre le rejeu d'un code.
- Journal des actions sensibles (connexions, comptes, statuts) dans une base NoSQL (NeDB), effacé automatiquement après un an.
- Photos : liste blanche de formats (SVG exclu), réencodage systématique, suppression des métadonnées dont la position GPS, analyse automatique du contenu avant publication ; servies avec une politique qui interdit tout contenu actif.
- Données d'identité des contributeurs exposées uniquement aux administrateurs.
