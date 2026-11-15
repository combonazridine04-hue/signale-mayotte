# Déploiement — Signale Mayotte

Ce document explique comment mettre l'application en production, la vérifier, la mettre
à jour et revenir en arrière. Il s'adresse à un développeur qui reprend le projet sans
l'avoir écrit.

---

## 1. Architecture de production

```
                       ┌──────────────── Render (service web Node.js) ────────────────┐
 Navigateur ──HTTPS──▶ │ Express : API /api/*  +  front Vue compilé (dist/)            │
                       └───┬───────────┬──────────────┬──────────────┬────────────────┘
                           │           │              │              │
                    MariaDB       Supabase        Brevo (emails)   Cloudflare Turnstile
                   (hébergée,     Storage                          (anti-robot, optionnel)
                    TLS)          (photos)
   Journal d'activité : base NoSQL NeDB embarquée dans le service (fichier sur son disque).
```

Un **seul service** sert l'API et le front compilé : même origine, donc pas de CORS à
configurer, et le cookie de session reste `SameSite=Strict`.

## 2. Prérequis

| Élément                                             | Version / offre                                                               | Obligatoire                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------- |
| Node.js                                             | **20.19 ou plus** (champ `engines` du `package.json`) ; la CI utilise Node 22 | Oui                               |
| Compte GitHub                                       | Dépôt du projet                                                               | Oui                               |
| [Render](https://render.com)                        | Service web, offre gratuite possible                                          | Oui                               |
| Base MariaDB hébergée (ou MySQL compatible)         | Accessible depuis Internet, connexion TLS                                     | Oui                               |
| [Supabase](https://supabase.com)                    | Projet gratuit : Storage (photos)                                             | Oui                               |
| [Brevo](https://brevo.com)                          | 300 emails/jour gratuits                                                      | Recommandé                        |
| [Cloudflare Turnstile](https://dash.cloudflare.com) | Gratuit                                                                       | Non, mais conseillé en production |
| [MapTiler](https://cloud.maptiler.com)              | Clé gratuite                                                                  | Non (repli sur OpenStreetMap)     |

---

## 3. Préparer les services externes

### 3.1 Base MariaDB (données)

Le disque de Render est effacé à chaque déploiement : la base doit être hébergée ailleurs,
chez un fournisseur MariaDB (ou MySQL compatible) joignable depuis Internet.

1. Créer une base (ex. `signale_mayotte`) en `utf8mb4` et un utilisateur qui n'a de droits
   que sur elle (jamais `root`).
2. Autoriser les connexions venant de Render (sur l'offre gratuite de Render, les adresses
   de sortie ne sont pas fixes : le mot de passe et TLS protègent l'accès).
3. Valeur de `DATABASE_URL` : `mysql://utilisateur:motdepasse@hote:3306/signale_mayotte`.
   Toute base distante est jointe en **TLS avec vérification du certificat**
   ([`server/db.js`](../server/db.js)).
4. Rien à créer à la main ensuite : au premier démarrage, le serveur crée les tables et le
   premier compte admin.

### 3.1 bis Supabase (photos)

1. **Project Settings → API** → `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
   Cette clé contourne toutes les règles d'accès : elle ne va **que** dans les variables
   du serveur, jamais dans une variable `VITE_*`, qui serait copiée dans le front.
2. Le serveur crée lui-même l'espace de stockage des photos au premier démarrage.

> **Ne jamais mettre les clés Supabase de production dans le `.env` d'un poste de
> développement.** Le 15/11/2026, un serveur local démarré avec ces clés a vidé l'espace
> photos du site en ligne. Le code a été corrigé, mais la règle reste : en local, photos
> sur le disque.

### 3.2 Journal d'activité (NeDB, rien à préparer)

Le journal est une base NoSQL **embarquée** : un fichier créé automatiquement au premier
événement, avec ses index (dont l'index TTL d'un an). Aucun service ni variable à
configurer.

Limite à connaître : sur l'offre gratuite de Render, le disque est effacé à chaque
redéploiement et à chaque redémarrage. Le journal repart alors de zéro. Pour le
conserver, il faut ajouter un **disque persistant** à Render (option payante) et y placer
`server/data/journal/`.

### 3.3 Brevo (emails)

1. **Senders & IP → Add a sender**, puis cliquer le lien reçu pour valider l'adresse.
2. **SMTP & API → API Keys** → `BREVO_API_KEY`. L'adresse validée → `BREVO_EXPEDITEUR`.

Les emails partent par **API HTTPS**, jamais en SMTP : Render bloque le SMTP sortant.

### 3.4 Cloudflare Turnstile (anti-robot, conseillé)

**Turnstile → Add widget**, ajouter le domaine du site (ex. `signale-mayotte.onrender.com`)
→ `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.

---

## 4. Variables d'environnement

À saisir dans **Render → Environment**. Ne jamais les mettre dans le dépôt : `.env` est
dans `.gitignore`, et seul le modèle [`.env.example`](../.env.example) est versionné.

| Variable                                     | Obligatoire | Rôle                                                         |
| -------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `DATABASE_URL`                               | ✅          | Connexion MariaDB (`mysql://…`). Refus de démarrer sans elle |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  | ✅          | Stockage des photos                                          |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE`    | ✅          | Premier compte admin (mot de passe long et aléatoire)        |
| `SITE_URL`                                   | ✅ en prod  | URL publique, pour les liens des emails                      |
| `BREVO_API_KEY`, `BREVO_EXPEDITEUR`          | Recommandé  | Envoi des emails                                             |
| `EMAIL_DESTINATAIRE`                         | Optionnel   | Boîte qui reçoit les nouveaux signalements                   |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Conseillé   | Captcha sur inscription, contact et mot de passe oublié      |
| `VITE_MAPTILER_KEY`                          | Optionnel   | Fonds de carte. Lue **au build** par Vite, donc publique     |
| `PORT`                                       | Non         | Fourni par Render, 3001 en local                             |

La variable `TEST_DATABASE_URL` ne sert qu'aux tests : on ne
la définit pas en production.

---

## 5. Créer le service sur Render

1. **New → Web Service**, connecter le dépôt GitHub, branche `main`.
2. Réglages :

   | Champ         | Valeur                                    |
   | ------------- | ----------------------------------------- |
   | Runtime       | Node                                      |
   | Build Command | `npm install && npm run build`            |
   | Start Command | `npm start` (soit `node server/index.js`) |
   | Auto-Deploy   | Oui, à chaque push sur `main`             |

3. Renseigner les variables de la section 4, puis **Create Web Service**.

Ce que fait le build : `npm run build` compile le front avec Vite dans `dist/`. Au
démarrage, Express sert `dist/` et renvoie `index.html` pour toute route non-API, ce qui
permet les URL propres de Vue Router (ex. `/signalements/42`).

Points de configuration production déjà gérés dans le code :

- `app.set('trust proxy', 1)` : derrière le proxy de Render, Express lit la vraie IP du
  client (limites de débit) et sait que la connexion est en HTTPS.
- Le cookie de session passe en `Secure` automatiquement dès que la requête est en HTTPS.
- **helmet** ajoute les en-têtes de sécurité (CSP, HSTS, `X-Content-Type-Options`…).
- Les erreurs 500 renvoient un message générique. Le détail ne va que dans les journaux Render.

---

## 6. Intégration continue

Deux workflows GitHub Actions ([`.github/workflows/`](../.github/workflows/)) :

| Workflow                                                | Déclencheur                      | Rôle                                                                     |
| ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| [`ci.yml`](../.github/workflows/ci.yml)                 | Push sur `main` et pull requests | `npm ci` → lint → vérification du formatage → tests unitaires → build    |
| [`keep-alive.yml`](../.github/workflows/keep-alive.yml) | Toutes les 10 minutes            | Visite le site pour limiter la mise en veille de l'offre gratuite Render |

Les tests d'API et de parcours (`npm run test:api`, `npm run test:e2e`) ont besoin d'une
base de test. On les lance en local avant de pousser :

```bash
npm test   # unitaires + build + API + parcours
```

---

## 7. Vérifier après un déploiement

1. **Journaux Render** : la ligne `API Signale Mayotte disponible sur …` apparaît, sans erreur.
2. **Page d'accueil** : la liste des signalements se charge.
3. **API** :
   ```bash
   curl -s https://signale-mayotte.onrender.com/api/captcha    # {"actif":true,"cleSite":"…"}
   curl -sI https://signale-mayotte.onrender.com/ | grep -i "strict-transport\|content-security"
   ```
4. **Parcours** : créer un signalement avec une photo, puis se connecter en admin avec le code 2FA.
5. **Emails** : une inscription doit envoyer le code de vérification.
6. **Journal** : la connexion admin apparaît dans l'onglet _Journal_.

---

## 8. Mettre à jour et revenir en arrière

- **Mise à jour :** `git push` sur `main`. La CI vérifie le code et Render redéploie
  automatiquement. Si le build échoue, Render garde la version précédente en ligne.
- **Évolution du schéma :** on ajoute la colonne dans [`server/db.js`](../server/db.js) avec
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB). La migration s'applique au
  démarrage suivant, sans script manuel, et peut être rejouée sans risque.
- **Retour arrière :** Render → _Events_ → choisir un déploiement précédent → **Rollback**.
  On peut aussi faire un `git revert` du commit fautif, puis un push.
  Attention : un rollback ne retire pas une colonne déjà ajoutée. Les migrations
  n'ajoutent que des colonnes, ce qui reste compatible avec l'ancien code.
- **Sauvegardes :** avant toute opération risquée, faire une copie manuelle de la base :
  `mariadb-dump -h HOTE -u UTILISATEUR -p signale_mayotte > sauvegarde.sql` (ou, dans
  DBeaver : clic droit sur la base → _Outils_ → _Sauvegarder_). Restauration :
  `mariadb -h HOTE -u UTILISATEUR -p signale_mayotte < sauvegarde.sql`.

## 9. Pannes fréquentes

| Symptôme                                                          | Cause probable                                | Solution                                    |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| Le service ne démarre pas, erreur `DATABASE_URL manquant`         | Variable absente                              | La renseigner dans Render                   |
| Premier chargement très lent (jusqu'à une minute)                 | Mise en veille de l'offre gratuite            | Normal, ou passer à une offre payante       |
| Aucun email reçu                                                  | `BREVO_EXPEDITEUR` non validé, ou clé absente | Valider l'expéditeur dans Brevo             |
| La case anti-robot ne s'affiche pas ou échoue toujours            | Domaine absent du widget Turnstile            | Ajouter le domaine dans Cloudflare          |
| Erreur 503 « Vérification anti-robot momentanément indisponible » | Cloudflare injoignable depuis le serveur      | Réessayer ; vérifier `TURNSTILE_SECRET_KEY` |
| Onglet Journal vide après une mise en ligne                       | Disque de Render effacé au redéploiement      | Normal sur l'offre gratuite (voir 3.2)      |
| Photos refusées                                                   | Clé Supabase invalide                         | Vérifier `SUPABASE_SERVICE_ROLE_KEY`        |
