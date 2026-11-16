import { db } from '../config/db.js'

// Accès à la table soutiens : un seul soutien par compte et par signalement.

export async function aDejaSoutenu(signalementId, utilisateurId) {
  const { rows } = await db.query('SELECT 1 FROM soutiens WHERE signalement_id = ? AND utilisateur_id = ?', [
    signalementId,
    utilisateurId
  ])
  return rows.length > 0
}

// Lève une erreur de code ER_DUP_ENTRY si ce compte a déjà soutenu ce signalement.
export async function ajouter(signalementId, utilisateurId) {
  await db.query(
    'INSERT INTO soutiens (signalement_id, ip_hash, utilisateur_id, date_soutien) VALUES (?, ?, ?, ?)',
    // ip_hash vide : soutenir exige un compte, l'empreinte d'IP ne servait plus à rien
    // et n'est donc plus collectée (minimisation des données, RGPD art. 5).
    [signalementId, '', utilisateurId, new Date().toISOString()]
  )
}
