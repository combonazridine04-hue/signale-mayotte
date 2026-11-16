import mysql from 'mysql2/promise'
import { viderPhotos } from './storage.js'

// Base de données relationnelle : MariaDB (ou MySQL), via le pilote mysql2.
//
// DATABASE_URL a la forme mysql://utilisateur:motdepasse@hote:3306/base
// (le préfixe mariadb:// est accepté aussi).

const adresse = process.env.DATABASE_URL

if (!adresse) {
  throw new Error(
    'DATABASE_URL manquant : copiez .env.example vers .env et renseignez la connexion MariaDB, par ex. mysql://signale:motdepasse@localhost:3306/signale_mayotte'
  )
}

const url = new URL(adresse.replace(/^mariadb:/, 'mysql:'))
if (url.protocol !== 'mysql:') {
  throw new Error('DATABASE_URL doit commencer par mysql:// ou mariadb:// (base MariaDB).')
}

// Chiffrement de la connexion (TLS) :
// - base sur ce PC (localhost) : aucun, la connexion ne sort pas de la machine ;
// - base distante : TLS obligatoire, certificat vérifié ;
// - DATABASE_TLS=non : aucun, pour une base joignable seulement par le réseau interne de
//   l'hébergeur (cas d'alwaysdata, où le site et la base sont chez lui).
const estLocale = ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || process.env.DATABASE_TLS === 'non'

// Colonnes JSON (listes) : MariaDB les stocke en texte, on les rend sous forme de tableau.
const COLONNES_JSON = new Set(['photos', 'categories', 'motifs'])

const pool = mysql.createPool({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  ssl: estLocale ? undefined : { rejectUnauthorized: true },
  connectionLimit: 10,
  charset: 'utf8mb4',
  // Les dates (DATETIME) sont écrites et relues en UTC, quel que soit le fuseau du serveur.
  timezone: 'Z',
  // SUM(), AVG()… : des nombres, et non des chaînes.
  decimalNumbers: true,
  // MariaDB n'a pas de vrai type booléen (BOOLEAN = TINYINT(1), qui vaut 0 ou 1) : on
  // rend true/false, pour que l'API et le front reçoivent exactement les mêmes données.
  typeCast(champ, suivant) {
    if (champ.type === 'TINY' && champ.length === 1) {
      const valeur = champ.string()
      return valeur === null ? null : valeur === '1'
    }
    if (COLONNES_JSON.has(champ.name)) {
      const valeur = champ.string()
      return valeur === null ? null : JSON.parse(valeur)
    }
    return suivant()
  }
})

// Résultat uniforme pour tout le code : { rows, rowCount, insertId }.
// - SELECT (et INSERT/DELETE … RETURNING) : rows = les lignes, rowCount = leur nombre.
// - INSERT / UPDATE / DELETE : rowCount = lignes touchées, insertId = id créé.
function normaliser(resultat) {
  if (Array.isArray(resultat)) return { rows: resultat, rowCount: resultat.length }
  return { rows: [], rowCount: resultat.affectedRows, insertId: resultat.insertId }
}

/**
 * Composant d'accès aux données. Toutes les requêtes sont paramétrées : les valeurs
 * passent dans le tableau `parametres` (un `?` dans le SQL par valeur), jamais
 * collées dans le texte SQL. C'est ce qui protège de l'injection SQL.
 */
export const db = {
  async query(sql, parametres = []) {
    const [resultat] = await pool.query(sql, parametres)
    return normaliser(resultat)
  },

  // Connexion dédiée, pour une transaction (BEGIN … COMMIT / ROLLBACK).
  async connect() {
    const connexion = await pool.getConnection()
    return {
      async query(sql, parametres = []) {
        const [resultat] = await connexion.query(sql, parametres)
        return normaliser(resultat)
      },
      release: () => connexion.release()
    }
  },

  end: () => pool.end()
}

// ---------------------------------------------------------------------------------------
// Schéma. Créé au démarrage s'il n'existe pas : une base vide arrive seule au bon état.
// InnoDB pour les clés étrangères et les transactions ; utf8mb4 pour les accents et emojis.
//
// Les dates « métier » (date_signalement, cree_le…) sont des chaînes ISO 8601
// (2026-11-15T21:00:00.000Z) : c'est le format renvoyé tel quel à l'API, et il se trie
// correctement par ordre alphabétique. Les dates d'expiration des codes, comparées à
// l'heure actuelle par la base, sont de vrais DATETIME en UTC.
//
// Les jetons (vérification, réinitialisation, suppression) sont en collation binaire :
// sans elle, MariaDB les comparerait sans tenir compte des majuscules, ce qui affaiblirait
// des valeurs qui doivent être devinées exactement.
// ---------------------------------------------------------------------------------------

const OPTIONS_TABLE = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'

await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

