import { origineAutorisee } from './cors.js'

const METHODES_SANS_EFFET = new Set(['GET', 'HEAD', 'OPTIONS'])

// Barrière anti-CSRF : toute requête qui modifie quelque chose doit venir du site
// lui-même, c'est-à-dire de l'API (même adresse) ou du front-end déclaré dans
// FRONTEND_URL. Les navigateurs récents donnent la provenance dans Sec-Fetch-Site, tous
// dans Origin. Sans aucun des deux, ce n'est pas un navigateur (tests, curl) : il n'a pas
// de cookie de session volé à faire jouer.
//
// Cette barrière est indispensable quand le front est à une autre adresse : le cookie de
// session est alors en SameSite=None et ne protège plus seul contre le CSRF.
export function verifierOrigine(req, res, next) {
  if (METHODES_SANS_EFFET.has(req.method)) return next()

  const origine = req.get('origin')
  const site = req.get('sec-fetch-site')

  if (site === 'same-origin' || site === 'none') return next()
  if (origineAutorisee(origine)) return next()
  if (!site && !origine) return next()

  if (!site && origine) {
    try {
      if (new URL(origine).host === req.get('host')) return next()
    } catch {
      // Origin illisible : refusée ci-dessous.
    }
  }
  return res.status(403).json({ erreur: 'Requête refusée : elle ne provient pas du site.' })
}
