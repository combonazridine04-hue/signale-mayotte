import { journaliser } from './journalService.js'

// Vérification anti-robot (Cloudflare Turnstile) des formulaires publics.
//
// Le navigateur affiche le widget Turnstile, qui lui remet un jeton à usage unique. Ce
// jeton ne prouve rien tant que le serveur ne l'a pas fait valider par Cloudflare avec la
// clé SECRÈTE : un robot qui appelle l'API directement, sans passer par la page, n'en a
// pas, et un jeton inventé est refusé par Cloudflare.
//
// Sans les deux clés, la vérification est désactivée (développement, tests) : le site
// fonctionne, protégé seulement par les limiteurs de débit et le champ piège.

const URL_VERIFICATION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const DELAI_MS = 8000

function configuration() {
  const cleSite = process.env.TURNSTILE_SITE_KEY || ''
  const cleSecrete = process.env.TURNSTILE_SECRET_KEY || ''
  return { cleSite, cleSecrete, actif: Boolean(cleSite && cleSecrete) }
}

// Ce que le navigateur a besoin de savoir. La clé de site est publique par nature (elle
// est visible dans la page) ; la clé secrète ne quitte jamais le serveur.
export function configurationPublique() {
  const { cleSite, actif } = configuration()
  return actif ? { actif: true, cleSite } : { actif: false }
}

/**
 * Demande à Cloudflare si le jeton est valide.
 * @returns {Promise<'valide'|'invalide'|'indisponible'>}
 */
export async function verifierJeton(jeton, ip) {
  const { cleSecrete } = configuration()
  if (typeof jeton !== 'string' || !jeton || jeton.length > 2048) return 'invalide'

  const corps = new URLSearchParams({ secret: cleSecrete, response: jeton })
  if (ip) corps.set('remoteip', ip)

  try {
    const reponse = await fetch(URL_VERIFICATION, {
      method: 'POST',
      body: corps,
      signal: AbortSignal.timeout(DELAI_MS)
    })
    if (!reponse.ok) return 'indisponible'
    const resultat = await reponse.json()
    return resultat.success === true ? 'valide' : 'invalide'
  } catch {
    return 'indisponible'
  }
}

// Middleware à placer sur chaque route publique sensible. Le jeton arrive dans le champ
// « captcha » du corps JSON.
export async function exigerCaptcha(req, res, next) {
  if (!configuration().actif) return next()

  const verdict = await verifierJeton(req.body?.captcha, req.ip)
  if (verdict === 'valide') return next()

  if (verdict === 'indisponible') {
    // Fermé par défaut : si Cloudflare ne répond pas, on refuse plutôt que de laisser
    // passer les robots. Le message invite simplement à réessayer.
    return res
      .status(503)
      .json({ erreur: 'Vérification anti-robot momentanément indisponible. Réessayez dans un instant.', captcha: true })
  }

  journaliser(req, 'captcha.echec', { resultat: 'echec', details: { route: req.originalUrl } })
  res
    .status(400)
    .json({ erreur: 'Vérification anti-robot échouée. Cochez à nouveau la case puis réessayez.', captcha: true })
}
