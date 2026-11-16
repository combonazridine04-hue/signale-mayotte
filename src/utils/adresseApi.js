// Adresse du back-end (l'API Express), définie au build par VITE_API_URL.
//
// - En développement, elle reste vide : le serveur Vite relaie /api et /uploads vers le
//   back-end (voir vite.config.js), comme si tout était à la même adresse.
// - En production, le front et l'API sont hébergés séparément : VITE_API_URL contient
//   l'adresse de l'API, par ex. https://signale-api.alwaysdata.net (sans « / » final).
export const ADRESSE_API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/**
 * Appel à l'API. `chemin` commence toujours par /api/…
 * credentials: 'include' : le navigateur joint le cookie de session (HttpOnly, illisible
 * par le JavaScript) même quand l'API est à une autre adresse que le site.
 */
export function fetchApi(chemin, options = {}) {
  return fetch(ADRESSE_API + chemin, { credentials: 'include', ...options })
}

/**
 * Adresse affichable d'un média renvoyé par l'API. Les photos et avatars sont stockés par
 * l'API sous la forme /uploads/… : il faut les demander à l'API, pas au site. Les autres
 * valeurs (aperçus blob:, adresses complètes, vide) sont rendues telles quelles.
 */
export function urlMedia(url) {
  return typeof url === 'string' && url.startsWith('/') ? ADRESSE_API + url : url || ''
}
