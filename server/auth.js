import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from './db.js'

const DUREE_SESSION_MS = 12 * 60 * 60 * 1000 // 12h
const sessions = new Map() // token -> { adminId, identifiant, expiration }

const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM admins')
if (rows[0].count === 0) {
  const identifiant = process.env.ADMIN_IDENTIFIANT
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE

  if (!identifiant || !motDePasse) {
    throw new Error(
      'ADMIN_IDENTIFIANT / ADMIN_MOT_DE_PASSE manquants : renseignez-les dans .env pour créer le premier compte admin.'
    )
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  await db.query(
    'INSERT INTO admins (identifiant, mot_de_passe_hash, cree_le) VALUES ($1, $2, $3)',
    [identifiant, hash, new Date().toISOString()]
  )
}

export async function verifierIdentifiants(identifiant, motDePasse) {
  if (typeof identifiant !== 'string' || typeof motDePasse !== 'string') return null

  const { rows } = await db.query('SELECT * FROM admins WHERE identifiant = $1', [identifiant])
  const admin = rows[0]
  if (!admin) {
    // Coût de calcul similaire à une vraie vérification, pour ne pas fuiter
    // par le timing l'existence ou non de l'identifiant.
    await bcrypt.compare(motDePasse, '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Q7kJnMfCbXWDh7jHfnfjqI3sT4XVe')
    return null
  }

  const valide = await bcrypt.compare(motDePasse, admin.mot_de_passe_hash)
  return valide ? { id: admin.id, identifiant: admin.identifiant } : null
}

export function creerSession(admin) {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { adminId: admin.id, identifiant: admin.identifiant, expiration: Date.now() + DUREE_SESSION_MS })
  return token
}

export function sessionValide(token) {
  if (!token || !sessions.has(token)) return null
  const session = sessions.get(token)
  if (Date.now() > session.expiration) {
    sessions.delete(token)
    return null
  }
  return session
}

export function revoquerSession(token) {
  sessions.delete(token)
}

export function revoquerSessionsDe(adminId) {
  for (const [token, session] of sessions) {
    if (session.adminId === adminId) sessions.delete(token)
  }
}
