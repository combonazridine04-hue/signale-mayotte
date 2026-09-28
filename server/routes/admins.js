import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import QRCode from 'qrcode'
import { consommerCodeAdmin, revoquerSessionsDe } from '../auth.js'
import { genererSecret, lienOtpauth, verifierCode } from '../totp.js'
import { jetonDeLaRequete } from '../sessionCookie.js'
import { motDePasseInterdit } from '../../shared/motDePasse.js'
import { verifierParametreId } from '../validation.js'

const router = Router()

function mapRow(row) {
  return { id: row.id, identifiant: row.identifiant, creeLe: row.cree_le, deuxFacteurs: Boolean(row.deux_facteurs) }
}

// Le secret n'est jamais renvoyé par l'API, sauf une fois, au moment de l'activation.
const COLONNES = 'id, identifiant, cree_le, totp_secret IS NOT NULL AS deux_facteurs'

// Limité à /admins : monté sur /api, un router.use() global interceptait toutes les
// requêtes arrivées jusqu'ici, et une route inconnue répondait 401 au lieu de 404.
router.use('/admins', requireAuth)

router.param('id', verifierParametreId('Compte introuvable.'))

router.get('/admins', async (req, res) => {
  const { rows } = await db.query(`SELECT ${COLONNES} FROM admins ORDER BY cree_le ASC`)
  res.json(rows.map(mapRow))
})

// --- Double authentification (code à 6 chiffres d'une application) ---

router.get('/admins/me/2fa', async (req, res) => {
  const { rows } = await db.query(`SELECT ${COLONNES} FROM admins WHERE id = $1`, [req.admin.id])
  res.json({ actif: Boolean(rows[0]?.deux_facteurs) })
})

// Étape 1 : un secret est proposé (QR code à scanner). Il ne protège rien tant qu'un
// premier code n'a pas prouvé que l'application l'a bien enregistré.
router.post('/admins/me/2fa/preparer', async (req, res) => {
  const secret = genererSecret()
  await db.query('UPDATE admins SET totp_secret_attente = $1 WHERE id = $2', [secret, req.admin.id])
  const qr = await QRCode.toDataURL(lienOtpauth(secret, req.admin.identifiant), { margin: 1, width: 220 })
  res.json({ secret, qr })
})

// Étape 2 : le premier code valide active la protection.
router.post('/admins/me/2fa/activer', async (req, res) => {
  const { rows } = await db.query('SELECT totp_secret_attente FROM admins WHERE id = $1', [req.admin.id])
  const secret = rows[0]?.totp_secret_attente
  if (!secret) return res.status(400).json({ erreur: 'Recommencez la configuration : aucun QR code en attente.' })

  const pas = verifierCode(secret, req.body?.code)
  if (pas === null)
    return res.status(400).json({ erreur: 'Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.' })

  await db.query(
    'UPDATE admins SET totp_secret = $1, totp_secret_attente = NULL, totp_dernier_pas = $2 WHERE id = $3',
    [secret, pas, req.admin.id]
  )
  // Toute autre session ouverte avec le seul mot de passe est fermée.
  revoquerSessionsDe(req.admin.id, jetonDeLaRequete(req) || null)
  res.status(204).end()
})

// Désactiver sa propre protection exige le mot de passe ET un code : une session volée
// ne suffit pas à la retirer.
router.post('/admins/me/2fa/desactiver', async (req, res) => {
  const { motDePasse, code } = req.body || {}
  const { rows } = await db.query('SELECT * FROM admins WHERE id = $1', [req.admin.id])
  const admin = rows[0]
  if (!admin?.totp_secret) return res.status(400).json({ erreur: 'La double authentification n’est pas activée.' })
  if (!(await bcrypt.compare(String(motDePasse || ''), admin.mot_de_passe_hash))) {
    return res.status(400).json({ erreur: 'Mot de passe incorrect.' })
  }
  const dernierPas = admin.totp_dernier_pas === null ? null : Number(admin.totp_dernier_pas)
  if (!(await consommerCodeAdmin(admin.id, admin.totp_secret, dernierPas, code))) {
    return res.status(400).json({ erreur: 'Code incorrect ou expiré.' })
  }
  await db.query('UPDATE admins SET totp_secret = NULL, totp_dernier_pas = NULL WHERE id = $1', [admin.id])
  res.status(204).end()
})

