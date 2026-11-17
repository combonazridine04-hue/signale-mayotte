// Partenaires affichés sur la page d'accueil (« Ils agissent avec nous »), pour tous les
// visiteurs. Pour en ajouter un : une ligne de plus ici.
//
// logo : facultatif. Déposer le fichier dans frontend/public/partenaires/ (PNG à fond
// transparent de préférence) et indiquer son chemin, ex. '/partenaires/edm.png'.
// couleur : la couleur principale du logo. Elle teinte la carte du partenaire pour
// qu'on le reconnaisse d'un coup d'œil.
export const PARTENAIRES = [
  {
    nom: 'EDM',
    description: 'Électricité de Mayotte',
    domaine: 'Éclairage public',
    site: 'https://www.electricitedemayotte.com',
    logo: '/partenaires/edm.png',
    couleur: '#0089d0'
  },
  {
    // SMAE = l'ancien service eau de SOGEA Mayotte (même entreprise depuis 2014).
    nom: 'SMAE',
    description: 'Société Mahoraise des Eaux',
    domaine: 'Eau',
    site: 'https://www.mahoraisedeseaux.com',
    logo: '/partenaires/smae.png',
    couleur: '#1d4f9c'
  },
  {
    nom: 'SIDEVAM976',
    description: 'Déchets ménagers de Mayotte',
    domaine: 'Déchets',
    site: 'https://sidevam976.fr',
    logo: '/partenaires/sidevam976.png',
    couleur: '#5c9e21'
  },
  {
    nom: 'Département',
    description: 'Conseil départemental de Mayotte',
    domaine: 'Voirie',
    site: 'https://www.mayotte.fr',
    logo: '/partenaires/departement.png',
    couleur: '#d62a24'
  },
  {
    nom: 'Mairies',
    description: 'Les 17 communes de Mayotte',
    domaine: 'Tous les problèmes',
    site: '',
    // Pas de logo commun aux 17 communes : celui de la Ville de Mamoudzou, chef-lieu.
    logo: '/partenaires/mamoudzou.png',
    couleur: '#24408e'
  }
]
