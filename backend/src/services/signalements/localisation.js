// Contrôle de la position d'un signalement.

// Rectangle englobant Grande-Terre, Petite-Terre et les îlots, avec une marge. Il sert
// à écarter les positions absurdes (0,0, autre continent, valeurs inversées), pas à
// tracer la côte au mètre près.
const MAYOTTE = { latMin: -13.1, latMax: -12.55, lonMin: 44.9, lonMax: 45.4 }

// Renvoie { latitude, longitude } (null/null si aucune position n'est fournie), ou
// { erreur } si la position est incomplète, illisible ou hors de Mayotte.
// Sans ce contrôle, « abc » devenait NaN, que Postgres accepte dans une colonne
// DOUBLE PRECISION : le signalement s'enregistrait, puis faisait planter la carte
// de tous les visiteurs au moment de placer son marqueur.
export function lirePosition(latitudeBrute, longitudeBrute) {
  const fournie = (v) => v !== undefined && v !== null && v !== ''
  if (!fournie(latitudeBrute) && !fournie(longitudeBrute)) return { latitude: null, longitude: null }
  if (!fournie(latitudeBrute) || !fournie(longitudeBrute)) {
    return { erreur: 'Position incomplète : latitude et longitude sont nécessaires.' }
  }

  const latitude = Number(latitudeBrute)
  const longitude = Number(longitudeBrute)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { erreur: 'Position invalide.' }
  }
  const dansMayotte =
    latitude >= MAYOTTE.latMin &&
    latitude <= MAYOTTE.latMax &&
    longitude >= MAYOTTE.lonMin &&
    longitude <= MAYOTTE.lonMax
  if (!dansMayotte) {
    return { erreur: 'La position choisie est en dehors de Mayotte. Placez le repère sur la carte de Mayotte.' }
  }
  return { latitude, longitude }
}