// Téléphone perdu : un autre admin réinitialise la protection de son collègue, qui
// devra la reconfigurer. Ses sessions en cours sont fermées.
router.delete('/admins/:id/2fa', async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.admin.id) {
    return res.status(400).json({ erreur: 'Pour votre propre compte, utilisez « Désactiver ».' })
  }
  const { rowCount } = await db.query(
    'UPDATE admins SET totp_secret = NULL, totp_secret_attente = NULL, totp_dernier_pas = NULL WHERE id = $1',
    [id]
  )
  if (!rowCount) return res.status(404).json({ erreur: 'Compte introuvable.' })
  revoquerSessionsDe(id)
  res.status(204).end()
})

router.post('/admins', async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  if (typeof identifiant !== 'string' || identifiant.trim().length < 3) {
    return res.status(400).json({ erreur: "L'identifiant doit contenir au moins 3 caractères." })
  }
  // Même règle que pour les citoyens : un compte administrateur protégé par « 12345678 »
  // ouvrirait toute la modération à qui le devine.
  const refus = motDePasseInterdit(motDePasse)
  if (refus) return res.status(400).json({ erreur: refus })

  const identifiantTrim = identifiant.trim()
  const { rows: existant } = await db.query('SELECT id FROM admins WHERE identifiant = $1', [identifiantTrim])
  if (existant.length) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  const { rows } = await db.query(
    'INSERT INTO admins (identifiant, mot_de_passe_hash, cree_le) VALUES ($1, $2, $3) RETURNING id, identifiant, cree_le',
    [identifiantTrim, hash, new Date().toISOString()]
  )

  res.status(201).json(mapRow(rows[0]))
})

router.delete('/admins/:id', async (req, res) => {
  const id = Number(req.params.id)

  if (id === req.admin.id) {
    return res.status(400).json({ erreur: 'Impossible de supprimer votre propre compte.' })
  }

  const { rows: total } = await db.query('SELECT COUNT(*)::int AS count FROM admins')
  if (total[0].count <= 1) {
    return res.status(400).json({ erreur: 'Impossible de supprimer le dernier compte admin.' })
  }

  const { rowCount } = await db.query('DELETE FROM admins WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ erreur: 'Compte introuvable.' })

  revoquerSessionsDe(id)
  res.status(204).end()
})

router.patch('/admins/me/mot-de-passe', async (req, res) => {
  const { motDePasseActuel, nouveauMotDePasse } = req.body || {}

  const refus = motDePasseInterdit(nouveauMotDePasse)
  if (refus) return res.status(400).json({ erreur: refus })

  const { rows } = await db.query('SELECT * FROM admins WHERE id = $1', [req.admin.id])
  const admin = rows[0]
  if (!admin) return res.status(404).json({ erreur: 'Compte introuvable.' })

  const valide = await bcrypt.compare(String(motDePasseActuel || ''), admin.mot_de_passe_hash)
  // 400 et non 401 : 401 signifie « session invalide », et le site déconnectait alors
  // l'admin pour une simple faute de frappe.
  if (!valide) {
    return res.status(400).json({ erreur: 'Mot de passe actuel incorrect.' })
  }

  const hash = await bcrypt.hash(nouveauMotDePasse, 12)
  await db.query('UPDATE admins SET mot_de_passe_hash = $1 WHERE id = $2', [hash, req.admin.id])
  // Changer son mot de passe sert souvent à couper l'accès à quelqu'un qui le connaissait :
  // les autres sessions de ce compte sont fermées, seule la session en cours est gardée.
  revoquerSessionsDe(req.admin.id, jetonDeLaRequete(req) || null)

  res.status(204).end()
})

export default router
