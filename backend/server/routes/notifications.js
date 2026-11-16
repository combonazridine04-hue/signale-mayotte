import { Router } from 'express'
import { requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { listerNotifications, compterNonLues, marquerToutesLues } from '../notifications.js'

const router = Router()

router.get('/notifications', requireAuthUtilisateur, async (req, res) => {
  // Les notifications appartiennent aux comptes citoyens ; un admin n'en a pas.
  if (!req.utilisateur) return res.json({ notifications: [], nonLues: 0 })

  res.json({
    notifications: await listerNotifications(req.utilisateur.id),
    nonLues: await compterNonLues(req.utilisateur.id)
  })
})

router.post('/notifications/lues', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) return res.status(204).end()

  await marquerToutesLues(req.utilisateur.id)
  res.status(204).end()
})

export default router
