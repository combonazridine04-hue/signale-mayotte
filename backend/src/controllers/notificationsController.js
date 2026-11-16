import { listerNotifications, compterNonLues, marquerToutesLues } from '../services/notificationService.js'

export const mesNotifications = async (req, res) => {
  // Les notifications appartiennent aux comptes citoyens ; un admin n'en a pas.
  if (!req.utilisateur) return res.json({ notifications: [], nonLues: 0 })

  res.json({
    notifications: await listerNotifications(req.utilisateur.id),
    nonLues: await compterNonLues(req.utilisateur.id)
  })
}

export const marquerLues = async (req, res) => {
  if (!req.utilisateur) return res.status(204).end()

  await marquerToutesLues(req.utilisateur.id)
  res.status(204).end()
}
