import { randomBytes, randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from './db.js'

const DUREE_SESSION_MS = 12 * 60 * 60 * 1000 // 12h
// token -> { type: 'admin', adminId, identifiant, expiration }
//        | { type: 'utilisateur', utilisateurId, nom, expiration }
const sessions = new Map()

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
  sessions.set(token, {
    type: 'admin',
    adminId: admin.id,
    identifiant: admin.identifiant,
    expiration: Date.now() + DUREE_SESSION_MS
  })
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
    if (session.type === 'admin' && session.adminId === adminId) sessions.delete(token)
  }
}

export function revoquerSessionsUtilisateur(utilisateurId) {
  for (const [token, session] of sessions) {
    if (session.type === 'utilisateur' && session.utilisateurId === utilisateurId) sessions.delete(token)
  }
}

// --- Comptes citoyens (distincts des comptes admin) ---

function normaliserEmail(email) {
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
}

function normaliserTelephone(telephone) {
  return typeof telephone === 'string' && telephone.trim() ? telephone.trim() : null
}

const DUREE_CODE_VERIFICATION_MS = 30 * 60 * 1000 // 30min

function genererCodeVerification() {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

export async function inscrireUtilisateur({ nom, email, telephone, motDePasse }) {
  const emailNormalise = normaliserEmail(email)
  const telephoneNormalise = normaliserTelephone(telephone)

  if (!nom || nom.trim().length < 2) {
    return { erreur: 'Le nom doit contenir au moins 2 caractères.' }
  }
  if (!emailNormalise && !telephoneNormalise) {
    return { erreur: 'Renseignez un email ou un numéro de téléphone.' }
  }
  if (!motDePasse || motDePasse.length < 8) {
    return { erreur: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  const creeLe = new Date().toISOString()
  // Un code de vérification à 6 chiffres est généré dès l'inscription si un email est fourni ;
  // le compte reste utilisable normalement, seul l'envoi d'un signalement l'exigera.
  const codeVerification = emailNormalise ? genererCodeVerification() : null
  const codeExpiration = codeVerification ? new Date(Date.now() + DUREE_CODE_VERIFICATION_MS).toISOString() : null

  try {
    const { rows } = await db.query(
      `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe_hash, cree_le, token_verification, token_verification_expire)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nom, email, telephone, email_verifie`,
      [nom.trim(), emailNormalise, telephoneNormalise, hash, creeLe, codeVerification, codeExpiration]
    )
    return { utilisateur: rows[0], codeVerification }
  } catch (e) {
    if (e.code === '23505') {
      return { erreur: 'Un compte existe déjà avec cet email ou ce numéro.' }
    }
    throw e
  }
}

// Vérifie le code saisi pour le compte CONNECTÉ (jamais une recherche globale par code :
// avec seulement 6 chiffres, plusieurs comptes pourraient en théorie partager le même).
export async function confirmerEmailUtilisateur(utilisateurId, code) {
  if (!code) return false
  const { rows } = await db.query(
    `UPDATE utilisateurs SET email_verifie = true, token_verification = NULL, token_verification_expire = NULL
     WHERE id = $1 AND token_verification = $2 AND token_verification_expire > NOW() RETURNING id`,
    [utilisateurId, code]
  )
  return rows.length > 0
}

// Renvoie { code, email, nom } pour un nouvel envoi, ou null si déjà vérifié / pas d'email / compte introuvable.
export async function regenererTokenVerification(utilisateurId) {
  const { rows } = await db.query('SELECT email, nom, email_verifie FROM utilisateurs WHERE id = $1', [utilisateurId])
  const utilisateur = rows[0]
  if (!utilisateur || !utilisateur.email || utilisateur.email_verifie) return null

  const code = genererCodeVerification()
  const expiration = new Date(Date.now() + DUREE_CODE_VERIFICATION_MS).toISOString()
  await db.query(
    'UPDATE utilisateurs SET token_verification = $1, token_verification_expire = $2 WHERE id = $3',
    [code, expiration, utilisateurId]
  )
  return { code, email: utilisateur.email, nom: utilisateur.nom }
}

const DUREE_TOKEN_REINITIALISATION_MS = 60 * 60 * 1000 // 1h

// Renvoie { token, nom, email } si un compte avec cet email existe, sinon null.
// Ne jamais révéler au client si l'email existe ou non (évite l'énumération de comptes).
export async function genererTokenReinitialisation(email) {
  const emailNormalise = normaliserEmail(email)
  if (!emailNormalise) return null

  const { rows } = await db.query('SELECT id, nom FROM utilisateurs WHERE LOWER(email) = $1', [emailNormalise])
  const utilisateur = rows[0]
  if (!utilisateur) return null

  const token = randomBytes(24).toString('hex')
  const expiration = new Date(Date.now() + DUREE_TOKEN_REINITIALISATION_MS).toISOString()
  await db.query(
    'UPDATE utilisateurs SET token_reinitialisation = $1, token_reinitialisation_expire = $2 WHERE id = $3',
    [token, expiration, utilisateur.id]
  )
  return { token, nom: utilisateur.nom, email: emailNormalise }
}

// Renvoie true si le mot de passe a bien été changé, false si le lien est invalide ou expiré.
export async function reinitialiserMotDePasse(token, nouveauMotDePasse) {
  if (!token || !nouveauMotDePasse || nouveauMotDePasse.length < 8) return false

  const { rows } = await db.query(
    'SELECT id FROM utilisateurs WHERE token_reinitialisation = $1 AND token_reinitialisation_expire > NOW()',
    [token]
  )
  const utilisateur = rows[0]
  if (!utilisateur) return false

  const hash = await bcrypt.hash(nouveauMotDePasse, 12)
  await db.query(
    'UPDATE utilisateurs SET mot_de_passe_hash = $1, token_reinitialisation = NULL, token_reinitialisation_expire = NULL WHERE id = $2',
    [hash, utilisateur.id]
  )
  revoquerSessionsUtilisateur(utilisateur.id)
  return true
}

export async function verifierIdentifiantsUtilisateur(identifiant, motDePasse) {
  if (typeof identifiant !== 'string' || typeof motDePasse !== 'string') return null

  const valeur = identifiant.trim().toLowerCase()
  const { rows } = await db.query(
    'SELECT * FROM utilisateurs WHERE LOWER(email) = $1 OR telephone = $2',
    [valeur, identifiant.trim()]
  )
  const utilisateur = rows[0]
  if (!utilisateur) {
    await bcrypt.compare(motDePasse, '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Q7kJnMfCbXWDh7jHfnfjqI3sT4XVe')
    return null
  }

  const valide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hash)
  return valide ? { id: utilisateur.id, nom: utilisateur.nom, email: utilisateur.email } : null
}

export function creerSessionUtilisateur(utilisateur) {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, {
    type: 'utilisateur',
    utilisateurId: utilisateur.id,
    nom: utilisateur.nom,
    expiration: Date.now() + DUREE_SESSION_MS
  })
  return token
}
