import { db } from './db.js'
import { effacerCompte } from './compte.js'

// Durées de conservation (RGPD art. 5 : les données ne sont pas gardées plus longtemps
// que nécessaire). Ces valeurs sont annoncées sur la page Confidentialité : toute
// modification ici doit y être reportée.
export const CONSERVATION = {
  messagesContactMois: 12,
  notificationsMois: 12,
  // Recommandation de la CNIL pour un compte inutilisé.
  compteInactifAns: 3
}

function ilYa({ mois = 0, ans = 0 }) {
  const date = new Date()
  date.setMonth(date.getMonth() - mois - ans * 12)
  return date.toISOString()
}

// Les dates sont stockées en texte ISO 8601 : l'ordre alphabétique est l'ordre
// chronologique, la comparaison de chaînes est donc correcte.
export async function purgerDonneesExpirees() {
  const messages = await db.query('DELETE FROM messages_contact WHERE date_envoi < $1', [
    ilYa({ mois: CONSERVATION.messagesContactMois })
  ])
  const notifications = await db.query('DELETE FROM notifications WHERE date_creation < $1', [
    ilYa({ mois: CONSERVATION.notificationsMois })
  ])

  // Compte sans aucune connexion depuis 3 ans : effacé comme si la personne l'avait
  // supprimé elle-même, ses signalements restant en ligne sous forme anonyme.
  const { rows: inactifs } = await db.query(
    'SELECT id FROM utilisateurs WHERE COALESCE(derniere_connexion, cree_le) < $1',
    [ilYa({ ans: CONSERVATION.compteInactifAns })]
  )
  for (const { id } of inactifs) await effacerCompte(id)

  const total = messages.rowCount + notifications.rowCount + inactifs.length
  if (total) {
    console.log(
      `[retention] Effacés : ${messages.rowCount} message(s) de contact, ${notifications.rowCount} notification(s), ${inactifs.length} compte(s) inactif(s).`
    )
  }
}

const UN_JOUR_MS = 24 * 60 * 60 * 1000

// Au démarrage, puis une fois par jour. Une purge ratée ne doit jamais empêcher le site
// de fonctionner : l'erreur est journalisée et la suivante réessaiera.
export function planifierPurge() {
  const lancer = () => purgerDonneesExpirees().catch((e) => console.error('[retention] Échec de la purge :', e.message))
  lancer()
  setInterval(lancer, UN_JOUR_MS).unref?.()
}
