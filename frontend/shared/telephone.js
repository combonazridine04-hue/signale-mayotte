// Numéros de téléphone mahorais, partagé entre le client (validation immédiate) et le
// serveur (validation finale) : une seule définition, donc pas de règle qui diverge.
//
// À Mayotte : fixe 0269 XX XX XX, mobile 0639 XX XX XX. Beaucoup d'habitants gardent
// aussi un mobile métropolitain (06/07), on ne les rejette donc pas : on exige un
// numéro français à 10 chiffres et on signale seulement le format attendu.

export const LONGUEUR_TELEPHONE = 10

/** Ne garde que les chiffres et ramène +262 / 00262 à la forme locale 0XXXXXXXXX. */
export function normaliserTelephone(valeur) {
  if (typeof valeur !== 'string') return ''
  let chiffres = valeur.replace(/\D/g, '')
  if (chiffres.startsWith('00262')) chiffres = chiffres.slice(5)
  else if (chiffres.startsWith('262') && chiffres.length > LONGUEUR_TELEPHONE) chiffres = chiffres.slice(3)
  if (chiffres.length === 9 && !chiffres.startsWith('0')) chiffres = `0${chiffres}`
  return chiffres.slice(0, LONGUEUR_TELEPHONE)
}

/** Affichage lisible : 0639065031 -> « 06 39 06 50 31 ». */
export function formaterTelephone(valeur) {
  const chiffres = normaliserTelephone(valeur)
  return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

export function telephoneValide(valeur) {
  return /^0[1-9]\d{8}$/.test(normaliserTelephone(valeur))
}

/** Message d'aide affiché sous le champ tant que la saisie est incomplète. */
export function erreurTelephone(valeur) {
  const chiffres = normaliserTelephone(valeur)
  if (!chiffres) return ''
  if (chiffres.length < LONGUEUR_TELEPHONE) {
    const manquants = LONGUEUR_TELEPHONE - chiffres.length
    return `Il manque ${manquants} chiffre${manquants > 1 ? 's' : ''} (10 au total, ex. 06 39 06 50 31).`
  }
  if (!telephoneValide(chiffres)) return 'Le numéro doit commencer par 0 (ex. 06 39 06 50 31 ou 02 69 60 00 00).'
  return ''
}
