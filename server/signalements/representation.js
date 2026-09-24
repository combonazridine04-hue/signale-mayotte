import { nomPublic } from '../../shared/nomPublic.js'

// Conversion des lignes de la base en objets renvoyés par l'API. C'est ici, et nulle
// part ailleurs, que se décide ce qui est exposé publiquement : un champ absent de ces
// fonctions ne peut pas fuiter par mégarde dans une réponse.

export function mapRow(row, avecAuteur = false, utilisateurId = null) {
  const base = {
    id: row.id,
    categorie: row.categorie,
    commune: row.commune,
    description: row.description,
    photoUrls: row.photos || [],
    photoResolution: row.photo_resolution || '',
    statut: row.statut,
    dateSignalement: row.date_signalement,
    dateResolution: row.date_resolution || '',
    dateModification: row.date_modification || '',
    latitude: row.latitude,
    longitude: row.longitude,
    nbSoutiens: row.nb_soutiens || 0,
    urgent: Boolean(row.urgent),
    // Permet au client de proposer la correction à l'auteur, sans révéler qui sont
    // les auteurs des autres signalements.
    estMien: Boolean(utilisateurId && row.utilisateur_id === utilisateurId)
  }
  // Identité du créateur : jamais publique, visible uniquement par l'admin (traçabilité anti-abus).
  if (avecAuteur) {
    base.auteurNom = row.auteur_nom || null
    base.auteurEmail = row.auteur_email || null
    base.auteurTelephone = row.auteur_telephone || null
  }
  return base
}

export function mapMiseAJour(row) {
  return { id: row.id, texte: row.texte, dateCreation: row.date_creation }
}

export function mapCommentaire(row, utilisateurId = null) {
  // Si l'auteur a un compte encore actif, on affiche son pseudo/nom/avatar ACTUELS (pas
  // celui au moment du commentaire) : changer son profil doit s'appliquer à tout l'historique.
  // Le pseudo est affiché tel quel ; un vrai nom est toujours abrégé en « Prénom N. ».
  const auteur = row.auteur_pseudo_actuel || nomPublic(row.auteur_nom_actuel || row.auteur)
  return {
    id: row.id,
    parentId: row.parent_id || null,
    auteur,
    auteurAvatarUrl: row.auteur_avatar_actuel || null,
    texte: row.texte,
    dateCreation: row.date_creation,
    // Permet au client de proposer la suppression sans révéler l'identité des autres auteurs.
    estMien: Boolean(utilisateurId && row.utilisateur_id === utilisateurId)
  }
}
