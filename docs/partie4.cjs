const S = require('./generer-docx.cjs')
const { titre1, titre2, titre3, p, puce, encadre, tableau, espace, code, pageDeGarde, document, ecrire } = S

const ACOMPLETER = (texte) => encadre('[À COMPLÉTER] ' + texte, 'C00000')

const enfants = [
  ...pageDeGarde('4', 'Réalisations'),

  // ---------------------------------------------------------------- 4.1
  titre1('4.1  Maquettage des interfaces'),
  ACOMPLETER("Insérer ici les wireframes ou croquis réalisés avant ou pendant le développement, en version ordinateur et mobile, ainsi que le schéma de navigation entre les écrans, et la comparaison entre maquette et écran final."),
  titre3("Choix d'ergonomie effectivement mis en œuvre"),
  ...[
    "**Barre de navigation en bas de l'écran**, sous forme d'icônes, plutôt qu'en haut : sur téléphone, le bas de l'écran est la zone accessible au pouce. Chaque icône porte un libellé au survol et un aria-label pour les lecteurs d'écran.",
    "**Colonne d'aide à côté de chaque formulaire** : la colonne de gauche des écrans de saisie contient les informations utiles au moment précis du remplissage. Elle reste visible pendant le défilement des formulaires longs.",
    "**Retour visuel immédiat** : format du téléphone et force du mot de passe sont indiqués pendant la frappe, sans attendre l'envoi du formulaire.",
    "**Statut sous forme de frise** sur la page d'un signalement (Signalé → En cours → Résolu), avec la date de chaque étape."
  ].map(puce),

  // ---------------------------------------------------------------- 4.2
  titre1('4.2  Conception et mise en place de la base de données'),

  titre2('4.2.1  Identification des données'),
  ...[
    "**Utilisateur** : nom, email, téléphone, mot de passe, pseudo public, photo de profil, état de vérification de l'email, date de création.",
    "**Signalement** : catégorie, commune, description, photos, position géographique, statut, caractère urgent, dates de signalement / modification / résolution, auteur.",
    "**Soutien** : signalement concerné, auteur du soutien, date.",
    "**Commentaire** : signalement concerné, auteur, texte, commentaire parent éventuel, date.",
    "**Mise à jour** : signalement concerné, texte officiel, date.",
    "**Notification** : destinataire, signalement concerné, texte, état lu/non lu.",
    "**Signalement d'abus** : type de contenu, identifiant du contenu, motif, auteur du signalement.",
    "**Message de contact** : nom, email, sujet, message, état lu/non lu.",
    "**Administrateur** : identifiant, mot de passe."
  ].map(puce),

  titre2('4.2.2  Dictionnaire de données (extrait)'),
  titre3('Table utilisateurs'),
  tableau(
    ['Donnée', 'Description', 'Type métier', 'Contraintes'],
    [
      ['id', 'Identifiant technique', 'Entier', 'Clé primaire, auto-incrément'],
      ['nom', 'Nom complet', 'Texte', 'Obligatoire, 2 caractères minimum'],
      ['email', 'Adresse électronique', 'Texte', 'Unique, format contrôlé'],
      ['telephone', 'Numéro', 'Texte', 'Unique, 10 chiffres normalisés'],
      ['mot_de_passe_hash', 'Empreinte du mot de passe', 'Texte', 'Obligatoire, jamais en clair'],
      ['pseudo', 'Nom affiché publiquement', 'Texte', '2 à 24 caractères, facultatif'],
      ['avatar_url', 'Adresse de la photo de profil', 'Texte', 'Facultatif'],
      ['email_verifie', 'Adresse confirmée', 'Booléen', 'Défaut : faux'],
      ['cree_le', 'Date de création', 'Date', 'Obligatoire']
    ],
    [0.25, 0.28, 0.16, 0.31]
  ),
  espace(),
  titre3('Table signalements'),
  tableau(
    ['Donnée', 'Description', 'Type métier', 'Contraintes'],
    [
      ['id', 'Identifiant technique', 'Entier', 'Clé primaire'],
      ['categorie', 'Type de problème', 'Texte', 'Obligatoire, liste fermée'],
      ['commune', 'Commune concernée', 'Texte', 'Obligatoire, liste fermée'],
      ['description', 'Description du problème', 'Texte', 'Obligatoire, 10 à 2000 caractères'],
      ['photos', 'Adresses des photos', 'Tableau de textes', '5 maximum'],
      ['statut', 'Avancement', 'Texte', 'Signalé / En cours / Résolu'],
      ['urgent', 'Danger immédiat', 'Booléen', 'Défaut : faux'],
      ['latitude, longitude', 'Position', 'Décimal', 'Obligatoires à la création'],
      ['nb_soutiens', 'Nombre de soutiens', 'Entier', 'Défaut : 0'],
      ['utilisateur_id', 'Auteur', 'Entier', 'Clé étrangère vers utilisateurs'],
      ['token_suppression', 'Jeton secret de propriété', 'Texte', 'Généré à la création']
    ],
    [0.25, 0.28, 0.16, 0.31]
  ),
  espace(),
  p("Le dictionnaire complet des 9 tables figure en annexe.", { italics: true }),

  titre2('4.2.3  Formalisation des règles de gestion'),
  tableau(
    ['Réf.', 'Règle formalisée', 'Traduction dans la solution', 'Preuve / test'],
    [
      ['RG01', 'Un compte possède au moins un moyen de contact : email ou téléphone.', "Contrainte CHECK (email IS NOT NULL OR telephone IS NOT NULL), doublée d'un contrôle dans le service d'inscription.", 'Inscription sans email ni téléphone refusée (400).'],
      ['RG02', 'Un email et un téléphone ne peuvent identifier qu\'un seul compte.', 'Contraintes UNIQUE sur les deux colonnes ; le code 23505 de PostgreSQL est traduit en message métier.', 'Seconde inscription avec le même email refusée.'],
      ['RG03', 'Un numéro est stocké sous une forme unique (10 chiffres, sans espaces).', 'Normalisation dans shared/telephone.js, appliquée avant l\'insertion ET avant la recherche à la connexion.', '« 0639065031 » et « 06 39 06 50 31 » désignent le même compte.'],
      ['RG04', "Un mot de passe fait au moins 8 caractères, n'est pas un mot de passe courant, et n'est jamais stocké en clair.", 'shared/motDePasse.js + hachage bcrypt à 12 tours.', '« 12345678 » refusé avec un message explicite.'],
      ['RG05', "L'envoi d'un signalement exige une adresse email confirmée, si le compte a été créé avec un email.", "Contrôle de email_verifie avant l'insertion.", 'Envoi refusé tant que le code à 6 chiffres n\'est pas saisi.'],
      ['RG06', 'Un signalement porte une catégorie et une commune de listes fermées, une description de 10 à 2000 caractères et une position.', 'Validation serveur contre CATEGORIES et COMMUNES ; champs obligatoires côté client.', 'Catégorie inventée refusée (400) ; description de 3 caractères refusée (400).'],
      ['RG07', 'Un même citoyen ne peut soutenir un signalement qu\'une seule fois.', 'UNIQUE (signalement_id, ip_hash) et index unique partiel sur (signalement_id, utilisateur_id).', 'Second soutien refusé (409).'],
      ['RG08', "L'auteur peut corriger son signalement tant qu'il n'est pas pris en charge.", 'Fonction estAutoriseAModifier : autorisée si admin, ou si auteur ET statut encore « Signalé ».', 'Modification refusée (403) dès le passage « En cours ».'],
      ['RG09', 'Un citoyen ne peut agir que sur ses propres contenus.', 'Comparaison de utilisateur_id avec la session, dans chaque route de modification et suppression.', "Un compte tentant d'agir sur le contenu d'un autre reçoit 403."],
      ['RG10', 'Supprimer un commentaire supprime ses réponses.', 'Clé étrangère parent_id avec ON DELETE CASCADE.', 'Les réponses disparaissent avec le commentaire parent.'],
      ['RG11', "Les fils de discussion n'ont qu'un seul niveau.", "À l'insertion, répondre à une réponse rattache au commentaire d'origine.", 'Une réponse à une réponse apparaît sous le commentaire racine.'],
      ['RG12', "L'identité réelle d'un contributeur n'est jamais affichée publiquement.", 'Pseudo prioritaire ; à défaut le nom est abrégé par nomPublic(). Les champs d\'identité ne sont sérialisés que pour un admin.', '« Zakaria Bacar » s\'affiche « Zakaria B. » ; la liste publique ne contient aucun champ d\'identité.'],
      ['RG13', 'Un signalement non résolu, de même catégorie et à moins de 400 m, est proposé comme doublon.', 'Requête géographique bornée sur latitude/longitude, excluant les résolus, limitée à 3 résultats.', "Un signalement voisin est proposé ; un signalement à 5 km ou d'une autre catégorie ne l'est pas."],
      ['RG14', 'Un signalement urgent est présenté avant les autres, quel que soit le tri.', 'ORDER BY urgent DESC, <tri choisi> ; le tri provient d\'une liste blanche.', 'Avec le tri « plus anciens », le signalement urgent reste en tête.'],
      ['RG15', 'Une photo publiée est débarrassée de ses métadonnées et analysée avant publication.', "sharp réencode l'image (supprime l'EXIF, dont la position GPS) ; nsfwjs analyse le contenu avant l'envoi au stockage.", "Une photo refusée n'est jamais stockée."]
    ],
    [0.07, 0.29, 0.34, 0.3]
  ),

  titre2('4.2.4  Modèle conceptuel de données'),
  ACOMPLETER('Dessiner le MCD à partir des entités et cardinalités ci-dessous.'),
  ...code([
    'UTILISATEUR (1,N) ——— DÉPOSE ——— (0,1) SIGNALEMENT',
    'UTILISATEUR (0,N) ——— SOUTIENT ——— (0,N) SIGNALEMENT',
    'UTILISATEUR (0,N) ——— COMMENTE ——— (0,N) SIGNALEMENT',
    'COMMENTAIRE (0,N) ——— RÉPOND À ——— (0,1) COMMENTAIRE   (réflexive)',
    'SIGNALEMENT (1,1) ——— REÇOIT ——— (0,N) MISE_A_JOUR',
    'UTILISATEUR (1,1) ——— REÇOIT ——— (0,N) NOTIFICATION',
    'UTILISATEUR (0,N) ——— SIGNALE_ABUS ——— (0,N) CONTENU'
  ]),
  espace(),
  titre3('Choix importants à commenter'),
  ...[
    "**SOUTIENT** et **COMMENTE** sont des associations plusieurs-à-plusieurs, transformées en tables associatives dans le modèle relationnel.",
    "L'association **RÉPOND À** est réflexive : un commentaire peut être la réponse à un autre commentaire de la même table. Elle se traduit par une clé étrangère de commentaires vers elle-même.",
    "La cardinalité (0,1) côté SIGNALEMENT pour DÉPOSE est volontaire : un signalement peut survivre à la suppression du compte de son auteur. La suppression d'un compte détache le signalement (ON DELETE SET NULL) au lieu de l'effacer, car l'information reste utile à la collectivité."
  ].map(puce),

  titre2('4.2.5  Modèle logique de données'),
  ...code([
    'utilisateurs (#id, nom, email, telephone, mot_de_passe_hash, pseudo, avatar_url,',
    '              email_verifie, token_verification, token_verification_expire,',
    '              token_reinitialisation, token_reinitialisation_expire, cree_le)',
    '',
    'signalements (#id, categorie, commune, description, photos, statut, urgent,',
    '              date_signalement, date_modification, date_resolution,',
    '              latitude, longitude, nb_soutiens, email_contact, photo_resolution,',
    '              token_suppression, #utilisateur_id → utilisateurs)',
    '',
    'soutiens     (#id, #signalement_id → signalements, #utilisateur_id → utilisateurs,',
    '              ip_hash, date_soutien)',
    '',
    'commentaires (#id, #signalement_id → signalements, #utilisateur_id → utilisateurs,',
    '              #parent_id → commentaires, auteur, texte, date_creation)',
    '',
    'mises_a_jour (#id, #signalement_id → signalements, texte, date_creation)',
    '',
    'notifications(#id, #utilisateur_id → utilisateurs, #signalement_id → signalements,',
    '              texte, lue, date_creation)',
    '',
    'signalements_abus (#id, type, cible_id, motif, #utilisateur_id → utilisateurs,',
    '                   date_creation)',
    '',
    'messages_contact  (#id, nom, email, sujet, message, date_envoi, lu)',
    '',
    'admins            (#id, identifiant, mot_de_passe_hash, cree_le)'
  ]),

  titre2('4.2.6  Modèle physique et création de la base'),
  p("Extrait significatif — la table centrale et ses contraintes :"),
  ...code([
    'CREATE TABLE IF NOT EXISTS utilisateurs (',
    '  id                SERIAL PRIMARY KEY,',
    '  nom               TEXT NOT NULL,',
    '  email             TEXT UNIQUE,',
    '  telephone         TEXT UNIQUE,',
    '  mot_de_passe_hash TEXT NOT NULL,',
    '  cree_le           TEXT NOT NULL,',
    '  CONSTRAINT utilisateurs_email_ou_telephone',
    '    CHECK (email IS NOT NULL OR telephone IS NOT NULL)',
    ');'
  ]),
  espace(),
  encadre("La contrainte CHECK traduit directement **RG01** : la base elle-même refuse un compte sans aucun moyen de contact, même si un défaut du code applicatif laissait passer la demande. Le contrôle métier et la contrainte de base se doublent volontairement."),
  p("Deux contraintes d'unicité pour **RG07**, et non une seule :"),
  ...code([
    "-- Empêche deux soutiens depuis la même adresse IP (visiteur non connecté)",
    'UNIQUE (signalement_id, ip_hash)',
    '',
    '-- Empêche deux soutiens du même compte, même depuis deux appareils',
    'CREATE UNIQUE INDEX IF NOT EXISTS soutiens_signalement_utilisateur_uniq',
    '  ON soutiens (signalement_id, utilisateur_id)',
    '  WHERE utilisateur_id IS NOT NULL;'
  ]),
  espace(),
  p("L'index est **partiel** (WHERE utilisateur_id IS NOT NULL) : sans cette condition, plusieurs soutiens anonymes — dont utilisateur_id vaut NULL — seraient considérés comme des doublons dans certains SGBD."),
  p("Le script complet figure en annexe. Il est exécuté automatiquement au démarrage du serveur, de manière idempotente, ce qui rend chaque déploiement autonome."),

  // ---------------------------------------------------------------- 4.3
  titre1("4.3  Réalisation de l'interface utilisateur"),
  titre2('4.3.1  Interfaces statiques'),
  ACOMPLETER('Insérer une capture ordinateur et une capture mobile du même écran, avec une explication courte.'),
  ...[
    "**Structure** : chaque écran est une vue Vue (src/views/), composée de composants réutilisables. Les balises sémantiques (main, header, nav, footer, aside) structurent chaque page.",
    "**Mise en forme** : Bootstrap 5 pour la grille et les formulaires, complété par 21 feuilles de style propres au projet. Les couleurs sont définies une seule fois sous forme de variables CSS.",
    "**Responsive** : grille Bootstrap, plus des points de rupture spécifiques. Vérifié de 360 px à 1900 px : aucune page ne provoque de défilement horizontal.",
    "**Composants réutilisables** : SignalementCard, PanneauAide, ChampMotDePasse (avec l'œil afficher/masquer), JaugeMotDePasse, StatutSuivi, PhotoDropzone, LocationPicker, ClocheNotifications.",
    "**Accessibilité** : aria-label sur toutes les icônes de navigation, role=status sur les messages d'attente, contrastes mesurés (le texte secondaire du pied de page a été éclairci après mesure : il tombait à 2,6 alors que le seuil recommandé est 4,5 ; il est passé à 6,5)."
  ].map(puce),

  titre2('4.3.2  Interfaces dynamiques'),
  titre3("Exemple : l'accueil"),
  p("Au montage de HomeView, rafraichir() appelle l'action charger() du store Pinia, qui interroge GET /api/signalements. Les données reçues sont placées dans l'état du store ; la liste se redessine automatiquement. Un observateur (watch) surveille les filtres : toute modification relance la requête avec les nouveaux paramètres et met l'URL à jour, ce qui rend une recherche filtrée partageable par lien."),
  titre3('Exemple : la détection de doublons'),
  p("Sur l'écran de dépôt, un observateur surveille la catégorie et la position. À chaque changement, après un délai de 400 ms — pour ne pas interroger le serveur à chaque frappe — une requête cherche les signalements similaires. S'il en existe, un encart propose de soutenir l'existant plutôt que d'en créer un nouveau. **L'envoi n'est jamais bloqué** : c'est une proposition, pas un refus."),
  p("**Gestion des formulaires** : v-model pour la liaison, et une propriété calculée erreurs qui recalcule en permanence la validité de chaque champ. Les messages ne s'affichent qu'après une première tentative d'envoi, sauf pour le téléphone et le mot de passe où le retour est immédiat car il aide à la saisie."),
  p("**Navigation** : Vue Router, avec une garde beforeEach qui protège les routes exigeant un compte et mémorise la page demandée pour y revenir après connexion."),

  // ---------------------------------------------------------------- 4.4
  titre1('4.4  Développement du back-end'),
  titre2("4.4.1  Présentation de l'API REST"),
  p("L'API compte **42 routes**. Les plus représentatives :"),
  tableau(
    ['Méthode', 'Route', 'Fonction', 'Accès'],
    [
      ['GET', '/api/signalements', 'Lister avec filtres, tri et pagination', 'Public'],
      ['GET', '/api/signalements/:id', 'Consulter un signalement et ses commentaires', 'Public'],
      ['GET', '/api/signalements/similaires', 'Chercher les doublons potentiels', 'Public'],
      ['GET', '/api/signalements/stats-publiques', 'Statistiques de transparence', 'Public'],
      ['POST', '/api/signalements', 'Créer un signalement avec photos', 'Citoyen'],
      ['PUT', '/api/signalements/:id', 'Corriger son signalement', 'Auteur'],
      ['DELETE', '/api/signalements/:id', 'Supprimer son signalement', 'Auteur / admin'],
      ['PATCH', '/api/signalements/:id', 'Changer le statut', 'Admin'],
      ['POST', '/api/signalements/:id/soutenir', 'Soutenir', 'Citoyen'],
      ['POST', '/api/signalements/:id/commentaires', 'Commenter ou répondre', 'Citoyen'],
      ['POST', '/api/auth/inscription', 'Créer un compte', 'Public'],
      ['POST', '/api/auth/connexion', 'Se connecter', 'Public'],
      ['POST', '/api/auth/verifier-email', 'Valider le code à 6 chiffres', 'Citoyen'],
      ['GET', '/api/notifications', 'Consulter ses notifications', 'Citoyen'],
      ['GET', '/api/signalements/export.csv', 'Exporter les données', 'Admin']
    ],
    [0.11, 0.34, 0.38, 0.17]
  ),
  espace(),
  p("La documentation complète des 42 routes figure en annexe.", { italics: true }),

  titre2('4.4.2  Routes'),
  p("Chaque routeur associe une méthode HTTP et un chemin à une fonction de traitement. La chaîne de middlewares se lit dans la déclaration elle-même :"),
  ...code([
    "router.post('/signalements/:id/commentaires',",
    '  requireAuthUtilisateur,   // 1. vérifie la session',
    '  limiteurCommentaire,      // 2. limite le débit',
    '  async (req, res) => { … })'
  ]),
  espace(),
  encadre("L'ordre compte : inutile de compter dans le quota de débit une requête qui va de toute façon être rejetée faute d'authentification."),

  titre2('4.4.3  Traitement d\'une requête — exemple commenté'),
  p("Création d'un commentaire, étape par étape :"),
  ...[
    "**Identité imposée par le serveur.** L'auteur affiché est lu depuis le compte connecté, jamais depuis le corps de la requête. Un utilisateur ne peut donc pas se faire passer pour quelqu'un d'autre en modifiant les données envoyées.",
    "**Application de RG12.** Le pseudo est utilisé s'il existe ; sinon le nom réel est abrégé par nomPublic().",
    "**Validation.** Longueur du texte entre 3 et 1000 caractères, sinon réponse 400 avec un message en français.",
    "**Vérification du signalement.** S'il n'existe pas, réponse 404.",
    "**Application de RG11.** Si la requête répond à un commentaire, on vérifie qu'il appartient bien à CE signalement — sinon une réponse pourrait être rattachée au fil d'un autre signalement — puis on la rattache au commentaire racine.",
    "**Insertion** par requête paramétrée.",
    "**Notifications.** L'auteur du signalement, puis l'auteur du commentaire parent, sont prévenus — sauf s'il s'agit de la personne qui vient d'écrire.",
    "**Réponse 201** avec le commentaire créé, tel qu'il doit être affiché."
  ].map(puce),
  espace(80),
  encadre("Le point 5 illustre ce qui distingue un contrôle métier d'une simple validation de format : rien dans le type de la donnée n'est incorrect, c'est la **cohérence entre deux entités** qui est vérifiée."),

  titre2('4.4.4  Accès aux données'),
  ...[
    "**Connexion** : un pool pg unique, partagé par tout le serveur, ouvert dans db.js.",
    "**Requêtes paramétrées, sans exception** : les valeurs passent par $1, $2… et ne sont jamais concaténées dans la chaîne SQL."
  ].map(puce),
  ...code([
    'const { rows } = await db.query(',
    "  'SELECT * FROM utilisateurs WHERE LOWER(email) = $1 OR telephone = ANY($2::text[])',",
    '  [valeur, numeros]',
    ')'
  ]),
  espace(),
  p("**Cas particulier assumé** : la liste des signalements construit dynamiquement sa clause WHERE selon les filtres actifs. La chaîne assemblée ne contient **que des marqueurs** $1, $2… — jamais de valeur saisie par l'utilisateur. De même, le tri est choisi dans une liste blanche : la valeur reçue de l'URL n'entre jamais dans le SQL."),
  ...code([
    'const TRIS = {',
    "  recent:    'date_signalement DESC',",
    "  ancien:    'date_signalement ASC',",
    "  populaire: 'nb_soutiens DESC, date_signalement DESC'",
    '}',
    'const ordre = `urgent DESC, ${TRIS[tri] || TRIS.recent}`'
  ]),
  espace(),
  p("**Retour au traitement** : rows pour les lectures, rowCount pour savoir si une suppression a réellement porté (et répondre 404 sinon), RETURNING * pour renvoyer la ligne créée ou modifiée sans seconde requête."),

  titre2('4.4.5  Services et traitements métier'),
  tableau(
    ['Règle', 'Traitement réalisé', 'Emplacement'],
    [
      ['RG03', 'Normalisation du numéro avant enregistrement et avant recherche', 'shared/telephone.js + server/auth.js'],
      ['RG04', 'Refus des mots de passe trop courts ou trop courants, puis hachage', 'shared/motDePasse.js + server/auth.js'],
      ['RG07', "Insertion du soutien, interception du conflit d'unicité, incrément du compteur", 'routes/signalements.js'],
      ['RG08', "Décision d'autorisation selon le rôle et le statut", 'estAutoriseAModifier, routes/signalements.js'],
      ['RG11', 'Rattachement d\'une réponse au commentaire racine du bon signalement', 'routes/signalements.js'],
      ['RG12', 'Abréviation du nom public', 'shared/nomPublic.js'],
      ['RG13', 'Recherche géographique des doublons', 'routes/signalements.js'],
      ['RG15', "Analyse du contenu puis réencodage de l'image", 'moderation.js, photoUpload.js'],
      ['—', "Choix du destinataire d'une notification email : adresse de contact, sinon adresse du compte si elle est vérifiée", 'emailSuiviSignalement, routes/signalements.js']
    ],
    [0.09, 0.53, 0.38]
  ),
  espace(),
  encadre("Le dernier point mérite explication : écrire à une adresse de compte non vérifiée reviendrait à envoyer les nouvelles d'un signalement à une personne qui n'a jamais confirmé être propriétaire de cette adresse — donc, potentiellement, à un tiers."),

  // ---------------------------------------------------------------- 4.5
  titre1("4.5  Sécurité de l'application"),
  titre2('Mesures mises en œuvre'),
  tableau(
    ['Mesure', 'Mise en œuvre'],
    [
      ['Mots de passe', 'bcrypt, 12 tours. Jamais stockés ni journalisés en clair.'],
      ['Comparaison à temps constant', "Lorsqu'un identifiant n'existe pas, une comparaison bcrypt factice est quand même exécutée, pour que la durée de réponse ne révèle pas l'existence d'un compte."],
      ['Authentification', 'Jeton aléatoire de 32 octets, session en mémoire serveur avec expiration à 12 h et purge horaire des sessions expirées.'],
      ['Autorisation', 'Deux middlewares distincts : requireAuth (administrateur) et requireAuthUtilisateur (citoyen ou admin). Le routeur d\'administration est protégé globalement.'],
      ['Injections SQL', 'Requêtes paramétrées partout ; tri choisi dans une liste blanche.'],
      ['En-têtes HTTP', "helmet : HSTS, X-Content-Type-Options nosniff, frame-ancestors, politique de sécurité du contenu avec script-src 'self' — aucun script tiers autorisé."],
      ['Limitation de débit', '13 limiteurs distincts : connexion (10 / 15 min), inscription (10 / h), création de signalement (5 / h), code de vérification, réinitialisation, commentaires, contact, modération…'],
      ['Fichiers envoyés', "Liste blanche d'extensions (SVG exclu, car il peut contenir du script), taille limitée, réencodage systématique par sharp, analyse automatique du contenu."],
      ['Vie privée', "Métadonnées EXIF supprimées, dont la position GPS que les téléphones inscrivent dans les photos. Identité jamais exposée publiquement."],
      ['Secrets', "Uniquement en variables d'environnement, jamais versionnés. Vérifié : aucun secret présent dans le code envoyé au navigateur."],
      ['Erreurs', "Un gestionnaire global renvoie un message générique ; aucune trace d'exécution n'atteint le client."],
      ['CSRF', "Sans objet : la session repose sur un jeton porté par l'en-tête Authorization, et non sur un cookie envoyé automatiquement par le navigateur."]
    ],
    [0.26, 0.74]
  ),

  titre2('Vérification par sondes'),
  p("Ces mesures ont été éprouvées par des requêtes volontairement hostiles :"),
  tableau(
    ['Test', 'Résultat'],
    [
      ['7 routes protégées appelées sans jeton', '401 sur les 7'],
      ["Route d'administration avec un jeton fabriqué", '401'],
      ["' OR 1=1--  et  '; DROP TABLE signalements;--  dans la recherche", '0 résultat, table intacte'],
      ['Tri forgé  id; DROP TABLE signalements', 'Ignoré, tri par défaut appliqué'],
      ['Fichiers HTML, SVG et PHP déguisés en image', "Aucun n'est stocké"],
      ["Un compte tentant d'agir sur le contenu d'un autre", '403 / 401'],
      ['Champs exposés par la liste publique', "Aucune donnée d'identité"]
    ],
    [0.55, 0.45]
  ),
  espace(),
  encadre("Un audit des dépendances (npm audit) a révélé **trois vulnérabilités**, dont deux de gravité haute situées précisément sur le chemin d'envoi des photos — donc atteignables sans compte : multer (contournement de la limite de taille, plusieurs dénis de service) et sharp (failles de la bibliothèque libheif). Elles ont été corrigées, et l'envoi de photos a été retesté après la montée de version.", 'C00000'),

  // ---------------------------------------------------------------- 4.6
  titre1('4.6  Tests et validation'),
  titre2('Jeu d\'essai — règles métier'),
  tableau(
    ['Cas testé', 'Entrée / situation', 'Résultat attendu', 'Obtenu'],
    [
      ['Inscription valide', 'Nom, téléphone, mot de passe solide', '201 + jeton de session', 'Conforme'],
      ['Mot de passe trop courant', '12345678', '400, message explicite', 'Conforme'],
      ['Téléphone invalide', '12345', '400', 'Conforme'],
      ['Connexion avec numéro espacé', '06 39 53 97 90', '200 (RG03)', 'Conforme'],
      ['Catégorie inventée', 'categorie=Licorne', '400', 'Conforme'],
      ['Description trop courte', '3 caractères', '400', 'Conforme'],
      ['Signalement inexistant', 'GET /api/signalements/99999', '404', 'Conforme'],
      ['Second soutien', 'Même compte, même signalement', '409 (RG07)', 'Conforme'],
      ['Modification par un tiers', 'Compte B modifie le signalement de A', '403 (RG09)', 'Conforme'],
      ['Modification après prise en charge', 'Statut « En cours »', '403 (RG08)', 'Conforme'],
      ['Nom public', 'Compte « Zakaria Bacar » commente', 'Affiche « Zakaria B. » (RG12)', 'Conforme'],
      ['Doublon proche', 'Même catégorie, 200 m', 'Proposé (RG13)', 'Conforme'],
      ['Doublon lointain', 'Même catégorie, 5 km', 'Non proposé', 'Conforme'],
      ['Urgence et tri', 'Tri « plus anciens »', "L'urgent reste en tête (RG14)", 'Conforme']
    ],
    [0.26, 0.29, 0.3, 0.15]
  ),

  titre2('Tests automatisés'),
  ...[
    "**API** : node --test, 12 cas couvrant l'authentification, la protection des routes, la réinitialisation de mot de passe et le cycle de vie complet d'un signalement.",
    "**Parcours utilisateur** : Playwright pilote un vrai navigateur sur le site compilé — création d'un signalement avec photo et géolocalisation, affichage sur la carte, suppression par son créateur, protection de l'espace d'administration.",
    "**Garde-fou** : les tests refusent de démarrer si TEST_DATABASE_URL est absente ou identique à DATABASE_URL. Cette protection a été ajoutée après l'incident décrit en 4.8."
  ].map(puce),
  espace(80),
  encadre("**État réel de la suite automatisée, assumé devant le jury.** Elle ne s'exécute pas aujourd'hui, pour deux raisons distinctes : la base de test séparée n'a pas encore été créée, et le test de parcours décrit un fonctionnement antérieur (dépôt d'un signalement sans compte) que l'application n'autorise plus depuis l'ajout de l'authentification obligatoire. Il doit donc être réécrit avant de pouvoir servir de non-régression. En attendant, chaque évolution est vérifiée manuellement selon le jeu d'essai ci-dessus, avec un compte jetable supprimé après usage.", 'C00000'),

  titre2('Tests manuels systématiques'),
  p("Chaque évolution a été vérifiée dans un navigateur piloté, à 1440 px et 390 px, sur l'ensemble des pages publiques : absence de débordement horizontal, absence d'erreur dans la console, et éléments d'interface non recouverts."),

  // ---------------------------------------------------------------- 4.7
  titre1('4.7  Déploiement'),
  titre2('Front-end et API'),
  p("Le front compilé et l'API sont servis par **un seul service Node.js** hébergé sur Render. Ce choix simplifie le déploiement et supprime toute configuration CORS."),
  ...[
    '**Build** : npm install && npm run build',
    '**Démarrage** : npm start',
    '**Port** : lu depuis la variable PORT'
  ].map(puce),

  titre2('Base de données'),
  p("Projet PostgreSQL managé sur Supabase. Aucun import manuel n'est nécessaire : le schéma est créé et mis à jour au démarrage du serveur. Une nouvelle colonne se déploie donc par un simple git push."),

  titre2("Variables d'environnement"),
  p("Renseignées dans l'interface Render, jamais dans le dépôt :"),
  tableau(
    ['Variable', 'Rôle'],
    [
      ['DATABASE_URL', 'Connexion PostgreSQL'],
      ['SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', 'Stockage des photos'],
      ['BREVO_API_KEY, BREVO_EXPEDITEUR', 'Envoi des emails'],
      ['ADMIN_IDENTIFIANT, ADMIN_MOT_DE_PASSE', 'Création du premier compte administrateur'],
      ['SITE_URL', 'Construction des liens dans les emails'],
      ['VITE_MAPTILER_KEY', 'Tuiles de la carte']
    ],
    [0.42, 0.58]
  ),

  titre2('Procédure de redéploiement'),
  ...[
    'git push origin main',
    'Render détecte le commit, exécute le build puis relance le service.',
    "Vérification : comparer l'empreinte des fichiers servis en ligne à celle du build local, puis contrôler la console du navigateur."
  ].map(puce),
  espace(80),
  encadre("Point d'attention documenté : les sessions étant conservées en mémoire du serveur, chaque déploiement déconnecte les utilisateurs. Un stockage des sessions en base lèverait cette limite — c'est une évolution identifiée."),

  // ---------------------------------------------------------------- 4.8
  titre1('4.8  Difficultés rencontrées et solutions apportées'),

  titre2('1.  Les emails de vérification ne partaient pas'),
  p("**Problème.** Un utilisateur s'inscrit, attend son code de confirmation, ne reçoit rien. Aucune erreur visible dans l'application."),
  p("**Diagnostic.** Les journaux du serveur montraient une erreur ENETUNREACH vers le serveur SMTP. Render bloque les connexions SMTP sortantes : l'envoi échouait en silence. Le passage à un premier fournisseur par API HTTPS n'a pas suffi — un appel direct à son API a renvoyé un **403** révélant que, sans nom de domaine vérifié, ce service refuse tout destinataire autre que le propriétaire du compte."),
  p("**Solution.** Migration vers Brevo, qui n'exige qu'une adresse d'expédition validée. Le module mailer.js choisit le fournisseur disponible, ce qui a permis de changer deux fois de service sans modifier une seule route."),
  p("**Résultat.** Les codes de vérification arrivent. Cette difficulté a aussi motivé la mise en place de **notifications dans le site**, indépendantes de l'email : seule une petite partie des comptes possède une adresse vérifiée, et l'email seul laissait la majorité des utilisateurs sans aucune information."),

  titre2('2.  Perte de données de production par les tests'),
  p("**Problème.** L'exécution de la suite de tests a vidé la table des signalements de production."),
  p("**Diagnostic.** Les tests appelaient une fonction de réinitialisation contenant un TRUNCATE, et le projet ne possédait **qu'une seule** variable DATABASE_URL : les tests s'exécutaient donc sur la base réelle."),
  p("**Solution.** Les tests exigent désormais une variable TEST_DATABASE_URL distincte, et refusent de démarrer si elle est absente ou identique à celle de production."),
  p("**Résultat.** L'erreur ne peut plus se reproduire. Le coût est assumé et documenté : tant qu'une seconde base n'est pas créée, la suite automatisée ne peut pas s'exécuter, et les vérifications se font manuellement sur un compte jetable supprimé ensuite."),
  p("**Prolongement.** En rédigeant ce dossier, j'ai relu la protection et constaté qu'elle n'avait été posée que sur **la moitié** des tests : le test de parcours appelait lui aussi la fonction de réinitialisation sans aucune garde. Le même incident pouvait donc se reproduire par un autre chemin. La protection y a été ajoutée."),
  encadre("**Ce que cela m'a appris** : une fonction destructrice ne doit pas être atteignable depuis un environnement de test sans une barrière explicite — et une barrière posée doit être vérifiée sur **tous** les chemins qui mènent à la fonction, pas seulement sur celui par lequel l'incident est arrivé.", 'C00000'),

  titre2('3.  Le globe 3D disparaissait par intermittence'),
  p("**Problème.** L'élément décoratif de fond apparaissait ou non, sans cause apparente."),
  p("**Diagnostic.** Deux causes distinctes. D'abord, une optimisation consistant à ne pas charger le globe sur connexion lente s'appuyait sur navigator.connection.effectiveType — or cette valeur n'est pas le type de réseau mais une **estimation glissante du débit**, qui retombe fréquemment à « 3g » sur une connexion parfaitement utilisable. Ensuite, après une perte du contexte WebGL (fréquente sur mobile), le globe ne revenait jamais : le code attendait un événement de restauration qui n'arrive pas toujours."),
  p("**Solution.** Le seuil ne retient plus que les signaux fiables. Pour la reprise, un test a montré qu'il ne suffisait pas de reconstruire le rendu : un canvas dont le contexte est perdu renvoie toujours le même contexte mort. Il faut **remplacer l'élément canvas**, ce que fait désormais une clé Vue."),
  p("**Résultat.** Mesuré image par image : perte de contexte, retour d'arrière-plan et connexion annoncée en 3G affichent de nouveau le globe."),

  titre2('4.  « Impossible de contacter le serveur » au premier chargement'),
  p("**Problème.** Un message d'erreur s'affichait régulièrement sur la page d'accueil."),
  p("**Diagnostic.** L'offre gratuite de l'hébergeur met le serveur en veille après un quart d'heure sans visite. Le premier visiteur le réveille, ce qui prend jusqu'à une minute — et la fonction d'appel à l'API ne faisait **qu'un seul essai**."),
  p("**Solution.** Les lectures sont désormais rejouées automatiquement, quatre fois, avec un délai croissant. Les **écritures ne le sont jamais** : après une coupure, il est impossible de savoir si le serveur avait enregistré avant de perdre la connexion, et rejouer créerait un doublon de signalement ou de commentaire. Un bandeau informe que le serveur redémarre, et un bouton « Réessayer » laisse la décision à l'utilisateur."),
  p("**Résultat.** Vérifié en simulant deux réponses 503 consécutives : la page se charge sans erreur. Une requête d'écriture sur réseau coupé ne produit qu'un seul appel."),

  titre2('5.  Le tri « Plus anciens » renvoyait une erreur serveur'),
  p("**Problème.** Détecté en testant, non signalé par un utilisateur."),
  p("**Diagnostic.** La construction de la clause de tri produisait ORDER BY ASC ASC, syntaxiquement invalide. Confirmé en exécutant la requête directement sur la base."),
  p("**Solution.** Remplacement par une liste blanche associant chaque tri à sa clause SQL complète — ce qui corrige le défaut **et** supprime toute possibilité d'injection par ce paramètre."),

  titre2('6.  Les photos de profil pointaient vers des fichiers absents'),
  p("**Problème.** Les photos de profil affichaient une icône d'image brisée."),
  p("**Diagnostic.** Les requêtes vers le stockage renvoyaient 400. La fonction de réinitialisation des données de démonstration vidait **la totalité** de l'espace de stockage, où les photos de profil voisinent avec celles des signalements. Cette fonction se déclenche aussi automatiquement au démarrage si la table des signalements est vide : le piège était encore armé."),
  p("**Solution.** La fonction reçoit désormais la liste des photos de profil à préserver. En complément, une image illisible retombe sur l'initiale de l'utilisateur au lieu d'afficher une icône brisée."),

  // ---------------------------------------------------------------- 4.9
  titre1('4.9  Bilan des réalisations'),
  tableau(
    ['Fonctionnalité / réalisation', 'État'],
    [
      ['Authentification citoyenne (email ou téléphone)', 'Fonctionnelle'],
      ["Vérification d'email par code à 6 chiffres", 'Fonctionnelle'],
      ['Réinitialisation de mot de passe', 'Fonctionnelle'],
      ['Profil : pseudo, photo, statistiques', 'Fonctionnelle'],
      ['Dépôt de signalement avec photos et géolocalisation', 'Fonctionnelle'],
      ["Correction et suppression par l'auteur", 'Fonctionnelle'],
      ['Signalement urgent prioritaire', 'Fonctionnelle'],
      ['Détection de doublons à proximité', 'Fonctionnelle'],
      ['Recherche, filtres, tri, pagination', 'Fonctionnelle'],
      ['Carte interactive', 'Fonctionnelle'],
      ['Soutiens', 'Fonctionnelle'],
      ['Commentaires et réponses', 'Fonctionnelle'],
      ['Notifications dans le site', 'Fonctionnelle'],
      ['Notifications par email', 'Fonctionnelle'],
      ['Modération automatique des photos', 'Fonctionnelle'],
      ['Signalement de contenu par les utilisateurs', 'Fonctionnelle'],
      ["Espace d'administration", 'Fonctionnel'],
      ['Export CSV', 'Fonctionnel'],
      ['Statistiques publiques', 'Fonctionnelles'],
      ['Remplissage automatique de la commune', 'Hors périmètre'],
      ['Notifications SMS', 'Hors périmètre'],
      ['Comptes « agent municipal » avec rôles dédiés', 'Évolution future']
    ],
    [0.68, 0.32]
  ),

  titre2('Objectifs atteints'),
  p("L'application répond au besoin initial : un habitant peut signaler un problème du quotidien en moins de deux minutes, avec une photo et une localisation précise, et suivre publiquement son traitement. Le bon service compétent est indiqué automatiquement selon la catégorie. L'identité des contributeurs reste protégée, condition nécessaire pour que les gens osent signaler."),

  titre2('Limites de la version actuelle'),
  ...[
    "L'hébergement gratuit met le serveur en veille : le premier visiteur après une période creuse attend le réveil. La reprise automatique masque le problème sans le supprimer.",
    'Les sessions sont conservées en mémoire : chaque déploiement déconnecte les utilisateurs.',
    "La suite de tests automatisés est à l'arrêt : elle attend une seconde base de données, et le test de parcours doit être réécrit pour tenir compte de l'authentification devenue obligatoire.",
    'Aucun rôle intermédiaire entre citoyen et administrateur.'
  ].map(puce),

  titre2('Évolutions possibles'),
  ...[
    'Sessions persistées en base, pour survivre aux redéploiements.',
    "Rôle « agent municipal » avec un tableau de bord filtré par commune.",
    'Fond de carte permettant le géocodage inverse, pour déduire la commune de la position.',
    'Notifications par navigateur, alternative gratuite au SMS.',
    'Ouverture des données en lecture (API publique) pour les associations et les collectivités.'
  ].map(puce),

  titre1('Annexes'),
  ...[
    '**A1** — Script SQL complet de création de la base',
    "**A2** — Documentation des 42 routes de l'API",
    '**A3** — Dictionnaire de données complet des 9 tables',
    "**A4** — Captures d'écran commentées  [À COMPLÉTER]",
    '**A5** — Maquettes  [À COMPLÉTER]'
  ].map(puce)
]

ecrire('DWWM - Partie 4 - Realisations.docx', document(enfants))