// Double authentification des admins (code à 6 chiffres d'une appli) : un mot de passe
// admin volé ne suffit plus à ouvrir la modération, l'export et la gestion des comptes.
// totp_secret_attente : secret proposé, pas encore confirmé par un premier code.
// totp_dernier_pas : dernier code accepté, pour qu'il ne puisse pas être rejoué.
await db.query(`
  CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifiant VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(64) NULL,
    totp_secret_attente VARCHAR(64) NULL,
    totp_dernier_pas BIGINT NULL,
    cree_le VARCHAR(30) NOT NULL
  ) ${OPTIONS_TABLE}
`)

// Comptes partenaires : agents municipaux ou services techniques désignés par
// l'association pour faire évoluer le statut des signalements de leur périmètre. Une
// table séparée des admins : ce sont des droits différents (pas de modération, pas de
// gestion des comptes, pas d'export), gérés par l'admin.
// commune NULL = toute l'île ; categories vide = tous les domaines.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

// Signalement urgent : un simple drapeau plutôt qu'un circuit séparé, pour que le danger
// immédiat (fil électrique à terre, fuite, route coupée) remonte en tête de liste.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

// Soutenir exige un compte : un seul soutien par compte et par signalement (contrainte
// d'unicité). ip_hash n'est plus rempli : il reste vide, gardé pour l'historique.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS mises_a_jour (
    id INT AUTO_INCREMENT PRIMARY KEY,
    signalement_id INT NOT NULL,
    texte TEXT NOT NULL,
    date_creation VARCHAR(30) NOT NULL,
    CONSTRAINT fk_mises_a_jour_signalement FOREIGN KEY (signalement_id)
      REFERENCES signalements(id) ON DELETE CASCADE
  ) ${OPTIONS_TABLE}
`)

// Réponses aux commentaires : parent_id pointe vers le commentaire d'origine. CASCADE :
// supprimer un commentaire emporte ses réponses, qui n'auraient plus de sens isolées.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

// Notifications affichées dans le site. L'email ne suffit pas : la plupart des comptes
// n'ont pas d'adresse vérifiée et ne recevraient donc jamais rien.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

// Contenus signalés comme abusifs. cible_id désigne un signalement OU un commentaire
// selon « type » : pas de clé étrangère possible, le contrôle est fait par le code.
await db.query(`
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
  ) ${OPTIONS_TABLE}
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS messages_contact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    sujet VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    date_envoi VARCHAR(30) NOT NULL,
    lu BOOLEAN NOT NULL DEFAULT FALSE
  ) ${OPTIONS_TABLE}
`)

const donneesDemo = [
  {
    categorie: 'Dépôt sauvage / déchets',
    commune: 'Mamoudzou',
    description: 'Amas de déchets sur le bord de la route près du marché couvert.',
    statut: 'Signalé',
    date_signalement: '2026-08-05T08:00:00.000Z'
  },
  {
    categorie: 'Voirie',
    commune: 'Koungou',
    description: 'Nid-de-poule important qui endommage les véhicules, rue principale.',
    statut: 'En cours',
    date_signalement: '2026-08-02T10:30:00.000Z'
  },
  {
    categorie: 'Éclairage public',
    commune: 'Sada',
    description: 'Lampadaire cassé depuis plusieurs semaines, rue sombre le soir.',
    statut: 'Résolu',
    date_signalement: '2026-07-20T18:00:00.000Z'
  }
]

// Vide les signalements (et, par cascade, leurs soutiens, commentaires, mises à jour et
// notifications), puis remet les données de démonstration.
// viderStockage : réservé aux tests, qui travaillent dans leur propre espace photos
// (ESPACE_PHOTOS forcé par tests/environnementTest.js).
export async function reinitialiserDonneesDemo({ viderStockage = false } = {}) {
  // TRUNCATE est refusé sur une table visée par des clés étrangères : DELETE déclenche les
  // ON DELETE CASCADE, puis on remet le compteur d'identifiants à 1.
  await db.query('DELETE FROM signalements')
  await db.query('ALTER TABLE signalements AUTO_INCREMENT = 1')
  if (viderStockage) {
    // Les photos de profil vivent dans le même espace de stockage que celles des
    // signalements : on les liste pour que la remise à zéro ne les emporte pas avec elle.
    const { rows: avatars } = await db.query('SELECT avatar_url FROM utilisateurs WHERE avatar_url IS NOT NULL')
    await viderPhotos(avatars.map((r) => r.avatar_url))
  }
  for (const s of donneesDemo) {
    await db.query(
      `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude)
       VALUES (?, ?, ?, '[]', ?, ?, NULL, NULL)`,
      [s.categorie, s.commune, s.description, s.statut, s.date_signalement]
    )
  }
}

// Base neuve : on la remplit avec les données de démonstration, SANS toucher au stockage
// des photos. Une base vide ne prouve pas que le stockage l'est aussi : il peut être
// partagé avec une autre base (c'est ainsi qu'une base locale neuve, branchée sur le
// stockage de la production, a un jour effacé toutes les photos du site en ligne).
const { rows } = await db.query('SELECT COUNT(*) AS count FROM signalements')
if (rows[0].count === 0) {
  await reinitialiserDonneesDemo()
}
