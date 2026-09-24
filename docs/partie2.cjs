const S = require('./generer-docx.cjs')
const { titre1, titre2, titre3, p, puce, encadre, tableau, espace, pageDeGarde, document, ecrire } = S

const enfants = [
  ...pageDeGarde('2', 'Cahier des charges'),

  titre1('2.1  Identification des utilisateurs et de leurs rôles'),
  tableau(
    ['Acteur', "Rôle dans l'application"],
    [
      ['Visiteur', 'Consulte les signalements, la carte et les statistiques publiques sans créer de compte. Ne peut ni signaler ni commenter.'],
      ['Citoyen inscrit', 'Crée un compte, envoie des signalements, suit leur avancement, soutient et commente ceux des autres, gère son profil.'],
      ['Administrateur', "Modère les contenus, fait évoluer le statut des signalements, publie des mises à jour officielles, consulte les messages de contact et les signalements d'abus, exporte les données."]
    ],
    [0.22, 0.78]
  ),
  espace(),
  encadre("Le choix de laisser la consultation totalement ouverte est volontaire : la plateforme n'a d'utilité que si les problèmes signalés sont **visibles de tous**, y compris des services communaux, sans obliger qui que ce soit à s'inscrire."),

  titre1('2.2  Fonctionnalités principales'),
  ...[
    'Authentification et gestion de compte citoyen',
    "Dépôt et suivi d'un signalement",
    'Consultation et recherche des signalements',
    'Cartographie des signalements',
    'Participation citoyenne (soutiens, commentaires, réponses)',
    'Notifications',
    'Modération et administration',
    'Transparence publique (statistiques)'
  ].map(puce),

  titre1('2.3  Besoins fonctionnels détaillés'),
  titre2('Authentification et compte'),
  tableau(
    ['Réf.', 'Besoin'],
    [
      ['BF01', 'Le visiteur doit pouvoir créer un compte avec un email ou un numéro de téléphone.'],
      ['BF02', 'Le citoyen doit pouvoir se connecter avec son email ou son téléphone et son mot de passe.'],
      ['BF03', "Le citoyen doit pouvoir confirmer son adresse email à l'aide d'un code reçu par email."],
      ['BF04', 'Le citoyen doit pouvoir demander la réinitialisation de son mot de passe et en choisir un nouveau.'],
      ['BF05', 'Le citoyen doit pouvoir choisir un pseudo public et une photo de profil.'],
      ['BF06', 'Le citoyen doit pouvoir se déconnecter.']
    ],
    [0.1, 0.9]
  ),

  titre2('Signalements'),
  tableau(
    ['Réf.', 'Besoin'],
    [
      ['BF07', "Le citoyen doit pouvoir envoyer un signalement avec une catégorie, une commune, une description, une localisation sur la carte et jusqu'à 5 photos."],
      ['BF08', 'Le citoyen doit pouvoir marquer son signalement comme urgent en cas de danger immédiat.'],
      ['BF09', "Le citoyen doit pouvoir corriger son signalement tant qu'il n'est pas pris en charge."],
      ['BF10', "Le citoyen doit pouvoir supprimer un signalement qu'il a créé."],
      ['BF11', 'Le visiteur doit pouvoir consulter la liste des signalements et le détail de chacun.'],
      ['BF12', 'Le visiteur doit pouvoir filtrer les signalements par commune, catégorie, statut et urgence, et les trier.'],
      ['BF13', 'Le visiteur doit pouvoir rechercher un signalement par mot-clé.'],
      ['BF14', 'Le visiteur doit pouvoir visualiser les signalements localisés sur une carte.'],
      ['BF15', "Le citoyen doit être averti, au moment de la saisie, qu'un problème similaire a déjà été signalé à proximité."]
    ],
    [0.1, 0.9]
  ),

  titre2('Participation et suivi'),
  tableau(
    ['Réf.', 'Besoin'],
    [
      ['BF16', 'Le citoyen doit pouvoir soutenir un signalement existant.'],
      ['BF17', 'Le citoyen doit pouvoir commenter un signalement et répondre à un commentaire.'],
      ['BF18', 'Le citoyen doit pouvoir supprimer ses propres commentaires.'],
      ['BF19', "L'auteur d'un signalement doit être notifié lorsque son statut change ou qu'une personne réagit."],
      ['BF20', 'Le citoyen doit pouvoir consulter ses notifications dans le site.'],
      ['BF21', 'Le citoyen doit pouvoir signaler un contenu inapproprié aux administrateurs.']
    ],
    [0.1, 0.9]
  ),

  titre2('Administration'),
  tableau(
    ['Réf.', 'Besoin'],
    [
      ['BF22', "L'administrateur doit pouvoir faire évoluer le statut d'un signalement (Signalé → En cours → Résolu)."],
      ['BF23', "L'administrateur doit pouvoir joindre une photo de résolution."],
      ['BF24', "L'administrateur doit pouvoir publier une mise à jour publique sur un signalement."],
      ['BF25', "L'administrateur doit pouvoir supprimer un signalement ou un commentaire."],
      ['BF26', "L'administrateur doit pouvoir consulter les contenus signalés comme inappropriés."],
      ['BF27', "L'administrateur doit pouvoir consulter les messages envoyés via le formulaire de contact."],
      ['BF28', "L'administrateur doit pouvoir exporter les signalements au format CSV."],
      ['BF29', "L'administrateur doit pouvoir créer et supprimer d'autres comptes administrateurs."]
    ],
    [0.1, 0.9]
  ),

  titre1('2.4  Besoins non fonctionnels'),
  tableau(
    ['Réf.', 'Besoin'],
    [
      ['BNF01', "L'interface doit rester utilisable de 360 px de large jusqu'au grand écran, sans défilement horizontal."],
      ['BNF02', "Les fonctionnalités d'écriture doivent être protégées par authentification, et les fonctions d'administration par une autorisation distincte."],
      ['BNF03', 'Les données des formulaires doivent être contrôlées côté client ET côté serveur avant enregistrement.'],
      ['BNF04', "L'identité réelle d'un contributeur ne doit jamais être affichée publiquement."],
      ['BNF05', 'Les mots de passe ne doivent jamais être stockés ni transmis en clair.'],
      ['BNF06', 'Le poids des pages doit rester contenu : le public cible se connecte souvent en mobile avec un forfait limité.'],
      ['BNF07', "L'application doit rester compréhensible lorsque le serveur est indisponible : messages clairs, reprise automatique."],
      ['BNF08', 'Les contenus envoyés par les utilisateurs (photos) doivent être filtrés avant publication.'],
      ['BNF09', "L'application doit fonctionner sur les navigateurs récents (Chrome, Firefox, Safari, Edge)."]
    ],
    [0.12, 0.88]
  ),

  titre1('2.5  Contraintes du projet'),
  titre3('Contraintes réellement imposées'),
  ...[
    'Application accessible depuis un navigateur, sans installation.',
    'Base de données relationnelle.',
    'Respect de la protection des données personnelles (RGPD) : la plateforme collecte nom, email et/ou téléphone.',
    "Hébergement gratuit : aucun budget n'était alloué au projet.",
    'Délai : projet fil rouge mené en parallèle de la formation.'
  ].map(puce),
  espace(80),
  titre3('Choix techniques du candidat'),
  encadre("Vue.js, Express, PostgreSQL, Supabase, Render, Bootstrap et Leaflet **n'ont été imposés par personne**. Ce ne sont donc pas des contraintes, mais des décisions justifiées en partie 3."),

  titre1('2.6  Périmètre fonctionnel'),
  titre3('Inclus dans la version présentée'),
  p("Authentification citoyenne, dépôt et suivi de signalements avec photos et géolocalisation, détection de doublons, carte, filtres et recherche, soutiens, commentaires et réponses, notifications dans le site et par email, modération d'abus, espace d'administration, statistiques publiques, export CSV."),
  espace(80),
  titre3('Hors périmètre'),
  tableau(
    ['Fonctionnalité', 'Raison'],
    [
      ['Notifications SMS', 'Coût par message, incompatible avec un budget nul.'],
      ['Application mobile native', 'Le site responsive couvre le besoin.'],
      ['Rôles dédiés pour les services communaux', 'Nécessite un partenariat institutionnel non établi à ce stade.'],
      ['Remplissage automatique de la commune', "La clé cartographique gratuite utilisée ne donne pas accès au géocodage inverse."],
      ['Paiement en ligne', 'Sans objet : le service est gratuit.']
    ],
    [0.38, 0.62]
  ),
  espace(),
  encadre("Le hors périmètre évite de faire passer une fonctionnalité non prévue pour une fonctionnalité oubliée.", S.BLEU)
]

ecrire('DWWM - Partie 2 - Cahier des charges.docx', document(enfants))
