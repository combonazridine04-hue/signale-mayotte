import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
// Schéma : les tables sont décrites dans database/schema.sql (CREATE TABLE IF NOT EXISTS).
// Il est exécuté à chaque démarrage : une base vide arrive seule au bon état.
// ---------------------------------------------------------------------------------------

const FICHIER_SCHEMA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database', 'schema.sql')
const instructions = fs
  .readFileSync(FICHIER_SCHEMA, 'utf8')
  .split(/;\s*$/m)
  .map((sql) => sql.trim())
  .filter((sql) => sql.replace(/^--.*$/gm, '').trim())
for (const sql of instructions) {
  await db.query(sql)
}

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
    const { rows: logos } = await db.query('SELECT logo_url FROM partenaires WHERE logo_url IS NOT NULL')
    await viderPhotos([...avatars.map((r) => r.avatar_url), ...logos.map((r) => r.logo_url)])
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
