// Adresse du back-end (l'API Express), définie au build par VITE_API_URL.
//
// - En développement, elle reste vide : le serveur Vite relaie /api et /uploads vers le
//   back-end (voir vite.config.js), comme si tout était à la même adresse.
// - En production chez alwaysdata, elle reste vide aussi : le site du front et celui de
//   l'API partagent la même adresse (l'API répond sur /api et /uploads).
// - Si un jour l'API est hébergée à une autre adresse, VITE_API_URL la contient,
//   par ex. https://api.exemple.fr (sans « / » final).
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
