# Déploiement — Signale Mayotte

Ce document explique comment mettre l'application en production chez **alwaysdata**, la
vérifier, la mettre à jour et revenir en arrière. Il s'adresse à un développeur qui reprend
le projet sans l'avoir écrit.

L'application tient dans **un seul dépôt** (`signale-mayotte`), en deux dossiers :

| Dossier     | Contenu                                       | Hébergé comme                |
| ----------- | --------------------------------------------- | ---------------------------- |
| `backend/`  | Back-end : API Express, MariaDB, NeDB, photos | Site **Node.js**             |
| `frontend/` | Front-end : Vue 3 compilé (HTML, CSS, JS)     | Site **statique** (fichiers) |

---

## 1. Architecture de production

```
                   ┌──────────────────────── alwaysdata (France) ─────────────────────────┐
                   │                                                                       │
 Navigateur ─HTTPS─┼─▶ COMPTE.alwaysdata.net        site statique : front Vue compilé       │
     │             │                                                                       │
     └─────HTTPS───┼─▶ api.COMPTE.alwaysdata.net    site Node.js : API Express             │
                   │        ├─ CORS : n'accepte que https://COMPTE.alwaysdata.net          │
                   │        ├─ photos sur disque (data/uploads), servies /uploads  │
                   │        ├─ journal NoSQL NeDB (data/journal)                   │
                   │        └─▶ MariaDB (réseau interne)                                   │
                   └───────────────────────────────────────────────────────────────────────┘
                             │                         │
                       Brevo (emails)        Cloudflare Turnstile (anti-robot)
```

