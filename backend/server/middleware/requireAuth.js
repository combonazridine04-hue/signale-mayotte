import { sessionDeLaRequete } from '../sessionCookie.js'

export function requireAuth(req, res, next) {
  const session = sessionDeLaRequete(req)
  if (!session || session.type !== 'admin') {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  req.admin = { id: session.adminId, identifiant: session.identifiant }
  next()
}

// Autorise un compte citoyen connecté OU un admin (l'admin peut tout faire).
export function requireAuthUtilisateur(req, res, next) {
  const session = sessionDeLaRequete(req)
  if (!session) {
    return res.status(401).json({ erreur: 'Vous devez être connecté.' })
  }

  if (session.type === 'admin') {
    req.admin = { id: session.adminId, identifiant: session.identifiant }
  } else if (session.type === 'utilisateur') {
    req.utilisateur = { id: session.utilisateurId, nom: session.nom }
  } else {
    // Un partenaire n'est ni un citoyen ni un admin : les routes qui exigent
    // spécifiquement un compte citoyen restent fermées.
    return res.status(401).json({ erreur: 'Vous devez être connecté.' })
  }
  next()
}

// Autorise un admin (tous droits) ou un partenaire (droit limité à changer le statut
// des signalements de sa commune — voir la vérification dans la route elle-même).
export function requirePartenaireOuAdmin(req, res, next) {
  const session = sessionDeLaRequete(req)
  if (!session || (session.type !== 'admin' && session.type !== 'partenaire')) {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  if (session.type === 'admin') {
    req.admin = { id: session.adminId, identifiant: session.identifiant }
  } else {
    req.partenaire = {
      id: session.partenaireId,
      nom: session.nom,
      commune: session.commune,
      categories: session.categories || [],
      depuis: session.depuis
    }
  }
  next()
}
