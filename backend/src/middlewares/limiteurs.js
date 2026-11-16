import { rateLimit } from 'express-rate-limit'

// Limites de débit des routes de participation. Elles protègent contre le spam et le
// remplissage automatique, sans gêner un usage normal.

function limiteur(windowMs, limit, message) {
  return rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { erreur: message } })
}

export const limiteurCreation = limiteur(60 * 60 * 1000, 5, 'Trop de signalements envoyés, réessayez plus tard.')
export const limiteurSoutien = limiteur(15 * 60 * 1000, 60, 'Trop de demandes, réessayez plus tard.')
export const limiteurCommentaire = limiteur(15 * 60 * 1000, 20, 'Trop de commentaires envoyés, réessayez plus tard.')
