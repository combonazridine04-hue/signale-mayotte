import { sessionValide } from '../auth.js'

function extraireToken(req) {
  const enTete = req.headers.authorization || ''
  return enTete.startsWith('Bearer ') ? enTete.slice(7) : ''
}

export function requireAuth(req, res, next) {
  const session = sessionValide(extraireToken(req))
  if (!session || session.type !== 'admin') {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  req.admin = { id: session.adminId, identifiant: session.identifiant }
  next()
}

// Autorise un compte citoyen connecté OU un admin (l'admin peut tout faire).
export function requireAuthUtilisateur(req, res, next) {
  const session = sessionValide(extraireToken(req))
  if (!session) {
    return res.status(401).json({ erreur: 'Vous devez être connecté.' })
  }

  if (session.type === 'admin') {
    req.admin = { id: session.adminId, identifiant: session.identifiant }
  } else {
    req.utilisateur = { id: session.utilisateurId, nom: session.nom }
  }
  next()
}
