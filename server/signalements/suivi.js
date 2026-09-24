import { db } from '../db.js'

// À qui écrire pour les nouvelles d'un signalement : l'email de contact laissé
// volontairement, sinon l'adresse du compte — et seulement si elle a été vérifiée,
// une adresse mal saisie pouvant appartenir à quelqu'un d'autre.
export async function emailSuiviSignalement(signalementId) {
  const { rows } = await db.query(
    `SELECT s.email_contact, u.email AS email_compte, u.email_verifie
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE s.id = $1`,
    [signalementId]
  )
  const ligne = rows[0]
  if (!ligne) return null
  return ligne.email_contact || (ligne.email_verifie ? ligne.email_compte : null)
}
