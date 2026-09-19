import { randomBytes, randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from './db.js'
import { normaliserTelephone as normaliserNumero, telephoneValide } from '../shared/telephone.js'
import { motDePasseInterdit } from '../shared/motDePasse.js'

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

// Une session n'était supprimée de la mémoire que si quelqu'un s'en resservait. Celles
// dont personne ne revient (onglet fermé, appareil éteint) y restaient indéfiniment :
// sur un hébergement à 512 Mo, ça finit par peser. On balaie une fois par heure.
const INTERVALLE_MENAGE_MS = 60 * 60 * 1000

const menageSessions = setInterval(() => {
  const maintenant = Date.now()
  for (const [token, session] of sessions) {
    if (maintenant > session.expiration) sessions.delete(token)
  }
}, INTERVALLE_MENAGE_MS)
// Ne doit pas empêcher le processus de s'arrêter (tests, redéploiement).
menageSessions.unref?.()

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

// Stocké sous forme canonique (10 chiffres, sans espace) : sans ça « 0639000000 » et
// « 06 39 00 00 00 » créent deux comptes différents malgré la contrainte d'unicité.
function normaliserTelephone(telephone) {
  if (typeof telephone !== 'string' || !telephone.trim()) return null
  return normaliserNumero(telephone) || null
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
  if (telephoneNormalise && !telephoneValide(telephoneNormalise)) {
    return { erreur: 'Le numéro doit contenir 10 chiffres et commencer par 0 (ex. 06 39 06 50 31).' }
  }
  const refus = motDePasseInterdit(motDePasse)
  if (refus) {
    return { erreur: refus }
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
  // On cherche le numéro tel qu'il a été tapé ET sous sa forme canonique : les comptes
  // créés avant la normalisation ont pu être enregistrés avec des espaces.
  const numeros = [identifiant.trim()]
  const numeroCanonique = normaliserTelephone(identifiant)
  if (numeroCanonique && !numeros.includes(numeroCanonique)) numeros.push(numeroCanonique)

  const { rows } = await db.query(
    'SELECT * FROM utilisateurs WHERE LOWER(email) = $1 OR telephone = ANY($2::text[])',
    [valeur, numeros]
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

const REGEX_PSEUDO = /^[a-zA-Z0-9 _-]{2,24}$/

export async function recupererProfil(utilisateurId) {
  const { rows } = await db.query(
    'SELECT nom, email, telephone, pseudo, avatar_url, email_verifie, cree_le FROM utilisateurs WHERE id = $1',
    [utilisateurId]
  )
  const utilisateur = rows[0]
  if (!utilisateur) return null
  return {
    nom: utilisateur.nom,
    email: utilisateur.email,
    telephone: utilisateur.telephone,
    pseudo: utilisateur.pseudo,
    avatarUrl: utilisateur.avatar_url,
    emailVerifie: utilisateur.email_verifie,
    creeLe: utilisateur.cree_le
  }
}

// Contributions du citoyen, affichées sur sa page profil.
export async function recupererStatsUtilisateur(utilisateurId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS signalements,
            COUNT(*) FILTER (WHERE statut = 'Résolu')::int AS resolus,
            COALESCE(SUM(nb_soutiens), 0)::int AS soutiens
     FROM signalements WHERE utilisateur_id = $1`,
    [utilisateurId]
  )
  return rows[0]
}

export async function mettreAJourAvatar(utilisateurId, avatarUrl) {
  await db.query('UPDATE utilisateurs SET avatar_url = $1 WHERE id = $2', [avatarUrl, utilisateurId])
}

// Renvoie { erreur } ou { pseudo }. Le pseudo est ce qui est affiché publiquement
// (commentaires...) à la place du vrai nom, pour laisser le choix à l'utilisateur.
export async function mettreAJourPseudo(utilisateurId, pseudo) {
  const valeur = typeof pseudo === 'string' ? pseudo.trim() : ''

  if (valeur && !REGEX_PSEUDO.test(valeur)) {
    return { erreur: 'Le pseudo doit contenir entre 2 et 24 caractères (lettres, chiffres, espaces, - ou _).' }
  }

  await db.query('UPDATE utilisateurs SET pseudo = $1 WHERE id = $2', [valeur || null, utilisateurId])
  return { pseudo: valeur || null }
}
