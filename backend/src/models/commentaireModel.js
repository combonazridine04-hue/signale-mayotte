import { db } from '../config/db.js'

// Accès à la table commentaires (commentaires et réponses sur un signalement).

// Commentaires d'un signalement, du plus ancien au plus récent, avec le pseudo, le nom et
// la photo ACTUELS de leur auteur (il a pu les changer depuis).
export async function listerParSignalement(signalementId) {
  const { rows } = await db.query(
    `SELECT c.*, u.pseudo AS auteur_pseudo_actuel, u.nom AS auteur_nom_actuel, u.avatar_url AS auteur_avatar_actuel
     FROM commentaires c
     LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
     WHERE c.signalement_id = ?
     ORDER BY c.date_creation ASC`,
    [signalementId]
  )
  return rows
}

// Commentaire visé par une réponse, seulement s'il appartient à CE signalement, avec
// l'email de son auteur (pour le prévenir) : ou undefined.
export async function trouverParent(id, signalementId) {
  const { rows } = await db.query(
    `SELECT c.id, c.parent_id, c.utilisateur_id, u.email AS email_auteur, u.email_verifie
       FROM commentaires c
       LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
       WHERE c.id = ? AND c.signalement_id = ?`,
    [id, signalementId]
  )
  return rows[0]
}

// Auteur d'un commentaire de ce signalement : { utilisateur_id } ou undefined.
export async function trouverAuteur(id, signalementId) {
  const { rows } = await db.query('SELECT utilisateur_id FROM commentaires WHERE id = ? AND signalement_id = ?', [
    id,
    signalementId
  ])
  return rows[0]
}

// Texte du commentaire, pour l'alerte de modération : ou undefined.
export async function trouverExtrait(id) {
  const { rows } = await db.query('SELECT signalement_id, texte AS extrait FROM commentaires WHERE id = ?', [id])
  return rows[0]
}

// Aperçu affiché dans la liste des contenus signalés comme abusifs : ou undefined.
export async function trouverApercu(id) {
  const { rows } = await db.query('SELECT id, auteur, texte, signalement_id FROM commentaires WHERE id = ?', [id])
  return rows[0]
}

export async function creer({ signalementId, auteur, texte, utilisateurId, parentId }) {
  const { rows } = await db.query(
    'INSERT INTO commentaires (signalement_id, auteur, texte, date_creation, utilisateur_id, parent_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    [signalementId, auteur, texte, new Date().toISOString(), utilisateurId, parentId]
  )
  return rows[0]
}

// Supprime aussi ses réponses (ON DELETE CASCADE).
export async function supprimer(id) {
  await db.query('DELETE FROM commentaires WHERE id = ?', [id])
}
