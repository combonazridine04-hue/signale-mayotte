import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { envoyerMessageContact, mailerActif } from '../mailer.js'
import { db } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { SUJETS_CONTACT } from '../../shared/sujetsContact.js'
import { texte, emailValide, verifierParametreId } from '../validation.js'
import { exigerCaptcha } from '../captcha.js'

const router = Router()

router.param('id', verifierParametreId('Message introuvable.'))

const limiteurContact = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de messages envoyés, réessayez plus tard.' }
})

function mapRow(row) {
  return {
    id: row.id,
    nom: row.nom,
    email: row.email,
    sujet: row.sujet,
    message: row.message,
    dateEnvoi: row.date_envoi,
    lu: row.lu
  }
}

router.post('/contact', limiteurContact, exigerCaptcha, async (req, res) => {
  const corps = req.body || {}
  const nom = texte(corps.nom)
  const email = texte(corps.email).trim()
  const sujet = texte(corps.sujet)
  const message = texte(corps.message)
  const honeypot = corps.site_web

  if (honeypot) {
    return res.status(202).json({ envoye: true })
  }

  if (nom.trim().length < 2) {
    return res.status(400).json({ erreur: 'Le nom doit contenir au moins 2 caractères.' })
  }
  if (nom.trim().length > 100) {
    return res.status(400).json({ erreur: 'Le nom ne doit pas dépasser 100 caractères.' })
  }
  if (!emailValide(email)) {
    return res.status(400).json({ erreur: 'Veuillez saisir une adresse email valide.' })
  }
  if (!SUJETS_CONTACT.includes(sujet)) {
    return res.status(400).json({ erreur: 'Veuillez sélectionner un sujet.' })
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ erreur: 'Le message doit contenir au moins 10 caractères.' })
  }
  if (message.trim().length > 3000) {
    return res.status(400).json({ erreur: 'Le message ne doit pas dépasser 3000 caractères.' })
  }

  const nomTrim = nom.trim()
  const messageTrim = message.trim()
  const dateEnvoi = new Date().toISOString()

  await db.query(
    `INSERT INTO messages_contact (nom, email, sujet, message, date_envoi, lu)
     VALUES (?, ?, ?, ?, ?, false)`,
    [nomTrim, email, sujet, messageTrim, dateEnvoi]
  )

  if (mailerActif) {
    try {
      await envoyerMessageContact({ nom: nomTrim, email, sujet, message: messageTrim })
    } catch (e) {
      console.error('[contact] Échec envoi email :', e.message)
    }
  }

  res.status(202).json({ envoye: true })
})

router.get('/contact', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM messages_contact ORDER BY date_envoi DESC')
  res.json(rows.map(mapRow))
})

router.patch('/contact/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const { lu } = req.body || {}
  // MariaDB ne sait pas renvoyer la ligne modifiée (pas de UPDATE … RETURNING) : on la relit.
  await db.query('UPDATE messages_contact SET lu = ? WHERE id = ?', [Boolean(lu), id])
  const { rows } = await db.query('SELECT * FROM messages_contact WHERE id = ?', [id])
  if (!rows[0]) return res.status(404).json({ erreur: 'Message introuvable.' })
  res.json(mapRow(rows[0]))
})

router.delete('/contact/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const { rowCount } = await db.query('DELETE FROM messages_contact WHERE id = ?', [id])
  if (!rowCount) return res.status(404).json({ erreur: 'Message introuvable.' })
  res.status(204).end()
})

export default router
