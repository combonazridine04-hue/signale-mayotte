# Signale Mayotte

[![Intégration continue](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml/badge.svg)](https://github.com/combonazridine04-hue/signale-mayotte/actions/workflows/ci.yml)

Plateforme citoyenne pour signaler les problèmes du quotidien — dépôts sauvages, voirie, éclairage public, eau — dans les communes de Mayotte, et suivre publiquement leur traitement.

**En ligne :** https://signale-mayotte.onrender.com

## Fonctionnalités

- **Signaler** un problème avec une photo, une catégorie et un point précis sur la carte. Le service compétent (mairie, Conseil départemental, SMAE…) est indiqué automatiquement selon la catégorie.
- **Éviter les doublons** : au moment de la saisie, les signalements similaires à moins de 400 m sont proposés, pour les soutenir plutôt que d'en créer un nouveau.
- **Suivre** l'avancement (Signalé → En cours → Résolu), avec notifications dans le site et par email.
- **Participer** : soutenir un signalement, le commenter, répondre à un commentaire.
- **Marquer une urgence** : un signalement présentant un danger immédiat passe en tête de liste.
- **Consulter** sans compte : liste filtrable, carte, statistiques publiques de transparence.
- **Administrer** : modération, changement de statut avec photo de résolution, suivi officiel, export CSV.

L'identité des contributeurs n'est jamais affichée : un pseudo, ou à défaut le prénom suivi de l'initiale du nom.

## Stack

|                 | Technologies                                                                             |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Front**       | Vue 3 (`<script setup>`), Vue Router, Pinia, Vite, Bootstrap 5, Leaflet, Three.js        |
| **Back**        | Node.js, Express 5, `pg`, bcryptjs, helmet, express-rate-limit, multer, sharp            |
| **Données**     | PostgreSQL (Supabase), Supabase Storage pour les photos                                  |
| **Services**    | Brevo (emails, par API HTTPS), MapTiler (fonds de carte), nsfwjs (modération des photos) |
| **Qualité**     | ESLint, Prettier, EditorConfig, GitHub Actions                                           |
| **Hébergement** | Render                                                                                   |

## Architecture

```
Navigateur ──HTTP/JSON──▶ Express ──▶ PostgreSQL
  (Vue 3)                    │
                             ├──▶ Supabase Storage  (photos)
                             └──▶ API Brevo         (emails)
```

En production, un seul service Node.js sert l'API **et** le front compilé : même origine, donc aucune configuration CORS.

```
server/
├── index.js            middlewares globaux, montage des routeurs, gestion des erreurs
├── routes/             un routeur par ressource (signalements, commentaires, auth…)
├── signalements/       contrôles d'accès, conversion des données, photos
├── middleware/         authentification, limites de débit
├── db.js               connexion PostgreSQL et schéma
└── auth.js, mailer.js, storage.js, moderation.js…
src/
├── views/              écrans
├── components/         composants réutilisables
├── stores/             état partagé (Pinia)
└── utils/api.js        point d'entrée unique des appels HTTP
shared/                 règles utilisées par le client ET le serveur (téléphone, mot de passe…)
```

Le dossier `shared/` garantit qu'une règle de validation, écrite une seule fois, s'applique à l'identique dans le navigateur (retour immédiat) et sur le serveur (contrôle final).

## Démarrage

**Prérequis :** Node.js 20.12 ou plus récent, un projet [Supabase](https://supabase.com) (base PostgreSQL et stockage).

```bash
npm install
cp .env.example .env    # puis renseigner les valeurs
npm run dev
```

`npm run dev` lance le front (Vite, port 5173) et l'API (Express, port 3001) ensemble ; Vite redirige `/api` vers Express. Le site est sur `http://localhost:5173`.

Au premier démarrage, le schéma de la base est créé automatiquement, ainsi que le bucket de photos et le premier compte administrateur.

## Configuration

Toutes les variables sont décrites dans [`.env.example`](.env.example). Les principales :

| Variable                                    | Rôle                                                              |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                              | Connexion PostgreSQL — **obligatoire**                            |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Stockage des photos — **obligatoires**                            |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE`   | Premier compte administrateur, créé au tout premier démarrage     |
| `BREVO_API_KEY`, `BREVO_EXPEDITEUR`         | Envoi des emails. Sans eux, le site fonctionne mais n'envoie rien |
| `VITE_MAPTILER_KEY`                         | Fonds de carte. Sans elle, repli sur OpenStreetMap France         |
| `TEST_DATABASE_URL`                         | Base **distincte** pour les tests (voir plus bas)                 |

> Les emails passent par l'API HTTPS de Brevo et non par SMTP : Render bloque les connexions SMTP sortantes, et un envoi SMTP y échouerait en silence.

## Scripts

| Commande               | Rôle                                                |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Front et API en développement                       |
| `npm run build`        | Compile le front dans `dist/`                       |
| `npm start`            | Lance le serveur de production (sert aussi `dist/`) |
| `npm run lint`         | Analyse statique (ESLint)                           |
| `npm run lint:fix`     | Corrige automatiquement ce qui peut l'être          |
| `npm run format`       | Met le code en forme (Prettier)                     |
| `npm run format:check` | Vérifie la mise en forme sans rien modifier         |
| `npm run test:api`     | Tests de l'API (`node:test`)                        |
| `npm run test:e2e`     | Parcours utilisateur dans un vrai navigateur        |

## Tests

Les tests remettent la base à zéro (`TRUNCATE`) à chaque exécution. Ils exigent donc une base de données **séparée**, désignée par `TEST_DATABASE_URL`, et **refusent de démarrer** si cette variable est absente ou identique à `DATABASE_URL`.

Créer pour cela un second projet Supabase, gratuit, réservé aux tests.

> **À reprendre :** le test de parcours (`tests/e2e/parcours.spec.js`) décrit un fonctionnement antérieur — dépôt d'un signalement sans compte, modification réservée à l'administrateur. Depuis, un compte est obligatoire pour signaler et l'auteur peut corriger son signalement tant qu'il n'est pas pris en charge. Le test doit être mis à jour avant de servir de non-régression.

## Qualité du code

À chaque `push`, GitHub Actions vérifie le lint, la mise en forme et la compilation ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Avant de pousser :

```bash
npm run lint && npm run format:check && npm run build
```

## Déploiement

Hébergé sur Render, en service web Node.js :

- **Build :** `npm install && npm run build`
- **Démarrage :** `npm start`
- **Variables :** à renseigner dans l'interface Render, jamais dans le dépôt

Chaque `push` sur `main` redéploie automatiquement. Un workflow planifié ([`keep-alive.yml`](.github/workflows/keep-alive.yml)) visite le site toutes les dix minutes, pour limiter la mise en veille de l'offre gratuite.

## Sécurité

- Mots de passe hachés avec bcrypt ; comparaison factice quand un compte n'existe pas, pour ne pas révéler son existence par le temps de réponse.
- Requêtes SQL toujours paramétrées ; tri choisi dans une liste blanche.
- En-têtes HTTP via helmet, dont une politique de sécurité du contenu n'autorisant aucun script tiers.
- Limites de débit sur toutes les routes sensibles, et champ piège contre les robots.
- Photos : liste blanche de formats (SVG exclu), réencodage systématique, suppression des métadonnées dont la position GPS, analyse automatique du contenu avant publication.
- Données d'identité des contributeurs exposées uniquement aux administrateurs.
