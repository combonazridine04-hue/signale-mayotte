import { db } from './db.js'

// Notifications visibles dans le site, en complément des emails : la majorité des
// comptes n'ont pas d'adresse vérifiée et ne seraient prévenus par aucun autre moyen.
export async function creerNotification(utilisateurId, { signalementId = null, texte }) {
  if (!utilisateurId || !texte) return

  try {
    await db.query(
      'INSERT INTO notifications (utilisateur_id, signalement_id, texte, date_creation) VALUES ($1, $2, $3, $4)',
      [utilisateurId, signalementId, texte, new Date().toISOString()]
    )
  } catch (e) {
    // Une notification perdue ne doit jamais faire échouer l'action qui l'a déclenchée
    // (publier un commentaire, changer un statut...).
    console.error('[notifications] Échec création :', e.message)
  }
}

export async function listerNotifications(utilisateurId, limite = 30) {
  const { rows } = await db.query(
    `SELECT id, signalement_id, texte, lue, date_creation
     FROM notifications
     WHERE utilisateur_id = $1
     ORDER BY date_creation DESC
     LIMIT $2`,
    [utilisateurId, limite]
  )
  return rows.map((r) => ({
    id: r.id,
    signalementId: r.signalement_id,
    texte: r.texte,
    lue: r.lue,
    dateCreation: r.date_creation
  }))
}

export async function compterNonLues(utilisateurId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM notifications WHERE utilisateur_id = $1 AND lue = false',
    [utilisateurId]
  )
  return rows[0].n
}

export async function marquerToutesLues(utilisateurId) {
  await db.query('UPDATE notifications SET lue = true WHERE utilisateur_id = $1 AND lue = false', [utilisateurId])
}
