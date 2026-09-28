import { db } from '../db.js'
import { envoyerAlertePartenaire } from '../mailer.js'

// Prévient chaque partenaire dont le périmètre couvre le nouveau signalement : sa
// commune (ou toutes) et son domaine (ou tous). Ex. un dépôt sauvage à Koungou prévient
// SIDEVAM976 (déchets, toutes communes) et la mairie de Koungou, pas la SMAE.
export async function alerterPartenaires(signalement) {
  try {
    const { rows } = await db.query(
      `SELECT id, nom, email FROM partenaires
       WHERE email IS NOT NULL
         AND (commune IS NULL OR commune = $1)
         AND (cardinality(categories) = 0 OR $2 = ANY(categories))`,
      [signalement.commune, signalement.categorie]
    )
    for (const partenaire of rows) await envoyerAlertePartenaire(partenaire, signalement)
  } catch (e) {
    // Une alerte manquée ne doit jamais faire échouer l'enregistrement du signalement.
    console.error('[partenaires] alerte :', e.message)
  }
}
