// Force du mot de passe, partagée client/serveur.
//
// Choix assumé : on BLOQUE seulement ce qui est réellement dangereux (trop court, ou
// mot de passe archi-connu). Le reste est un CONSEIL affiché à la saisie. Ce site
// s'adresse à tous les habitants, pas à des informaticiens : une règle « 1 majuscule,
// 1 chiffre et 1 symbole obligatoires » fait surtout fuir les gens ou leur fait écrire
// leur mot de passe sur un papier.

export const LONGUEUR_MINIMALE = 8

// Les mots de passe les plus testés en premier lors d'une attaque, plus les variantes
// locales évidentes.
const TROP_COURANTS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'azertyui',
  'azerty123',
  'qwertyui',
  'motdepasse',
  'password',
  'password1',
  'passw0rd',
  'iloveyou',
  'sunshine',
  'mayotte',
  'mayotte976',
  'mamoudzou',
  'signalement',
  'abcd1234',
  '00000000',
  '11111111',
  'aaaaaaaa'
])

export function motDePasseInterdit(motDePasse) {
  if (typeof motDePasse !== 'string') return 'Mot de passe invalide.'
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`
  }
  if (TROP_COURANTS.has(motDePasse.toLowerCase().replace(/\s+/g, ''))) {
    return 'Ce mot de passe est trop courant, il serait deviné immédiatement. Choisissez-en un autre.'
  }
  return ''
}

/** Renvoie { score: 0..4, libelle, conseil } pour la jauge affichée sous le champ. */
export function forceMotDePasse(motDePasse) {
  const valeur = typeof motDePasse === 'string' ? motDePasse : ''
  if (!valeur) return { score: 0, libelle: '', conseil: '' }

  const criteres = {
    longueur: valeur.length >= LONGUEUR_MINIMALE,
    longue: valeur.length >= 12,
    casse: /[a-z]/.test(valeur) && /[A-Z]/.test(valeur),
    chiffre: /\d/.test(valeur),
    symbole: /[^\w\s]/.test(valeur)
  }

  let score = Object.values(criteres).filter(Boolean).length
  if (!criteres.longueur || TROP_COURANTS.has(valeur.toLowerCase())) score = Math.min(score, 1)
  score = Math.max(1, Math.min(4, score))

  const conseils = []
  if (!criteres.longue) conseils.push('allongez-le (12 caractères ou plus)')
  if (!criteres.casse) conseils.push('mélangez majuscules et minuscules')
  if (!criteres.chiffre) conseils.push('ajoutez un chiffre')
  if (!criteres.symbole) conseils.push('ajoutez un signe de ponctuation')

  const libelles = ['', 'Trop faible', 'Faible', 'Correct', 'Solide']
  return {
    score,
    libelle: libelles[score],
    conseil: score >= 4 ? '' : `Pour le renforcer : ${conseils.slice(0, 2).join(', ')}.`
  }
}
