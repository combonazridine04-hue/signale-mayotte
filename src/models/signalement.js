export const CATEGORIES = [
  'Dépôt sauvage / déchets',
  'Voirie',
  'Éclairage public',
  'Eau',
  'Autre'
]

export const COMMUNES = [
  'Acoua',
  'Bandraboua',
  'Bandrélé',
  'Bouéni',
  'Chiconi',
  'Chirongui',
  'Dembéni',
  'Dzaoudzi',
  'Kani-Kéli',
  'Koungou',
  'Mamoudzou',
  'Mtsamboro',
  'Mtsangamouji',
  'Ouangani',
  'Pamandzi',
  'Sada',
  'Tsingoni'
]

export const STATUTS = ['Signalé', 'En cours', 'Résolu']

// Organismes compétents pour certaines catégories, en plus du signalement à la commune.
// Coordonnées vérifiées sur les sites officiels (à recontrôler périodiquement, ça peut changer).
export const ORGANISME_PAR_CATEGORIE = {
  Eau: {
    nom: 'SMAE — Société Mahoraise des Eaux',
    telephone: '0269 61 11 42',
    urgence: '0269 61 14 55',
    site: 'https://www.mahoraisedeseaux.com'
  },
  'Dépôt sauvage / déchets': {
    nom: 'SIDEVAM976',
    telephone: '0269 62 07 84',
    site: 'https://sidevam976.fr'
  },
  'Éclairage public': {
    nom: 'EDM — Électricité de Mayotte',
    urgence: '0269 62 50 05',
    site: 'https://www.electricitedemayotte.com'
  },
  Voirie: {
    nom: 'Conseil départemental de Mayotte',
    telephone: '0269 66 10 00',
    site: 'https://www.mayotte.fr',
    note: 'Pour une route communale (la plupart des rues en ville), contactez plutôt votre mairie.'
  }
}
