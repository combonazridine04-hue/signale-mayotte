// CORS : le front-end est hébergé à une autre adresse que l'API. Le navigateur n'autorise
// sa page à lire les réponses de l'API (et à y joindre le cookie de session) que si l'API
// le permet explicitement, pour cette adresse précise.
//
// FRONTEND_URL : adresse(s) exacte(s) du front, séparées par des virgules, sans « / »
// final. Ex. https://signale.alwaysdata.net. Aucune autre origine n'est acceptée : jamais
// de « * », qui est de toute façon interdit avec les cookies.

const ORIGINES_AUTORISEES = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map((adresse) => adresse.trim().replace(/\/$/, ''))
    .filter(Boolean)
)

export function origineAutorisee(origine) {
  return Boolean(origine) && ORIGINES_AUTORISEES.has(origine)
}

export function cors(req, res, next) {
  const origine = req.get('origin')
  // La réponse dépend de l'origine : un cache intermédiaire ne doit pas la resservir à
  // une autre page.
  res.vary('Origin')

  if (origineAutorisee(origine)) {
    res.set('Access-Control-Allow-Origin', origine)
    res.set('Access-Control-Allow-Credentials', 'true')

    // Requête préalable (« preflight ») envoyée par le navigateur avant un POST JSON,
    // un PATCH, un DELETE… : on répond tout de suite, sans exécuter de route.
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
      res.set('Access-Control-Allow-Headers', 'Content-Type')
      res.set('Access-Control-Max-Age', '600')
      return res.status(204).end()
    }
  }
  next()
}
