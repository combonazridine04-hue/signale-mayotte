const formateurRelatif = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const formateurDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE
const SEMAINE = 7 * JOUR
const MOIS = 30 * JOUR

// "il y a 3 jours" parle beaucoup plus qu'une date brute sur une plateforme de suivi :
// l'ancienneté d'un signalement non résolu est l'information la plus utile au citoyen.
export function dateRelative(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''

  const ecart = Date.now() - date.getTime()

  if (ecart < MINUTE) return "à l'instant"
  if (ecart < HEURE) return formateurRelatif.format(-Math.floor(ecart / MINUTE), 'minute')
  if (ecart < JOUR) return formateurRelatif.format(-Math.floor(ecart / HEURE), 'hour')
  if (ecart < SEMAINE) return formateurRelatif.format(-Math.floor(ecart / JOUR), 'day')
  if (ecart < MOIS) return formateurRelatif.format(-Math.floor(ecart / SEMAINE), 'week')

  // Au-delà d'un mois, la date exacte redevient plus lisible que "il y a 7 semaines".
  return `le ${formateurDate.format(date)}`
}

export function dateComplete(valeur) {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR')
}
