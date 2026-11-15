# Déploiement — Signale Mayotte

Ce document explique comment mettre l'application en production chez **alwaysdata**, la
vérifier, la mettre à jour et revenir en arrière. Il s'adresse à un développeur qui reprend
le projet sans l'avoir écrit.

---

## 1. Architecture de production

```
                      ┌──────────────── alwaysdata (France) ────────────────────────┐
 Navigateur ──HTTPS──▶│ Proxy HTTPS ──▶ Site Node.js : Express                      │
                      │                  ├─ API /api/*  +  front Vue compilé (dist/)  │
                      │                  ├─ photos : disque (server/data/uploads)     │
                      │                  └─ journal NoSQL NeDB (server/data/journal)  │
                      │                         │                                    │
                      │                         ▼                                    │
                      │                  MariaDB (réseau interne)                    │
                      └──────────────────────────────────────────────────────────────┘
                               │                         │
                         Brevo (emails)        Cloudflare Turnstile (anti-robot)
```

Un **seul hébergeur** pour tout : le site, la base MariaDB et le disque. Le disque
d'alwaysdata est **permanent** : photos et journal restent d'une mise à jour à l'autre.
Le site ne se met jamais en veille.

Un **seul processus** sert l'API et le front compilé : même origine, donc pas de CORS à
configurer, et le cookie de session reste `SameSite=Strict`.

## 2. Prérequis

