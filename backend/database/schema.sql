-- Schéma de la base MariaDB de Signale Mayotte.
--
-- Exécuté par l'API à chaque démarrage (src/config/db.js) : chaque table n'est créée que si
-- elle n'existe pas encore, une base vide arrive donc seule au bon état. On peut aussi
-- l'exécuter à la main, par exemple dans DBeaver, sur une base vide.
--
-- InnoDB pour les clés étrangères et les transactions, utf8mb4 pour les accents et emojis.
--
-- Les dates « métier » (date_signalement, cree_le…) sont des chaînes ISO 8601
-- (2026-11-15T21:00:00.000Z) : c'est le format renvoyé tel quel à l'API, et il se trie
-- correctement par ordre alphabétique. Les dates d'expiration des codes, comparées à
-- l'heure actuelle par la base, sont de vrais DATETIME en UTC.
--
-- Les jetons (vérification, réinitialisation, suppression) sont en collation binaire :
-- sans elle, MariaDB les comparerait sans tenir compte des majuscules, ce qui affaiblirait
-- des valeurs qui doivent être devinées exactement.
--
-- Attention : une instruction se termine par un point-virgule en fin de ligne, et les
-- commentaires n'en contiennent jamais (db.js découpe le fichier ainsi).

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  pseudo VARCHAR(255) NULL,
  email VARCHAR(255) NULL UNIQUE,
  telephone VARCHAR(20) NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  email_verifie BOOLEAN NOT NULL DEFAULT FALSE,
  token_verification VARCHAR(128) COLLATE utf8mb4_bin NULL,
  token_verification_expire DATETIME NULL,
  token_reinitialisation VARCHAR(128) COLLATE utf8mb4_bin NULL,
  token_reinitialisation_expire DATETIME NULL,
  avatar_url VARCHAR(500) NULL,
  cree_le VARCHAR(30) NOT NULL,
  -- Sert à effacer les comptes inactifs depuis trop longtemps (voir retentionService.js).
  derniere_connexion VARCHAR(30) NULL,
  CONSTRAINT utilisateurs_email_ou_telephone CHECK (email IS NOT NULL OR telephone IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Double authentification des admins (code à 6 chiffres d'une appli) : un mot de passe
-- admin volé ne suffit plus à ouvrir la modération, l'export et la gestion des comptes.
-- totp_secret_attente : secret proposé, pas encore confirmé par un premier code.
-- totp_dernier_pas : dernier code accepté, pour qu'il ne puisse pas être rejoué.
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identifiant VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  totp_secret VARCHAR(64) NULL,
  totp_secret_attente VARCHAR(64) NULL,
  totp_dernier_pas BIGINT NULL,
  cree_le VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comptes partenaires : agents municipaux ou services techniques désignés par
-- l'association pour faire évoluer le statut des signalements de leur périmètre. Une
-- table séparée des admins, car ce sont des droits différents (pas de modération, pas de
-- gestion des comptes, pas d'export), gérés par l'admin.
-- commune NULL = toute l'île, categories vide = tous les domaines.
CREATE TABLE IF NOT EXISTS partenaires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  identifiant VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  commune VARCHAR(100) NULL,
  categories JSON NOT NULL DEFAULT ('[]'),
  email VARCHAR(255) NULL,
  cree_le VARCHAR(30) NOT NULL,
  derniere_connexion VARCHAR(30) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Signalement urgent : un simple drapeau plutôt qu'un circuit séparé, pour que le danger
-- immédiat (fil électrique à terre, fuite, route coupée) remonte en tête de liste.
CREATE TABLE IF NOT EXISTS signalements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categorie VARCHAR(100) NOT NULL,
  commune VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  photos JSON NOT NULL DEFAULT ('[]'),
  statut VARCHAR(20) NOT NULL DEFAULT 'Signalé',
  urgent BOOLEAN NOT NULL DEFAULT FALSE,
  date_signalement VARCHAR(30) NOT NULL,
  date_modification VARCHAR(30) NULL,
  latitude DOUBLE NULL,
  longitude DOUBLE NULL,
  nb_soutiens INT NOT NULL DEFAULT 0,
  email_contact VARCHAR(255) NULL,
  photo_resolution VARCHAR(500) NULL,
  date_resolution VARCHAR(30) NULL,
  token_suppression VARCHAR(128) COLLATE utf8mb4_bin NULL,
  utilisateur_id INT NULL,
  CONSTRAINT fk_signalements_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_signalements_date (date_signalement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Soutenir exige un compte : un seul soutien par compte et par signalement (contrainte
-- d'unicité). ip_hash n'est plus rempli, il reste vide, gardé pour l'historique.
CREATE TABLE IF NOT EXISTS soutiens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signalement_id INT NOT NULL,
  utilisateur_id INT NULL,
  ip_hash VARCHAR(64) NOT NULL DEFAULT '',
  date_soutien VARCHAR(30) NOT NULL,
  CONSTRAINT fk_soutiens_signalement FOREIGN KEY (signalement_id)
    REFERENCES signalements(id) ON DELETE CASCADE,
  CONSTRAINT fk_soutiens_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT soutiens_signalement_utilisateur_uniq UNIQUE (signalement_id, utilisateur_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mises_a_jour (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signalement_id INT NOT NULL,
  texte TEXT NOT NULL,
  date_creation VARCHAR(30) NOT NULL,
  CONSTRAINT fk_mises_a_jour_signalement FOREIGN KEY (signalement_id)
    REFERENCES signalements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réponses aux commentaires : parent_id pointe vers le commentaire d'origine. CASCADE :
-- supprimer un commentaire emporte ses réponses, qui n'auraient plus de sens isolées.
CREATE TABLE IF NOT EXISTS commentaires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signalement_id INT NOT NULL,
  auteur VARCHAR(255) NOT NULL,
  texte TEXT NOT NULL,
  date_creation VARCHAR(30) NOT NULL,
  utilisateur_id INT NULL,
  parent_id INT NULL,
  CONSTRAINT fk_commentaires_signalement FOREIGN KEY (signalement_id)
    REFERENCES signalements(id) ON DELETE CASCADE,
  CONSTRAINT fk_commentaires_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT fk_commentaires_parent FOREIGN KEY (parent_id)
    REFERENCES commentaires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications affichées dans le site. L'email ne suffit pas : la plupart des comptes
-- n'ont pas d'adresse vérifiée et ne recevraient donc jamais rien.
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  signalement_id INT NULL,
  texte TEXT NOT NULL,
  lue BOOLEAN NOT NULL DEFAULT FALSE,
  date_creation VARCHAR(30) NOT NULL,
  CONSTRAINT fk_notifications_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_signalement FOREIGN KEY (signalement_id)
    REFERENCES signalements(id) ON DELETE CASCADE,
  INDEX idx_notifications_utilisateur (utilisateur_id, lue)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contenus signalés comme abusifs. cible_id désigne un signalement OU un commentaire
-- selon « type » : pas de clé étrangère possible, le contrôle est fait par le code.
CREATE TABLE IF NOT EXISTS signalements_abus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  cible_id INT NOT NULL,
  motif TEXT NULL,
  utilisateur_id INT NULL,
  date_creation VARCHAR(30) NOT NULL,
  CONSTRAINT fk_abus_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT abus_unique UNIQUE (type, cible_id, utilisateur_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages_contact (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  sujet VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  date_envoi VARCHAR(30) NOT NULL,
  lu BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
