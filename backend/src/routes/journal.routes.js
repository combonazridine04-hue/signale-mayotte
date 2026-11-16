import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import {
  journalActif,
  lireJournal,
  statistiquesJournal,
  TYPES_EVENEMENTS,
  RESULTATS
} from '../services/journalService.js'

const router = Router()

// Réservé aux admins. Limité à /journal pour qu'une route inconnue montée après
// réponde 404 et non 401 (même raison que dans admins.js).
router.use('/journal', requireAuth)

// Les valeurs reçues sont confrontées à des listes fermées avant d'atteindre la base NoSQL :
// « ?type=x » devient la chaîne "x" si elle est connue, sinon rien.
function entierBorne(valeur, defaut, min, max) {
  const n = Number.parseInt(valeur, 10)
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : defaut
}

function journalIndisponible(res, e) {
  console.error('[journal] lecture impossible :', e.message)
  res.status(503).json({ erreur: 'Le journal est momentanément indisponible.' })
}

router.get('/journal', async (req, res) => {
  const types = Object.entries(TYPES_EVENEMENTS).map(([valeur, libelle]) => ({ valeur, libelle }))
  if (!journalActif) {
    return res.json({ actif: false, types, evenements: [], total: 0, page: 1, parPage: 25 })
  }

  const type = typeof req.query.type === 'string' && TYPES_EVENEMENTS[req.query.type] ? req.query.type : undefined
  const resultat =
    typeof req.query.resultat === 'string' && RESULTATS.includes(req.query.resultat) ? req.query.resultat : undefined
  const page = entierBorne(req.query.page, 1, 1, 10000)
  const parPage = entierBorne(req.query.parPage, 25, 5, 100)

  try {
    res.json({ actif: true, types, ...(await lireJournal({ type, resultat, page, parPage })) })
  } catch (e) {
    journalIndisponible(res, e)
  }
})

router.get('/journal/statistiques', async (req, res) => {
  if (!journalActif) return res.json({ actif: false })
  const jours = entierBorne(req.query.jours, 30, 1, 365)
  try {
    res.json({ actif: true, ...(await statistiquesJournal(jours)) })
  } catch (e) {
    journalIndisponible(res, e)
  }
})

export default router
