const METHODES_SANS_EFFET = new Set(['GET', 'HEAD', 'OPTIONS'])

// Deuxième barrière anti-CSRF, en plus de SameSite=Strict : toute requête qui modifie
// quelque chose doit venir du site lui-même. Les navigateurs récents le disent dans
// Sec-Fetch-Site, les plus anciens dans Origin. Sans aucun des deux, ce n'est pas un
// navigateur (tests, curl) : il n'a pas de cookie de session volé à faire jouer.
export function verifierOrigine(req, res, next) {
  if (METHODES_SANS_EFFET.has(req.method)) return next()

  const site = req.get('sec-fetch-site')
  if (site) {
    if (site === 'same-origin' || site === 'none') return next()
    return res.status(403).json({ erreur: 'Requête refusée : elle ne provient pas du site.' })
  }

  const origine = req.get('origin')
  if (!origine) return next()
  try {
    if (new URL(origine).host === req.get('host')) return next()
  } catch {
    // Origin illisible : refusée ci-dessous.
  }
  return res.status(403).json({ erreur: 'Requête refusée : elle ne provient pas du site.' })
}
