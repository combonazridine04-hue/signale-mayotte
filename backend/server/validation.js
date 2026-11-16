// Contrôles de format communs à plusieurs routes.

// Plus grand entier accepté par une colonne SERIAL (INTEGER Postgres).
const ID_MAX = 2147483647

// Identifiant lu dans l'URL ou le corps : un entier positif, sinon null. Sans ce
// contrôle, « /signalements/abc » arrivait jusqu'à Postgres sous la forme NaN, qui la
// refusait : l'utilisateur recevait une erreur 500 au lieu d'un simple « introuvable ».
export function idValide(valeur) {
  const id = Number(valeur)
  return Number.isInteger(id) && id > 0 && id <= ID_MAX ? id : null
}

// À placer sur router.param : toute route utilisant ce paramètre répond 404 si
// l'identifiant n'a pas le bon format, sans atteindre la base.
export function verifierParametreId(messageIntrouvable) {
  return (req, res, next, valeur) => {
    if (idValide(valeur) === null) return res.status(404).json({ erreur: messageIntrouvable })
    next()
  }
}

// Un champ de formulaire attendu comme texte. Un client peut envoyer un nombre, un
// tableau ou un objet à la place : .trim() plantait alors avec une erreur 500.
export function texte(valeur) {
  return typeof valeur === 'string' ? valeur : ''
}

export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailValide(email) {
  return typeof email === 'string' && email.length <= 254 && REGEX_EMAIL.test(email)
}
