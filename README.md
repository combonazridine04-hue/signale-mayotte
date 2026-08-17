# Signale Mayotte

Plateforme citoyenne pour signaler les problèmes du quotidien (déchets, voirie, éclairage, eau) dans les communes de Mayotte. Projet fil rouge.

## Stack

- **Front** : Vue 3 (`<script setup>`), Vue Router, Pinia, Vite, Bootstrap 5, Three.js (globe 3D, chargé à la demande), Leaflet (carte)
- **Back** : Node.js + Express, PostgreSQL (hébergé sur Supabase), Supabase Storage (photos), Multer + Sharp (upload et traitement des photos), Nodemailer (notifications email), bcrypt (comptes admin)

## Installation

```bash
npm install
```

## Lancer le site en développement

Une seule commande, qui démarre le front (Vite, port 5173) et l'API (Express, port 3001) en parallèle — **le site ne fonctionne pas sans l'API** (la connexion et les signalements en dépendent) :

```bash
npm run dev
```

Le site est accessible sur l'URL affichée par Vite (ex. `http://localhost:5173/`). Le front proxifie automatiquement `/api` vers le serveur Express.

Pour lancer le front et le serveur séparément (deux terminaux) :

```bash
npm run dev:client   # front seul (Vite)
npm run server       # API seule (Express)
```

## Lancer une version "production"

Le serveur Express peut aussi servir le site déjà compilé, sur un seul port :

```bash
npm run build
npm start
```

Le site complet (front + API + photos) est alors disponible sur `http://localhost:3001` (port configurable via la variable d'environnement `PORT`).

## Configuration (`.env`)

Le fichier `.env` est **obligatoire** (le serveur refuse de démarrer sans lui). Avant le premier lancement, copier `.env.example` en `.env` (jamais commité) et renseigner :

- `DATABASE_URL` : chaîne de connexion PostgreSQL (Project Settings > Database > Connection string, sur Supabase)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` : stockage des photos (Project Settings > API sur Supabase). Le bucket `signalement-photos` (public) est créé automatiquement au démarrage s'il n'existe pas.
- `ADMIN_IDENTIFIANT` / `ADMIN_MOT_DE_PASSE` : identifiants du premier compte admin, créé automatiquement au tout premier démarrage (voir plus bas — d'autres comptes peuvent ensuite être ajoutés depuis l'interface). Choisir un mot de passe long et aléatoire. **Si le mot de passe contient `#`, `"` ou un espace en fin de valeur, l'entourer de guillemets** (ex. `ADMIN_MOT_DE_PASSE="mon#mot de passe"`), sinon le fichier `.env` le tronquera silencieusement à partir du `#`.

## Données

Les signalements sont stockés dans une base PostgreSQL hébergée sur Supabase. La table `signalements` est créée automatiquement au démarrage avec 3 signalements de démo si elle est vide. Les messages du formulaire de contact sont stockés dans la table `messages_contact`. Un signalement peut avoir jusqu'à 5 photos, hébergées sur Supabase Storage (métadonnées EXIF, dont la géolocalisation GPS, systématiquement supprimées avant l'envoi).

## Espace public / espace admin

Le site est composé de deux espaces séparés, visuellement distincts :

- **Site public** (`/`) : accessible sans compte. Consultation des signalements, carte, formulaire de signalement (avec confirmation par email facultative) et formulaire de contact.
- **Backoffice admin** (`/admin`, connexion sur `/admin/login`) : gestion des signalements (statut, modification, suppression), des messages de contact reçus, et des comptes admin (plusieurs comptes possibles, chacun avec son propre mot de passe — utile pour tracer qui fait quoi). Le premier compte est créé automatiquement depuis `ADMIN_IDENTIFIANT` / `ADMIN_MOT_DE_PASSE` dans `.env` ; les suivants se créent depuis l'onglet "Comptes" du backoffice. L'accès à `/admin` sans être connecté redirige automatiquement vers `/admin/login`.

## Carte

Chaque signalement peut être localisé (clic sur la mini-carte du formulaire, ou bouton "Utiliser ma position actuelle"). La page `/carte` affiche tous les signalements localisés sur une carte OpenStreetMap, avec une couleur de marqueur selon le statut. La localisation reste facultative.

## Engagement citoyen

- **Soutenir un signalement** : un visiteur peut soutenir un signalement existant ("Moi aussi") plutôt que d'en recréer un doublon. Un signalement ne peut être soutenu qu'une fois par IP.
- **Suppression par le créateur** : sans avoir de compte, la personne qui a créé un signalement peut le supprimer elle-même (jeton secret retenu par son navigateur, et rappelé dans l'email de confirmation si elle en a laissé un).
- **Suivi public** : l'admin peut publier des mises à jour visibles par tous sur la fiche d'un signalement (ex. "Travaux prévus le 15/09").
- **Photo après résolution** : en marquant un signalement "Résolu", l'admin peut ajouter une photo montrant le problème réglé, affichée à côté de la photo initiale.
- **Notifications de suivi** : si un email a été laissé à la création, le citoyen reçoit un message à chaque changement de statut de son signalement (pas seulement à la création). Cet email n'est jamais affiché publiquement ni visible des autres visiteurs.
- **Page `/transparence`** : statistiques publiques (total, répartition par statut et par commune, taux et délai moyen de résolution), mises à jour en temps réel.
- **Export CSV** : depuis l'onglet "Signalements" du backoffice, export de tous les signalements pour un usage externe (réunion municipale, tableur...).

## Notifications email

Un email peut être envoyé automatiquement à chaque nouveau signalement. Pour l'activer :

1. Copier `.env.example` en `.env` (jamais commité)
2. Renseigner `EMAIL_EXPEDITEUR` (un compte Gmail) et `EMAIL_MOT_DE_PASSE_APP` (un [mot de passe d'application](https://myaccount.google.com/security) généré pour ce compte — pas le mot de passe normal)
3. Redémarrer le serveur

Sans `EMAIL_EXPEDITEUR` / `EMAIL_MOT_DE_PASSE_APP`, le site fonctionne normalement : les messages de contact et signalements sont bien enregistrés, seules les notifications email sont désactivées (message clair dans les logs du serveur).

## Sécurité

- En-têtes de sécurité HTTP (CSP, anti-clickjacking, HSTS...) via `helmet`.
- Limite anti-brute-force sur la connexion admin (10 tentatives / 15 min / IP).
- Limite anti-spam sur la création de signalement (20 / 15 min / IP) et l'envoi de message de contact (10 / 15 min / IP), plus un champ piège invisible (honeypot) sur les deux formulaires publics.
- Mots de passe admin hashés (bcrypt), jamais stockés en clair. Sessions en mémoire, expirant après 12h.
- Upload de photo restreint aux formats jpg/png/webp/gif (SVG explicitement exclu), métadonnées EXIF supprimées automatiquement.

## Tests

```bash
npm run test:api   # tests de l'API (node:test)
npm run test:e2e   # parcours complet dans un vrai navigateur (Playwright)
npm test           # build + les deux suites de tests
```

⚠️ **Les tests utilisent la vraie base définie dans `DATABASE_URL`**, pas une base isolée : ils vident la table `signalements` (`TRUNCATE`) et la remplissent avec les 3 signalements de démo à chaque lancement. Ne pas les lancer sur une base contenant de vraies données sans faire de sauvegarde avant.
