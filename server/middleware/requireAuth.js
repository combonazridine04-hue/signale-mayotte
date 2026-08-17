import { sessionValide } from '../auth.js'

export function requireAuth(req, res, next) {
  const enTete = req.headers.authorization || ''
  const token = enTete.startsWith('Bearer ') ? enTete.slice(7) : ''

  const session = sessionValide(token)
  if (!session) {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  req.admin = { id: session.adminId, identifiant: session.identifiant }
  next()
}
