import { revoquerSession, sessionValide } from './auth.js'

// Le jeton de session voyage dans un cookie que le JavaScript de la page ne peut pas lire
// (HttpOnly) : une faille XSS ne permet plus de le voler, alors qu'il était auparavant
// rangé dans sessionStorage, accessible à n'importe quel script.
// - Secure : jamais envoyé en clair (HTTP). Omis en local, où le site tourne en HTTP.
// - SameSite=Strict : jamais joint à une requête partie d'un autre site (anti-CSRF).
// - Préfixe __Host- (en HTTPS) : le navigateur refuse qu'un sous-domaine le pose ou
//   l'écrase, et impose Secure + Path=/ sans Domain.
// - Pas de date d'expiration : il disparaît à la fermeture du navigateur (important sur
//   un ordinateur partagé), et le serveur le périme de toute façon au bout de 12 h.
const NOM_HTTPS = '__Host-sm_session'
const NOM_HTTP = 'sm_session'

function nomCookie(req) {
  return req.secure ? NOM_HTTPS : NOM_HTTP
}

function options(req) {
  return { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/' }
}

export function jetonDeLaRequete(req) {
  const nom = nomCookie(req)
  for (const morceau of (req.headers.cookie || '').split(';')) {
    const egal = morceau.indexOf('=')
    if (egal === -1) continue
    if (morceau.slice(0, egal).trim() === nom) return decodeURIComponent(morceau.slice(egal + 1).trim())
  }
  return ''
}

export function sessionDeLaRequete(req) {
  return sessionValide(jetonDeLaRequete(req))
}

// Un navigateur n'a qu'une identité à la fois : se connecter ferme la session précédente
// (autre compte, ou autre type de compte) au lieu de la laisser vivre en mémoire.
export function ouvrirSession(req, res, jeton) {
  revoquerSession(jetonDeLaRequete(req))
  res.cookie(nomCookie(req), jeton, options(req))
}

export function fermerSession(req, res) {
  revoquerSession(jetonDeLaRequete(req))
  res.clearCookie(nomCookie(req), options(req))
}