**Pourquoi `api.COMPTE.alwaysdata.net` et pas une adresse totalement différente ?**
`alwaysdata.net` figure dans la liste officielle des suffixes publics
(publicsuffix.org) : `COMPTE.alwaysdata.net` et `api.COMPTE.alwaysdata.net` sont donc
deux _origines_ différentes (d'où le CORS), mais **un seul _site_** pour le navigateur.
Le cookie de session reste en `SameSite=Strict`, sans être un cookie « tiers ». Avec deux
comptes ou deux noms distincts (`signale.alwaysdata.net` et `signale-api.alwaysdata.net`),
ce seraient deux sites : il faudrait `COOKIE_SAMESITE=none`, et **Safari (iPhone)
bloquerait la connexion**, car il refuse les cookies tiers.

Le disque d'alwaysdata est **permanent** : photos et journal restent d'une mise à jour à
l'autre. Les sites ne se mettent jamais en veille.

## 2. Prérequis

| Élément                                             | Version / offre                                                           | Obligatoire                       |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| [alwaysdata](https://www.alwaysdata.com)            | Offre gratuite : ~1 Go de disque, 256 Mo de mémoire, MariaDB inclus       | Oui                               |
| Node.js                                             | **20.19 ou plus** (champ `engines` du `package.json`) ; Node 22 conseillé | Oui                               |
| Compte GitHub                                       | Dépôts des deux projets (le serveur les clone)                            | Oui                               |
| [Brevo](https://brevo.com)                          | 300 emails/jour gratuits                                                  | Recommandé                        |
| [Cloudflare Turnstile](https://dash.cloudflare.com) | Gratuit                                                                   | Non, mais conseillé en production |
| [MapTiler](https://cloud.maptiler.com)              | Clé gratuite                                                              | Non (repli sur OpenStreetMap)     |

Mesures faites **sur le serveur alwaysdata** (offre gratuite, 256 Mo de mémoire) :

| Commande de l'API                                                      | Au repos | Pic (analyse de 3 photos)    |
| ---------------------------------------------------------------------- | -------- | ---------------------------- |
| `node src/server.js`                                                 | 217 Mo   | 230 Mo : trop juste          |
| `node --max-old-space-size=96 --max-semi-space-size=2 src/server.js` | 151 Mo   | **183 Mo** : ~70 Mo de marge |

La seconde commande limite la mémoire de JavaScript et force un nettoyage plus fréquent :
c'est elle qu'on utilise. L'analyse d'une photo par le modèle d'IA de modération prend
alors 8 à 10 secondes sur ce serveur (¼ de processeur). Dépendances de production :
364 Mo. Front compilé : 3 Mo.

---

## 3. Préparer alwaysdata (panneau https://admin.alwaysdata.com)

Dans la suite, `COMPTE` désigne le nom du compte alwaysdata.

### 3.1 Base MariaDB

1. **Bases de données → MySQL → Ajouter une base de données** : `signale` (alwaysdata la
   nomme `COMPTE_signale`).
2. Onglet **Utilisateurs → Ajouter un utilisateur** : `COMPTE_signale`, mot de passe long,
   droits **uniquement** sur cette base (principe du moindre privilège, jamais d'accès
   global).
3. Le serveur MariaDB s'appelle `mysql-COMPTE.alwaysdata.net` ; l'API le joint par le
   réseau interne d'alwaysdata.

Rien d'autre à créer : au premier démarrage, l'API crée ses tables
([`src/config/db.js`](../backend/src/config/db.js)) et le premier compte admin.

### 3.2 Accès SSH

**Accès distant → SSH** : sur l'utilisateur du compte, cocher **« Activer la connexion par
mot de passe »** et choisir un mot de passe. Connexion : `ssh COMPTE@ssh-COMPTE.alwaysdata.net`.

### 3.3 Installer le projet (en SSH)

```bash
cd ~
git clone https://github.com/combonazridine04-hue/signale-mayotte.git

# Back-end (API)
cd ~/signale-mayotte/backend
cp .env.example .env      # puis remplir les variables (section 4)
sh scripts/mettre-a-jour.sh

# Front-end
cd ~/signale-mayotte/frontend
echo "VITE_API_URL=https://api.COMPTE.alwaysdata.net" > .env.production
npm ci && npm run build   # produit dist/ : les fichiers du site
```

[`backend/scripts/mettre-a-jour.sh`](../backend/scripts/mettre-a-jour.sh) installe **uniquement** les
dépendances de production de l'API. Installer aussi les outils de développement (tests,
lint) dépasse la mémoire de l'offre gratuite : le serveur arrête alors l'installation
(« Killed »).

Le front peut aussi être compilé sur le poste de développement, puis seul son dossier
`dist/` envoyé sur le serveur (par SFTP) : c'est plus rapide et sans risque pour la
mémoire du serveur.

### 3.4 Créer les deux sites

**Web → Sites** : modifier le site existant `COMPTE.alwaysdata.net` (créé avec le compte)
pour le front, et **Ajouter un site** pour l'API :

| Champ                 | Site de l'API (nouveau)                                                | Site du front (existant, modifié)            |
| --------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Adresses              | `api.COMPTE.alwaysdata.net`                                            | `COMPTE.alwaysdata.net`                      |
| Type                  | **Node.js**                                                            | **PHP** (serveur Apache, garde le type)      |
| Commande              | `node --max-old-space-size=96 --max-semi-space-size=2 src/server.js` | —                                            |
| Répertoire de travail | `/home/COMPTE/signale-mayotte/backend`                                 | —                                            |
| Répertoire racine     | —                                                                      | `/home/COMPTE/signale-mayotte/frontend/dist` |

- L'API écoute sur l'adresse et le port imposés par alwaysdata (variables `IP`/`HOST` et
  `PORT`) : le serveur les lit tout seul ([`src/server.js`](../backend/src/server.js)).
- Le front est servi par Apache, qui lit le fichier `.htaccess` du front (copié dans
  `dist/` au build) : toute adresse qui n'est pas un fichier (ex. `/signalements/42`)
  renvoie `index.html`, et les en-têtes de sécurité du site sont posés (HSTS, interdiction
  d'affichage dans un cadre, fonctions du navigateur autorisées).
- HTTPS est fourni par alwaysdata (certificat automatique) sur les deux adresses.

### 3.5 Services externes

- **Brevo** : _Senders & IP → Add a sender_ (valider l'adresse reçue), puis _SMTP & API →
  API Keys_ → `BREVO_API_KEY` et `BREVO_EXPEDITEUR`. Les emails partent par **API HTTPS**,
  jamais en SMTP (souvent bloqué par les hébergeurs).
- **Cloudflare Turnstile** : _Add widget_, ajouter le domaine du **front**
  `COMPTE.alwaysdata.net` (et `localhost` pour le développement) → `TURNSTILE_SITE_KEY` et
  `TURNSTILE_SECRET_KEY` (dans le `.env` de l'API).
- **MapTiler** : si la clé est restreinte par domaine, y ajouter `COMPTE.alwaysdata.net`.

---

## 4. Variables d'environnement

### 4.1 API — fichier `~/signale-mayotte/backend/.env`

Jamais dans le dépôt : `.env` est dans `.gitignore`, seul le modèle
[`.env.example`](../backend/.env.example) est versionné.

| Variable                                     | Obligatoire | Valeur en production                                                                |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | ✅          | `mysql://COMPTE_signale:MOTDEPASSE@mysql-COMPTE.alwaysdata.net:3306/COMPTE_signale` |
| `DATABASE_TLS`                               | ✅          | `non` : base jointe par le réseau interne d'alwaysdata                              |
| `FRONTEND_URL`                               | ✅          | `https://COMPTE.alwaysdata.net` : seule origine autorisée (CORS, anti-CSRF)         |
| `COOKIE_SAMESITE`                            | ✅          | `strict` (front et API sur le même site, voir section 1)                            |
| `SITE_URL`                                   | ✅          | `https://COMPTE.alwaysdata.net` (liens des emails, export RGPD)                     |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE`    | ✅          | Premier compte admin (mot de passe long et aléatoire)                               |
| `BREVO_API_KEY`, `BREVO_EXPEDITEUR`          | Recommandé  | Envoi des emails                                                                    |
| `EMAIL_DESTINATAIRE`                         | Optionnel   | Boîte qui reçoit les nouveaux signalements                                          |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Conseillé   | Captcha sur inscription, contact et mot de passe oublié                             |

`IP`, `HOST` et `PORT` sont fournis par alwaysdata. `TEST_DATABASE_URL` et `FRONTEND_DIR`
ne servent qu'aux tests : on ne les définit pas en production.

### 4.2 Front — fichier `~/signale-mayotte/frontend/.env.production`

Lu **au build** et copié dans le JavaScript envoyé au navigateur : ces valeurs sont
publiques, jamais de secret ici. Après toute modification, relancer `npm run build`.

| Variable            | Valeur                                                 |
| ------------------- | ------------------------------------------------------ |
| `VITE_API_URL`      | `https://api.COMPTE.alwaysdata.net` (sans « / » final) |
| `VITE_MAPTILER_KEY` | Clé des fonds de carte (optionnelle)                   |

### 4.3 Sécurité déjà gérée dans le code

- **CORS** ([`src/middlewares/cors.js`](../backend/src/middlewares/cors.js)) : seule l'adresse
  exacte de `FRONTEND_URL` reçoit l'autorisation de lire les réponses et d'envoyer le
  cookie. Jamais de `*`.
- **Anti-CSRF** ([`src/middlewares/verifierOrigine.js`](../backend/src/middlewares/verifierOrigine.js)) :
  toute requête de modification venue d'une autre origine est refusée (403).
- **Cookie de session** : `HttpOnly`, `Secure`, préfixe `__Host-`, `SameSite=Strict`.
- `app.set('trust proxy', 1)` : derrière le proxy d'alwaysdata, l'API lit la vraie IP du
  client (limites de débit) et sait que la connexion est en HTTPS.
- **helmet** sur l'API ; le front inscrit sa propre politique de sécurité du contenu (CSP)
  dans `index.html` au build : seuls l'API, le widget Cloudflare et les fonds de carte sont
  autorisés.
- Les photos sont servies avec `default-src 'none'; sandbox` (aucun contenu actif possible)
  et `Cross-Origin-Resource-Policy: cross-origin` (affichables par le front seulement en
  tant qu'images).
- Les erreurs 500 renvoient un message générique ; le détail ne va que dans les journaux.

---

## 5. Intégration continue

[`ci.yml`](../.github/workflows/ci.yml) (GitHub Actions) s'exécute sur l'API à chaque push
sur `main` et sur chaque pull request : `npm ci` → lint → vérification du formatage →
tests unitaires.

Les tests d'API et le parcours complet (`npm run test:api`, `npm run test:e2e`) ont besoin
d'une base MariaDB de test ; le parcours compile aussi le front et le sert à une autre
adresse que l'API, comme en production. On les lance sur le poste de développement avant
de pousser :

```bash
npm test   # unitaires + API + parcours dans un navigateur (front et API séparés)
```

---

## 6. Vérifier après un déploiement

1. **Journaux** (panneau → _Web → Sites → Journaux_, ou `~/admin/logs/` en SSH) : la ligne
   `API Signale Mayotte disponible sur …` apparaît, sans erreur.
2. **API** :
   ```bash
   curl -s https://api.COMPTE.alwaysdata.net/api/signalements/count     # {"count":…}
   curl -s -D - -o /dev/null -X OPTIONS https://api.COMPTE.alwaysdata.net/api/auth/connexion \
     -H "Origin: https://COMPTE.alwaysdata.net" -H "Access-Control-Request-Method: POST"
   # → Access-Control-Allow-Origin: https://COMPTE.alwaysdata.net
   ```
3. **Site** : `https://COMPTE.alwaysdata.net` affiche la liste des signalements ; recharger
   une page profonde (ex. `/carte`) fonctionne.
4. **Parcours** : créer un compte, un signalement avec une photo (elle s'affiche), puis se
   connecter en admin (avec le code 2FA s'il est activé). **Tester aussi sur un iPhone**
   (Safari) pour confirmer que la connexion tient.
5. **Emails** : une inscription avec email doit envoyer le code de vérification.
6. **Journal** : la connexion admin apparaît dans l'onglet _Journal_.

---

## 7. Mettre à jour et revenir en arrière

- **API :** pousser sur `main` (la CI vérifie le code), puis en SSH :
  ```bash
  sh ~/signale-mayotte/backend/scripts/mettre-a-jour.sh
  ```
  et **redémarrer le site de l'API** (panneau → _Web → Sites → Redémarrer_).
- **Front :** en SSH, `cd ~/signale-mayotte/frontend && git pull && npm ci && npm run build`.
  Le site statique sert aussitôt les nouveaux fichiers (aucun redémarrage).
- **Évolution du schéma :** on ajoute la colonne dans [`src/config/db.js`](../backend/src/config/db.js) avec
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB). La migration s'applique au
  démarrage suivant, sans script manuel, et peut être rejouée sans risque.
- **Retour arrière :** en SSH, revenir au commit précédent puis relancer l'installation :
  ```bash
  cd ~/signale-mayotte/backend && git log --oneline -5
  git checkout <commit_précédent> && sh scripts/mettre-a-jour.sh
  ```
  (puis, une fois corrigé, `git checkout main`). Même principe pour le front, suivi d'un
  `npm run build`. Un retour arrière ne retire pas une colonne déjà ajoutée : les migrations
  n'ajoutent que des colonnes, ce qui reste compatible avec l'ancien code.
- **Sauvegardes :** avant toute opération risquée, copier la base et les fichiers de l'API :
  ```bash
  mariadb-dump -h mysql-COMPTE.alwaysdata.net -u COMPTE_signale -p COMPTE_signale > sauvegarde.sql
  tar czf donnees.tar.gz -C ~/signale-mayotte/backend data
  ```
  (ou, dans DBeaver : clic droit sur la base → _Outils_ → _Sauvegarder_). Restauration :
  `mariadb -h … -u … -p COMPTE_signale < sauvegarde.sql`.

### Passage à l'organisation backend/ + frontend/ (une seule fois)

Si le serveur a été installé avec l'ancienne organisation (code de l'API à la racine du
dépôt, données dans `server/data`), après le premier `git pull` de la nouvelle version :

```bash
cd ~/signale-mayotte
mv .env backend/.env          # configuration de l'API
mv server/data backend/data   # photos et journal
sh backend/scripts/mettre-a-jour.sh
```

Puis, dans le panneau (_Web → Sites_) : site de l'API → répertoire de travail
`/home/COMPTE/signale-mayotte/backend` et commande terminant par `src/server.js` ;
site du front → répertoire racine `/home/COMPTE/signale-mayotte/frontend/dist`.

## 8. Pannes fréquentes

| Symptôme                                                            | Cause probable                                                   | Solution                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| L'API ne démarre pas, erreur `DATABASE_URL manquant`                | `.env` absent ou incomplet sur le serveur                        | Le compléter, puis redémarrer le site de l'API                  |
| Erreur de connexion à MariaDB (`ECONNREFUSED`, accès refusé)        | Mauvais hôte, mot de passe ou droits                             | Vérifier `DATABASE_URL` et les droits de l'utilisateur          |
| Erreur TLS vers MariaDB                                             | `DATABASE_TLS=non` oublié                                        | L'ajouter dans `.env`                                           |
| Le site affiche « Le serveur ne répond pas », console : erreur CORS | `FRONTEND_URL` absent ou différent de l'adresse du front         | Mettre l'adresse exacte du front (https, sans « / » final)      |
| Requêtes refusées : « elle ne provient pas du site » (403)          | Même cause : origine du front non déclarée                       | Corriger `FRONTEND_URL`, redémarrer l'API                       |
| Connexion qui ne tient pas (déconnecté à chaque page)               | Front et API sur deux sites différents, cookie bloqué            | Mettre l'API en `api.COMPTE.alwaysdata.net` (section 1)         |
| Le front appelle `localhost` ou une mauvaise adresse                | `VITE_API_URL` absent ou faux au moment du build                 | Corriger `.env.production`, relancer `npm run build`            |
| Page blanche en rechargeant `/carte` ou `/signalements/42`          | `.htaccess` absent de `dist/`, ou site d'un autre type qu'Apache | Recompiler le front ; site de type PHP (section 3.4)            |
| Photos absentes, console : erreur CSP                               | `VITE_API_URL` absent au build (CSP du front sans l'API)         | Le renseigner et relancer `npm run build`                       |
| Erreur 502 sur l'API                                                | Elle n'écoute pas sur l'adresse imposée, ou a planté             | Lire les journaux ; vérifier la commande du site                |
| API redémarrée en pleine analyse de photos (mémoire dépassée)       | Commande sans limite de mémoire, ou envois simultanés            | Commande de la section 3.4 ; offre supérieure si cela se répète |
| Aucun email reçu                                                    | `BREVO_EXPEDITEUR` non validé, ou clé absente                    | Valider l'expéditeur dans Brevo                                 |
| La case anti-robot ne s'affiche pas ou échoue toujours              | Domaine du front absent du widget Turnstile                      | Ajouter `COMPTE.alwaysdata.net` dans Cloudflare                 |
