import { db } from '../config/db.js'

// Accès à la table messages_contact (messages envoyés par le formulaire de contact).

export async function creerMessage({ nom, email, sujet, message, dateEnvoi }) {
  await db.query(
    `INSERT INTO messages_contact (nom, email, sujet, message, date_envoi, lu)
     VALUES (?, ?, ?, ?, ?, false)`,
    [nom, email, sujet, message, dateEnvoi]
  )
}

export async function listerMessages() {
  const { rows } = await db.query('SELECT * FROM messages_contact ORDER BY date_envoi DESC')
  return rows
}

// Renvoie le message modifié, ou undefined s'il n'existe pas.
// MariaDB ne sait pas renvoyer la ligne modifiée (pas de UPDATE … RETURNING) : on la relit.
export async function marquerLu(id, lu) {
  await db.query('UPDATE messages_contact SET lu = ? WHERE id = ?', [lu, id])
  const { rows } = await db.query('SELECT * FROM messages_contact WHERE id = ?', [id])
  return rows[0]
}

// Renvoie true si un message a bien été supprimé.
export async function supprimerMessage(id) {
  const { rowCount } = await db.query('DELETE FROM messages_contact WHERE id = ?', [id])
  return rowCount > 0
}
