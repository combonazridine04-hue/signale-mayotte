const S = require('./generer-docx.cjs')
const { titre1, titre2, titre3, p, puce, encadre, tableau, espace, code, pageDeGarde, document, ecrire } = S

const enfants = [
  ...pageDeGarde('3', 'Environnement technique'),

  titre1("3.1  Architecture générale de l'application"),
  ...code([
    '  Utilisateur          Front-end            API REST          Back-end',
    '  (navigateur)   →     Vue 3 / Vite   →   HTTP / JSON   →   Node.js + Express',
    '                       Pinia, Router                              │',
    '                                                                  ├──→  PostgreSQL (Supabase)',
    '                                                                  ├──→  Supabase Storage (photos)',
    '                                                                  └──→  API Brevo (emails)'
  ]),
  espace(),
  p("L'application suit une architecture client-serveur. Le navigateur charge une application Vue 3 compilée par Vite : c'est une application à page unique, la navigation entre les écrans se fait sans rechargement grâce à Vue Router."),
  p("Chaque action nécessitant des données déclenche une requête HTTP vers l'API REST, en JSON. Toutes les requêtes passent par une fonction unique, **apiFetch**, qui ajoute le jeton de session dans l'en-tête Authorization et gère les reprises réseau."),
  p("Côté serveur, Express reçoit la requête, la fait passer par les middlewares (sécurité, limitation de débit, authentification), puis la route la traite : elle valide les données, applique les règles métier et interroge PostgreSQL à l'aide de requêtes paramétrées via le pilote pg. La réponse repart en JSON."),
  p("Deux services externes complètent l'ensemble : **Supabase Storage** pour les photos, et **l'API HTTPS de Brevo** pour l'envoi des emails."),
  encadre("En production, un seul et même service Node.js sert l'API **et** les fichiers statiques du front compilé : le front et l'API partagent donc la même origine, ce qui supprime toute problématique CORS."),

  titre1('3.2  Environnement de développement'),
  ...[
    "**Système d'exploitation** : Windows 11.",
    "**Éditeur** : Visual Studio Code, avec son terminal intégré pour lancer les serveurs, installer les dépendances npm et utiliser Git.",
    "**Runtime** : Node.js (modules ES natifs) et npm.",
    "**Commande unique de développement** : npm run dev lance simultanément, via concurrently, le serveur Vite (port 5173) et l'API Express (port 3001). Vite proxifie /api vers Express, ce qui reproduit en local le fonctionnement de la production.",
    "**Outils du navigateur** : onglet Réseau pour inspecter les requêtes API, Console pour les erreurs JavaScript, mode appareil mobile pour vérifier le responsive."
  ].map(puce),

  titre1('3.3  Technologies front-end'),
  tableau(
    ['Technologie', 'Rôle dans le projet'],
    [
      ['HTML5 / CSS3', 'Structure et mise en forme. 21 feuilles de style, une par écran ou composant, importées depuis main.js.'],
      ['Bootstrap 5', "Grille responsive, formulaires et boutons. Servi par le site lui-même et non par un CDN, pour éviter une requête bloquante vers un tiers au premier affichage."],
      ['Vue 3', "Découpage de l'interface en 18 composants réutilisables et 17 vues ; affichage réactif à partir des données de l'API."],
      ['Vue Router', "Navigation entre les écrans et protection des routes : une garde beforeEach redirige vers la connexion si la page exige un compte."],
      ['Pinia', "6 stores. L'état partagé (session, signalements, notifications) est centralisé au lieu d'être recopié dans chaque composant."],
      ['Leaflet', 'Carte des signalements et sélecteur de localisation, avec des tuiles MapTiler.'],
      ['Three.js', "Globe 3D décoratif en fond de page. Chargé en différé, et pas du tout en mode économiseur de données."]
    ],
    [0.2, 0.8]
  ),
  espace(),
  titre3("Pourquoi Vue plutôt qu'une page HTML/JS simple ?"),
  p("Le site affiche les mêmes données à plusieurs endroits (liste, carte, tableau de bord, notifications) et doit les mettre à jour sans rechargement. Sans framework, il aurait fallu écrire à la main la synchronisation entre l'état et le DOM. Vue fournit cette réactivité, et les composants évitent de dupliquer le code — la carte d'un signalement, par exemple, s'affiche à l'identique sur l'accueil, la recherche filtrée et l'espace citoyen."),

  titre1('3.4  Technologies back-end'),
  tableau(
    ['Technologie', 'Rôle'],
    [
      ['Node.js', "Exécution du JavaScript côté serveur : un seul langage sur tout le projet."],
      ['Express 5', "Serveur HTTP, définition des routes de l'API, service des fichiers statiques du front."],
      ['pg', 'Pilote PostgreSQL, avec un pool de connexions et des requêtes paramétrées.'],
      ['bcryptjs', 'Hachage des mots de passe (12 tours).'],
      ['helmet', 'En-têtes de sécurité HTTP, dont la politique de sécurité du contenu (CSP).'],
      ['express-rate-limit', 'Limitation du débit sur les routes sensibles.'],
      ['multer', 'Réception des fichiers envoyés, en mémoire.'],
      ['sharp', 'Redimensionnement des photos et suppression de leurs métadonnées.'],
      ['nsfwjs + TensorFlow.js', 'Analyse automatique des photos avant publication.']
    ],
    [0.28, 0.72]
  ),
  espace(),
  p("**Organisation des requêtes** : index.js monte les middlewares globaux puis les routeurs. Chaque routeur reçoit la requête, valide les données, applique les règles métier en s'appuyant sur les modules de service (auth.js, notifications.js, storage.js, mailer.js, moderation.js), interroge la base via db.js, et renvoie une réponse JSON avec le code HTTP approprié."),
  p("**Variables d'environnement** : toutes les valeurs sensibles (connexion à la base, clés d'API, identifiants administrateur) sont lues depuis l'environnement. Un fichier .env.example documente chaque variable ; le .env réel n'est jamais versionné."),
  p("**CORS** : aucune configuration n'a été nécessaire, le front et l'API étant servis depuis la même origine en production."),

  titre1('3.5  Base de données'),
  ...[
    "**SGBDR** : PostgreSQL, hébergé chez Supabase (offre gratuite).",
    "**Administration** : l'éditeur SQL et l'explorateur de tables de l'interface Supabase.",
    "**Connexion depuis le back-end** : pool pg initialisé dans server/db.js à partir de la variable DATABASE_URL, en SSL.",
    "**Rôle dans le projet** : la base stocke l'intégralité des données métier — comptes, signalements, soutiens, commentaires, notifications et messages. Les photos ne sont pas stockées en base : seules leurs URL le sont, les fichiers résidant dans Supabase Storage."
  ].map(puce),
  espace(80),
  encadre("**Création du schéma** : le schéma est appliqué au démarrage du serveur, de façon idempotente (CREATE TABLE IF NOT EXISTS, ALTER TABLE … ADD COLUMN IF NOT EXISTS). Chaque évolution du modèle est ainsi déployée automatiquement, sans intervention manuelle sur la base de production."),

  titre1('3.6  Outils utilisés'),
  tableau(
    ['Outil', 'Étape du projet'],
    [
      ['Visual Studio Code', 'Coder'],
      ['Git / GitHub', 'Versionner'],
      ['Supabase (éditeur SQL)', 'Administrer la base'],
      ['DevTools du navigateur', 'Déboguer, vérifier le responsive et les requêtes réseau'],
      ['Playwright', 'Tester les parcours dans un vrai navigateur'],
      ['node --test', "Tester l'API"],
      ['Render', 'Déployer']
    ],
    [0.32, 0.68]
  ),
  espace(),
  encadre("Ce projet n'a pas utilisé Postman. Les routes ont été testées par des scripts Node exécutant fetch, ce qui présente l'avantage d'être rejouable en une commande et versionné avec le projet.", S.BLEU),

  titre1('3.7  Organisation du projet'),
  ...code([
    'signale-mayotte/',
    '├── server/              API et logique métier',
    '│   ├── routes/          6 routeurs : signalements, auth, contact,',
    '│   │                    moderation, notifications, admins',
    '│   ├── middleware/      requireAuth.js — contrôle du jeton et du type de session',
    '│   ├── tests/           tests automatisés de l\'API',
    '│   ├── db.js            pool PostgreSQL + schéma',
    '│   ├── auth.js          sessions, hachage, codes de vérification',
    '│   ├── storage.js       photos (Supabase Storage)',
    '│   ├── mailer.js        envoi des emails',
    '│   ├── moderation.js    analyse automatique des photos',
    '│   ├── notifications.js notifications dans le site',
    '│   └── index.js         middlewares globaux, montage des routeurs',
    '├── src/                 application Vue',
    '│   ├── views/           17 écrans (dont 2 pour l\'administration)',
    '│   ├── components/      18 composants réutilisables',
    '│   ├── stores/          6 stores Pinia',
    '│   ├── router/          routes et gardes de navigation',
    '│   ├── utils/           api.js (appels HTTP), dates.js, tuiles.js',
    '│   ├── models/          catégories, communes, statuts',
    '│   └── assets/css/      21 feuilles de style',
    '├── shared/              code partagé client ET serveur',
    '│   ├── telephone.js     format des numéros mahorais',
    '│   ├── motDePasse.js    force et refus des mots de passe',
    '│   └── nomPublic.js     abréviation « Prénom N. »',
    '└── tests/e2e/           parcours utilisateur complet'
  ]),
  espace(),
  titre3('Pourquoi séparer ainsi ?'),
  p("Les routes reçoivent la requête HTTP et décident du code de réponse ; elles ne savent rien de la façon dont les photos sont stockées ou dont les emails partent. Ces traitements sont isolés dans des modules dédiés, ce qui a permis, par exemple, de **changer entièrement de fournisseur d'email sans toucher une seule route**."),
  p("Le dossier **shared/** mérite une mention : la validation du format des numéros de téléphone est utilisée par le navigateur (retour immédiat pendant la frappe) et par le serveur (contrôle final). Écrire cette règle une seule fois garantit que les deux ne peuvent pas diverger."),

  titre1('3.8  Gestion des versions'),
  ...[
    "**Dépôt** : combonazridine04-hue/signale-mayotte sur GitHub, branche main.",
    "**58 commits** entre le 17 août et le 24 septembre 2026.",
    "**Messages de commit** : rédigés en français, décrivant l'effet obtenu et non le fichier modifié — par exemple « Permet à l'auteur de corriger son signalement avant sa prise en charge » plutôt que « update signalements.js ». Le corps du message explique la cause du problème et la façon dont la correction a été vérifiée.",
    "**README** : présente la pile technique, l'installation, les commandes de développement et les variables d'environnement à renseigner.",
    "**Lien avec le déploiement** : chaque push sur main déclenche automatiquement un nouveau déploiement sur Render. La branche main correspond donc en permanence à ce qui est en ligne."
  ].map(puce),

  titre1('3.9  Environnement de production / hébergement'),
  tableau(
    ['Élément', 'Hébergement'],
    [
      ['Front-end + API', 'Render — un service web Node.js unique'],
      ['Base de données', 'Supabase — PostgreSQL managé'],
      ['Photos', 'Supabase Storage — bucket public signalement-photos'],
      ['Emails', 'Brevo — API HTTPS'],
      ['Tuiles de la carte', 'MapTiler — clé restreinte au domaine de production']
    ],
    [0.3, 0.7]
  ),
  espace(),
  ...[
    "**Commande de build** : npm install && npm run build (Vite compile le front dans dist/).",
    "**Commande de démarrage** : npm start (node server/index.js).",
    "**Port** : fourni par l'hébergeur via la variable PORT.",
    "**Adresse** : https://signale-mayotte.onrender.com"
  ].map(puce),
  espace(80),
  p("Express sert les fichiers de dist/ et renvoie index.html pour toute route inconnue, afin que la navigation côté client fonctionne même sur un lien partagé ou un rafraîchissement de page."),
  encadre("**Limite assumée de l'offre gratuite** : le service est mis en veille après environ un quart d'heure sans visite, et son réveil prend de trente secondes à une minute. Cette contrainte a été traitée dans le code plutôt que subie (voir partie 4, section 4.8).")
]

ecrire('DWWM - Partie 3 - Environnement technique.docx', document(enfants))
