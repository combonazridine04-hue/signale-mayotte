import { db } from '../config/db.js'

// Accès à la table signalements_abus (contenus signalés comme abusifs par les citoyens).

// Lève une erreur de code ER_DUP_ENTRY si ce compte a déjà signalé ce contenu.
export async function creer({ type, cibleId, motif, utilisateurId }) {
  await db.query(
    'INSERT INTO signalements_abus (type, cible_id, motif, utilisateur_id, date_creation) VALUES (?, ?, ?, ?, ?)',
    [type, cibleId, motif, utilisateurId, new Date().toISOString()]
  )
}

// Un groupe par contenu visé, le plus récemment signalé d'abord.
export async function listerParCible() {
  const { rows } = await db.query(`
    SELECT type, cible_id, COUNT(*) AS nb_signalements, MAX(date_creation) AS dernier_signalement,
           JSON_ARRAYAGG(NULLIF(motif, '')) AS motifs
    FROM signalements_abus
    GROUP BY type, cible_id
    ORDER BY dernier_signalement DESC
  `)
  return rows
}

// Renvoie le nombre de signalements d'abus retirés pour ce contenu.
export async function supprimerPourCible(type, cibleId) {
  const { rowCount } = await db.query('DELETE FROM signalements_abus WHERE type = ? AND cible_id = ?', [type, cibleId])
  return rowCount
}
