// Périmètre d'un partenaire : une commune (ou toutes) ET des domaines (ou tous).
// Ex. SIDEVAM976 : toutes les communes, domaine « Dépôt sauvage / déchets ».
// Partagé entre le navigateur (griser ce qui n'est pas à lui) et le serveur (refuser).
export function dansLePerimetre(partenaire, signalement) {
  const communeOk = !partenaire.commune || partenaire.commune === signalement.commune
  const categories = partenaire.categories || []
  const domaineOk = categories.length === 0 || categories.includes(signalement.categorie)
  return communeOk && domaineOk
}

export function libellePerimetre(partenaire) {
  const categories = partenaire.categories || []
  const domaines = categories.length ? categories.join(', ') : 'tous les domaines'
  return `${domaines} · ${partenaire.commune || 'toutes les communes'}`
}
