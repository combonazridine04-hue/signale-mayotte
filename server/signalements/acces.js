import crypto from 'node:crypto'
import { sessionValide } from '../auth.js'

// Qui a le droit de faire quoi sur un signalement.

// Champ piège invisible : un visiteur humain ne le remplit jamais, un bot qui
// remplit tous les champs automatiquement si.
export function estUnRobot(req) {
  return Boolean(req.body?.site_web)
}

// Identifie un visiteur sans conserver son adresse IP en clair.
export function hasherIp(req) {
  return crypto.createHash('sha256').update(`signale-mayotte-soutien:${req.ip}`).digest('hex')
}

// Session facultative : certaines routes publiques affichent plus d'informations à
// l'auteur ou à l'admin, sans pour autant exiger d'être connecté.
export function sessionDeLaRequete(req) {
  const entete = req.headers.authorization || ''
  const token = entete.startsWith('Bearer ') ? entete.slice(7) : ''
  return sessionValide(token)
}

// Autorisé si connecté en admin, si c'est le compte citoyen créateur, OU si le token secret
// de suppression (donné au créateur anonyme historique, jamais exposé ailleurs) correspond.
export function estAutoriseASupprimer(req, existant) {
  const session = sessionDeLaRequete(req)
  if (session?.type === 'admin') return true
  if (session?.type === 'utilisateur' && session.utilisateurId === existant.utilisateur_id) return true

  const tokenSuppression = req.query.token || req.body?.token
  return Boolean(tokenSuppression) && tokenSuppression === existant.token_suppression
}

// L'auteur peut corriger son signalement (faute de frappe, mauvaise commune...) tant
// qu'il est encore « Signalé ». Dès qu'il est pris en charge, les services travaillent
// dessus : le contenu ne doit plus changer sous leurs yeux. L'admin reste libre de corriger.
export function estAutoriseAModifier(req, existant) {
  const session = sessionDeLaRequete(req)
  if (session?.type === 'admin') return true
  if (existant.statut !== 'Signalé') return false
  if (session?.type === 'utilisateur' && session.utilisateurId === existant.utilisateur_id) return true

  const tokenSuppression = req.query.token || req.body?.token
  return Boolean(tokenSuppression) && tokenSuppression === existant.token_suppression
}
