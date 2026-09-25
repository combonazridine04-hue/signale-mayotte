import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { db } from '../db.js'
import { requireAuth, requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { idValide, verifierParametreId } from '../validation.js'

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
      'INSERT INTO signalements_abus (type, cible_id, motif, utilisateur_id, date_creation) VALUES ($1, $2, $3, $4, $5)',
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
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erreur: 'Vous avez déjà signalé ce contenu.' })
    }
    throw e
  }
})

router.get('/moderation/signalements-abus', requireAuth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT type, cible_id, COUNT(*)::int AS nb_signalements, MAX(date_creation) AS dernier_signalement,
           array_remove(array_agg(NULLIF(motif, '')), NULL) AS motifs
    FROM signalements_abus
    GROUP BY type, cible_id
    ORDER BY dernier_signalement DESC
  `)

  const resultats = []
  for (const row of rows) {
    const sql =
      row.type === 'signalement'
        ? 'SELECT id, categorie, commune, description FROM signalements WHERE id = $1'
        : 'SELECT id, auteur, texte, signalement_id FROM commentaires WHERE id = $1'
    const { rows: cible } = await db.query(sql, [row.cible_id])
    const apercu = cible[0] || null
    resultats.push({
      type: row.type,
      cibleId: row.cible_id,
      nbSignalements: row.nb_signalements,
      dernierSignalement: row.dernier_signalement,
      motifs: row.motifs,
      existeEncore: Boolean(apercu),
      apercu
    })
  }

  res.json({ signalementsAbus: resultats })
})

router.delete('/moderation/signalements-abus/:type/:cibleId', requireAuth, async (req, res) => {
  await db.query('DELETE FROM signalements_abus WHERE type = $1 AND cible_id = $2', [
    req.params.type,
    Number(req.params.cibleId)
  ])
  res.status(204).end()
})

export default router
