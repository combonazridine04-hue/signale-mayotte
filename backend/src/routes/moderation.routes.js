import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { db } from '../config/db.js'
import { envoyerAlerteContenuAbusif } from '../services/emailService.js'
import { journaliser } from '../services/journalService.js'
import { requireAuth, requireAuthUtilisateur } from '../middlewares/requireAuth.js'
import { idValide, verifierParametreId } from '../middlewares/validation.js'

const router = Router()

router.param('cibleId', verifierParametreId('Contenu introuvable.'))

const TYPES_AUTORISES = new Set(['signalement', 'commentaire'])

const limiteurSignalementAbus = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de signalements de contenu, réessayez plus tard.' }
})

async function alerterAssociation(type, id, motif) {
  const { rows } =
    type === 'commentaire'
      ? await db.query('SELECT signalement_id, texte AS extrait FROM commentaires WHERE id = ?', [id])
      : await db.query('SELECT id AS signalement_id, description AS extrait FROM signalements WHERE id = ?', [id])
  if (!rows.length) return
  await envoyerAlerteContenuAbusif({
    type,
    signalementId: rows[0].signalement_id,
    extrait: String(rows[0].extrait || '').slice(0, 300),
    motif: typeof motif === 'string' ? motif.trim().slice(0, 500) : ''
  })
}

router.post('/moderation/signaler', requireAuthUtilisateur, limiteurSignalementAbus, async (req, res) => {
  const { type, cibleId, motif } = req.body || {}

  if (!TYPES_AUTORISES.has(type)) {
    return res.status(400).json({ erreur: 'Type invalide.' })
  }
  const id = idValide(cibleId)
  if (id === null) {
    return res.status(400).json({ erreur: 'Cible invalide.' })
  }

  try {
    await db.query(
      'INSERT INTO signalements_abus (type, cible_id, motif, utilisateur_id, date_creation) VALUES (?, ?, ?, ?, ?)',
      [
        type,
        id,
        typeof motif === 'string' ? motif.trim().slice(0, 500) : null,
        req.utilisateur?.id || null,
        new Date().toISOString()
      ]
    )
    // 204 et pas 201 : la réponse n'a pas de corps, et le client tentait d'y lire du JSON.
    res.status(204).end()
    // Après la réponse : l'alerte de l'association ne doit ni ralentir ni faire échouer
    // l'enregistrement du signalement d'abus.
    alerterAssociation(type, id, req.body?.motif).catch((e) =>
      console.error("[moderation] Échec de l'alerte de l'association :", e.message)
    )
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erreur: 'Vous avez déjà signalé ce contenu.' })
    }
    throw e
  }
})

router.get('/moderation/signalements-abus', requireAuth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT type, cible_id, COUNT(*) AS nb_signalements, MAX(date_creation) AS dernier_signalement,
           JSON_ARRAYAGG(NULLIF(motif, '')) AS motifs
    FROM signalements_abus
    GROUP BY type, cible_id
    ORDER BY dernier_signalement DESC
  `)

  const resultats = []
  for (const row of rows) {
    const sql =
      row.type === 'signalement'
        ? 'SELECT id, categorie, commune, description FROM signalements WHERE id = ?'
        : 'SELECT id, auteur, texte, signalement_id FROM commentaires WHERE id = ?'
    const { rows: cible } = await db.query(sql, [row.cible_id])
    const apercu = cible[0] || null
    resultats.push({
      type: row.type,
      cibleId: row.cible_id,
      nbSignalements: row.nb_signalements,
      dernierSignalement: row.dernier_signalement,
      // Les motifs laissés vides arrivent en null dans la liste : on ne garde que les vrais.
      motifs: (row.motifs || []).filter(Boolean),
      existeEncore: Boolean(apercu),
      apercu
    })
  }

  res.json({ signalementsAbus: resultats })
})

router.delete('/moderation/signalements-abus/:type/:cibleId', requireAuth, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM signalements_abus WHERE type = ? AND cible_id = ?', [
    req.params.type,
    Number(req.params.cibleId)
  ])
  if (rowCount) {
    journaliser(req, 'moderation.ignore', {
      cible: { type: String(req.params.type).slice(0, 20), id: Number(req.params.cibleId) },
      details: { signalementsAbusRetires: rowCount }
    })
  }
  res.status(204).end()
})

export default router
