import { db } from '../config/db.js'

// Accès à la table mises_a_jour (suivi officiel publié sur un signalement).

export async function creerMiseAJour(signalementId, texte) {
  const { rows } = await db.query(
    'INSERT INTO mises_a_jour (signalement_id, texte, date_creation) VALUES (?, ?, ?) RETURNING *',
    [signalementId, texte, new Date().toISOString()]
  )
  return rows[0]
}

// Renvoie true si une mise à jour de ce signalement a bien été supprimée.
export async function supprimerMiseAJour(id, signalementId) {
  const { rowCount } = await db.query('DELETE FROM mises_a_jour WHERE id = ? AND signalement_id = ?', [
    id,
    signalementId
  ])
  return rowCount > 0
}

export async function listerMisesAJour(signalementId) {
  const { rows } = await db.query('SELECT * FROM mises_a_jour WHERE signalement_id = ? ORDER BY date_creation DESC', [
    signalementId
  ])
  return rows
}
