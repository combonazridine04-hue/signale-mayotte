import pg from 'pg'
import { viderPhotos } from './storage.js'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant : copiez .env.example vers .env et renseignez la chaîne de connexion Postgres de votre projet Supabase."
  )
}

export const db = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

await db.query(`
  CREATE TABLE IF NOT EXISTS signalements (
    id SERIAL PRIMARY KEY,
    categorie TEXT NOT NULL,
    commune TEXT NOT NULL,
    description TEXT NOT NULL,
    photos TEXT[] NOT NULL DEFAULT '{}',
    statut TEXT NOT NULL DEFAULT 'Signalé',
    date_signalement TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    nb_soutiens INTEGER NOT NULL DEFAULT 0,
    email_contact TEXT,
    photo_resolution TEXT,
    date_resolution TEXT,
    token_suppression TEXT
  )
`)
await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS token_suppression TEXT`)

// Migration (une seule fois) : ancienne colonne `photo` (une seule photo) -> `photos` (tableau).
const { rows: colonnePhoto } = await db.query(
  `SELECT 1 FROM information_schema.columns WHERE table_name = 'signalements' AND column_name = 'photo'`
)
if (colonnePhoto.length) {
  await db.query(`UPDATE signalements SET photos = ARRAY[photo] WHERE photo IS NOT NULL AND photos = '{}'`)
  await db.query(`ALTER TABLE signalements DROP COLUMN photo`)
}

// Ajout progressif des colonnes pour les bases déjà existantes.
await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS nb_soutiens INTEGER NOT NULL DEFAULT 0`)
await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS email_contact TEXT`)
await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS photo_resolution TEXT`)
await db.query(`ALTER TABLE signalements ADD COLUMN IF NOT EXISTS date_resolution TEXT`)

await db.query(`
  CREATE TABLE IF NOT EXISTS messages_contact (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL,
    email TEXT NOT NULL,
    sujet TEXT NOT NULL,
    message TEXT NOT NULL,
    date_envoi TEXT NOT NULL,
    lu BOOLEAN NOT NULL DEFAULT false
  )
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    identifiant TEXT NOT NULL UNIQUE,
    mot_de_passe_hash TEXT NOT NULL,
    cree_le TEXT NOT NULL
  )
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS soutiens (
    id SERIAL PRIMARY KEY,
    signalement_id INTEGER NOT NULL REFERENCES signalements(id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL,
    date_soutien TEXT NOT NULL,
    UNIQUE (signalement_id, ip_hash)
  )
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS mises_a_jour (
    id SERIAL PRIMARY KEY,
    signalement_id INTEGER NOT NULL REFERENCES signalements(id) ON DELETE CASCADE,
    texte TEXT NOT NULL,
    date_creation TEXT NOT NULL
  )
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
    description: 'Nid de poule important qui endommage les véhicules, rue principale.',
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

export async function reinitialiserDonneesDemo() {
  await db.query('TRUNCATE TABLE signalements RESTART IDENTITY CASCADE')
  await viderPhotos()
  for (const s of donneesDemo) {
    await db.query(
      `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude)
       VALUES ($1, $2, $3, '{}', $4, $5, NULL, NULL)`,
      [s.categorie, s.commune, s.description, s.statut, s.date_signalement]
    )
  }
}

const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM signalements')
if (rows[0].count === 0) {
  await reinitialiserDonneesDemo()
}