| Élément                                             | Version / offre                                                           | Obligatoire                       |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| [alwaysdata](https://www.alwaysdata.com)            | Offre gratuite : ~1 Go de disque, 256 Mo de mémoire, MariaDB inclus       | Oui                               |
| Node.js                                             | **20.19 ou plus** (champ `engines` du `package.json`) ; Node 22 conseillé | Oui                               |
| Compte GitHub                                       | Dépôt du projet (le serveur le clone)                                     | Oui                               |
| [Brevo](https://brevo.com)                          | 300 emails/jour gratuits                                                  | Recommandé                        |
| [Cloudflare Turnstile](https://dash.cloudflare.com) | Gratuit                                                                   | Non, mais conseillé en production |
| [MapTiler](https://cloud.maptiler.com)              | Clé gratuite                                                              | Non (repli sur OpenStreetMap)     |

Mesures de l'application, pour vérifier qu'elle tient dans l'offre gratuite : ~100 Mo de
mémoire au repos, ~180 Mo au plus fort de l'analyse des photos (modèle d'IA de
modération), ~480 Mo de dépendances de production.

---

## 3. Préparer alwaysdata (panneau https://admin.alwaysdata.com)

Dans la suite, `COMPTE` désigne le nom du compte alwaysdata.

### 3.1 Base MariaDB

1. **Bases de données → MySQL → Ajouter une base de données** : `signale` (alwaysdata la
   nomme `COMPTE_signale`).
2. Onglet **Utilisateurs → Ajouter un utilisateur** : `COMPTE_signale`, mot de passe long,
   droits **uniquement** sur cette base (principe du moindre privilège, jamais d'accès
   global).
3. Le serveur MariaDB s'appelle `mysql-COMPTE.alwaysdata.net`. Le site et la base étant
   tous deux chez alwaysdata, la connexion passe par leur réseau interne.

Rien d'autre à créer : au premier démarrage, l'application crée ses tables
([`server/db.js`](../server/db.js)) et le premier compte admin.

### 3.2 Accès SSH

**Accès distant → SSH** : sur l'utilisateur du compte, cocher **« Activer la connexion par
mot de passe »** et choisir un mot de passe. Connexion : `ssh COMPTE@ssh-COMPTE.alwaysdata.net`.

### 3.3 Installer le code (en SSH)

```bash
cd ~
git clone https://github.com/combonazridine04-hue/signale-mayotte.git
cd signale-mayotte
cp .env.example .env      # puis remplir les variables (section 4)
sh scripts/mettre-a-jour.sh
```

[`scripts/mettre-a-jour.sh`](../scripts/mettre-a-jour.sh) installe les dépendances,
compile le front dans `dist/` et retire les outils de développement (pour économiser le
disque). Le navigateur des tests automatiques n'est pas téléchargé sur le serveur.

### 3.4 Créer le site

**Web → Sites → Ajouter un site** :

| Champ                 | Valeur                  |
| --------------------- | ----------------------- |
| Adresses              | `COMPTE.alwaysdata.net` |
| Type                  | **Node.js**             |
| Commande              | `node server/index.js`  |
| Répertoire de travail | `signale-mayotte`       |
| Version de Node.js    | 22                      |

alwaysdata impose l'adresse et le port d'écoute (variables `IP`/`HOST` et `PORT`) : le
serveur les lit tout seul ([`server/index.js`](../server/index.js)). HTTPS est fourni par
alwaysdata (certificat automatique).

### 3.5 Services externes

- **Brevo** : _Senders & IP → Add a sender_ (valider l'adresse reçue), puis _SMTP & API →
  API Keys_ → `BREVO_API_KEY` et `BREVO_EXPEDITEUR`. Les emails partent par **API HTTPS**,
  jamais en SMTP (souvent bloqué par les hébergeurs).
- **Cloudflare Turnstile** : _Add widget_, ajouter le domaine `COMPTE.alwaysdata.net`
  (et `localhost` pour le développement) → `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.
- **MapTiler** : si la clé est restreinte par domaine, y ajouter `COMPTE.alwaysdata.net`.

---

## 4. Variables d'environnement

Dans le fichier **`.env` du serveur** (`~/signale-mayotte/.env`), lu au démarrage. Jamais
dans le dépôt : `.env` est dans `.gitignore`, seul le modèle
[`.env.example`](../.env.example) est versionné.

| Variable                                     | Obligatoire | Valeur en production                                                                |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | ✅          | `mysql://COMPTE_signale:MOTDEPASSE@mysql-COMPTE.alwaysdata.net:3306/COMPTE_signale` |
| `DATABASE_TLS`                               | ✅          | `non` : base jointe par le réseau interne d'alwaysdata                              |
| `ADMIN_IDENTIFIANT`, `ADMIN_MOT_DE_PASSE`    | ✅          | Premier compte admin (mot de passe long et aléatoire)                               |
| `SITE_URL`                                   | ✅          | `https://COMPTE.alwaysdata.net` (liens des emails, export RGPD)                     |
| `BREVO_API_KEY`, `BREVO_EXPEDITEUR`          | Recommandé  | Envoi des emails                                                                    |
| `EMAIL_DESTINATAIRE`                         | Optionnel   | Boîte qui reçoit les nouveaux signalements                                          |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Conseillé   | Captcha sur inscription, contact et mot de passe oublié                             |
| `VITE_MAPTILER_KEY`                          | Optionnel   | Fonds de carte. Lue **au build** par Vite : relancer le build si elle change        |

`IP`, `HOST` et `PORT` sont fournis par alwaysdata. `TEST_DATABASE_URL` ne sert qu'aux
tests : on ne la définit pas en production.

Points de sécurité déjà gérés dans le code :

- `app.set('trust proxy', 1)` : derrière le proxy d'alwaysdata, Express lit la vraie IP du
  client (limites de débit) et sait que la connexion est en HTTPS.
- Le cookie de session passe en `Secure` dès que la requête est en HTTPS.
- **helmet** ajoute les en-têtes de sécurité (CSP, HSTS, `X-Content-Type-Options`…).
- Les erreurs 500 renvoient un message générique ; le détail ne va que dans les journaux.
- Les photos sont servies avec une politique `default-src 'none'; sandbox` : un fichier
  piégé ne peut jamais s'exécuter comme une page.

---

## 5. Intégration continue

[`ci.yml`](../.github/workflows/ci.yml) (GitHub Actions) s'exécute à chaque push sur `main`
et sur chaque pull request : `npm ci` → lint → vérification du formatage → tests unitaires
→ build.

Les tests d'API et de parcours (`npm run test:api`, `npm run test:e2e`) ont besoin d'une
base MariaDB de test. On les lance sur le poste de développement avant de pousser :

```bash
npm test   # unitaires + build + API + parcours dans un navigateur
```

---

## 6. Vérifier après un déploiement

1. **Journaux** (panneau → _Web → Sites → Journaux_, ou `~/admin/logs/` en SSH) : la ligne
   `API Signale Mayotte disponible sur …` apparaît, sans erreur.
2. **Page d'accueil** : la liste des signalements se charge.
3. **API** :
   ```bash
   curl -s https://COMPTE.alwaysdata.net/api/signalements/count     # {"count":…}
   curl -sI https://COMPTE.alwaysdata.net/ | grep -i "strict-transport\|content-security"
   ```
4. **Parcours** : créer un signalement avec une photo, vérifier qu'elle s'affiche, puis se
   connecter en admin (avec le code 2FA s'il est activé).
5. **Emails** : une inscription avec email doit envoyer le code de vérification.
6. **Journal** : la connexion admin apparaît dans l'onglet _Journal_.

---

## 7. Mettre à jour et revenir en arrière

- **Mise à jour :** pousser sur `main` (la CI vérifie le code), puis en SSH :
  ```bash
  sh ~/signale-mayotte/scripts/mettre-a-jour.sh
  ```
  et **redémarrer le site** (panneau → _Web → Sites → Redémarrer_).
- **Évolution du schéma :** on ajoute la colonne dans [`server/db.js`](../server/db.js) avec
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (syntaxe MariaDB). La migration s'applique au
  démarrage suivant, sans script manuel, et peut être rejouée sans risque.
- **Retour arrière :** en SSH, revenir au commit précédent puis relancer le build :
  ```bash
  cd ~/signale-mayotte && git log --oneline -5
  git checkout <commit_précédent> && sh scripts/mettre-a-jour.sh
  ```
  (puis, une fois corrigé, `git checkout main`). Un retour arrière ne retire pas une
  colonne déjà ajoutée : les migrations n'ajoutent que des colonnes, ce qui reste
  compatible avec l'ancien code.
- **Sauvegardes :** avant toute opération risquée, copier la base et les fichiers :
  ```bash
  mariadb-dump -h mysql-COMPTE.alwaysdata.net -u COMPTE_signale -p COMPTE_signale > sauvegarde.sql
  tar czf donnees.tar.gz -C ~/signale-mayotte/server data
  ```
  (ou, dans DBeaver : clic droit sur la base → _Outils_ → _Sauvegarder_). Restauration :
  `mariadb -h … -u … -p COMPTE_signale < sauvegarde.sql`.

## 8. Pannes fréquentes

| Symptôme                                                          | Cause probable                                             | Solution                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Le site ne démarre pas, erreur `DATABASE_URL manquant`            | `.env` absent ou incomplet sur le serveur                  | Le compléter, puis redémarrer le site                  |
| Erreur de connexion à MariaDB (`ECONNREFUSED`, accès refusé)      | Mauvais hôte, mot de passe ou droits                       | Vérifier `DATABASE_URL` et les droits de l'utilisateur |
| Erreur TLS vers MariaDB                                           | `DATABASE_TLS=non` oublié                                  | L'ajouter dans `.env`                                  |
| Page blanche ou « Cannot GET / »                                  | Front non compilé (`dist/` absent)                         | Relancer `scripts/mettre-a-jour.sh`                    |
| Erreur 502 du site                                                | Le serveur n'écoute pas sur l'adresse imposée, ou a planté | Lire les journaux ; vérifier la commande du site       |
| Mémoire dépassée au moment d'analyser des photos                  | Offre gratuite (256 Mo) et envois simultanés               | Réessayer ; offre supérieure si cela se répète         |
| Aucun email reçu                                                  | `BREVO_EXPEDITEUR` non validé, ou clé absente              | Valider l'expéditeur dans Brevo                        |
| La case anti-robot ne s'affiche pas ou échoue toujours            | Domaine absent du widget Turnstile                         | Ajouter `COMPTE.alwaysdata.net` dans Cloudflare        |
| Erreur 503 « Vérification anti-robot momentanément indisponible » | Cloudflare injoignable depuis le serveur                   | Réessayer ; vérifier `TURNSTILE_SECRET_KEY`            |
