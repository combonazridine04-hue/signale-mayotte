import { db } from '../config/db.js'

// Accès à la table signalements. Toutes les valeurs passent en paramètres (« ? »),
// jamais collées dans le texte SQL : c'est ce qui protège de l'injection SQL.

// Colonnes de l'auteur ajoutées à un signalement (réservées à l'admin par mapRow).
const AVEC_AUTEUR = `SELECT s.*, u.nom AS auteur_nom, u.email AS auteur_email, u.telephone AS auteur_telephone
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id`

// Liste blanche des tris : `tri` vient de l'URL, il ne doit jamais arriver tel quel dans le SQL.
const TRIS = {
  recent: 'date_signalement DESC',
  ancien: 'date_signalement ASC',
  populaire: 'nb_soutiens DESC, date_signalement DESC'
}

// ~400 m : au-delà, il s'agit le plus souvent d'un autre problème dans la même rue.
const RAYON_DEGRES = 0.0036

// --- Lecture ---

export async function trouverParId(id) {
  const { rows } = await db.query('SELECT * FROM signalements WHERE id = ?', [id])
  return rows[0]
}

// Signalement + identité de son auteur, ou undefined.
export async function trouverAvecAuteur(id) {
  const { rows } = await db.query(`${AVEC_AUTEUR} WHERE s.id = ?`, [id])
  return rows[0]
}

// Juste ce qu'il faut pour prévenir l'auteur (notification, email) : ou undefined.
export async function trouverResume(id) {
  const { rows } = await db.query('SELECT id, categorie, commune, utilisateur_id FROM signalements WHERE id = ?', [id])
  return rows[0]
}

export async function existe(id) {
  const { rows } = await db.query('SELECT id FROM signalements WHERE id = ?', [id])
  return rows.length > 0
}

// Texte du signalement, pour l'alerte de modération : ou undefined.
export async function trouverExtrait(id) {
  const { rows } = await db.query(
    'SELECT id AS signalement_id, description AS extrait FROM signalements WHERE id = ?',
    [id]
  )
  return rows[0]
}

// Aperçu affiché dans la liste des contenus signalés comme abusifs : ou undefined.
export async function trouverApercu(id) {
  const { rows } = await db.query('SELECT id, categorie, commune, description FROM signalements WHERE id = ?', [id])
  return rows[0]
}

export async function listerParAuteur(utilisateurId) {
  const { rows } = await db.query(
    'SELECT * FROM signalements WHERE utilisateur_id = ? ORDER BY date_signalement DESC',
    [utilisateurId]
  )
  return rows
}

export async function listerPourExport() {
  const { rows } = await db.query(`${AVEC_AUTEUR} ORDER BY s.date_signalement DESC`)
  return rows
}

// Liste filtrée et paginée. Renvoie { total, rows }.
export async function rechercher({ commune, categorie, statut, recherche, urgent, tri, page, parPage }) {
  const conditions = []
  const params = []

  // Chaque filtre ajoute sa condition avec un « ? » ET sa valeur dans params, dans le
  // même ordre : la valeur ne passe jamais dans le texte SQL.
  if (commune) {
    conditions.push('commune = ?')
    params.push(commune)
  }
  if (categorie) {
    conditions.push('categorie = ?')
    params.push(categorie)
  }
  if (statut) {
    conditions.push('statut = ?')
    params.push(statut)
  }
  if (recherche) {
    // LIKE ignore déjà les majuscules et les accents (collation utf8mb4_unicode_ci).
    const motif = `%${recherche}%`
    conditions.push('(description LIKE ? OR commune LIKE ? OR categorie LIKE ?)')
    params.push(motif, motif, motif)
  }
  if (urgent) {
    conditions.push('urgent = TRUE')
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  // Les urgences passent devant quel que soit le tri choisi : un danger immédiat n'a pas
  // à attendre la deuxième page parce qu'il a été signalé hier.
  const ordre = `urgent DESC, ${TRIS[tri] || TRIS.recent}`

  const { rows: rowsCompte } = await db.query(`SELECT COUNT(*) AS count FROM signalements ${where}`, params)
  const { rows } = await db.query(`${AVEC_AUTEUR} ${where} ORDER BY ${ordre} LIMIT ? OFFSET ?`, [
    ...params,
    parPage,
    (page - 1) * parPage
  ])
  return { total: rowsCompte[0].count, rows }
}

// Signalements non résolus de la même catégorie, les plus proches d'abord (carré de
// ±400 m autour du point), ou à défaut de position, les plus récents de la commune.
export async function trouverSimilaires({ categorie, commune, latitude, longitude }) {
  if (latitude !== undefined && longitude !== undefined) {
    const { rows } = await db.query(
      `SELECT * FROM signalements
       WHERE statut <> 'Résolu' AND categorie = ?
         AND latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?
       ORDER BY (POWER(latitude - ?, 2) + POWER(longitude - ?, 2)) ASC
       LIMIT 3`,
      [
        categorie,
        latitude - RAYON_DEGRES,
        latitude + RAYON_DEGRES,
        longitude - RAYON_DEGRES,
        longitude + RAYON_DEGRES,
        latitude,
        longitude
      ]
    )
    return rows
  }
  const { rows } = await db.query(
    `SELECT * FROM signalements
       WHERE statut <> 'Résolu' AND categorie = ? AND commune = ?
       ORDER BY date_signalement DESC
       LIMIT 3`,
    [categorie, commune]
  )
  return rows
}

// Nombre de signalements du périmètre d'un partenaire arrivés après la date « depuis ».
// Périmètre : commune NULL = toute l'île, liste de domaines vide = tous les domaines.
export async function compterNouveauxDansPerimetre({ commune, categories, depuis }) {
  const domaines = JSON.stringify(categories || [])
  const { rows } = await db.query(
    `SELECT COUNT(*) AS nombre FROM signalements
     WHERE date_signalement > ?
       AND (? IS NULL OR commune = ?)
       AND (JSON_LENGTH(?) = 0 OR JSON_CONTAINS(?, JSON_QUOTE(categorie)))`,
    [depuis || '', commune || null, commune || null, domaines, domaines]
  )
  return rows[0].nombre
}

// --- Statistiques ---

export async function compterTout() {
  const { rows } = await db.query('SELECT COUNT(*) AS count FROM signalements')
  return rows[0].count
}

// { total, signale, enCours, resolu }
export async function compterParStatut() {
  const { rows } = await db.query('SELECT statut, COUNT(*) AS count FROM signalements GROUP BY statut')
  const stats = { total: 0, signale: 0, enCours: 0, resolu: 0 }
  for (const row of rows) {
    stats.total += row.count
    if (row.statut === 'Signalé') stats.signale = row.count
    else if (row.statut === 'En cours') stats.enCours = row.count
    else if (row.statut === 'Résolu') stats.resolu = row.count
  }
  return stats
}

export async function compterParCommune() {
  const { rows } = await db.query(
    'SELECT commune, COUNT(*) AS count FROM signalements GROUP BY commune ORDER BY count DESC'
  )
  return rows
}

export async function compterParCategorie() {
  const { rows } = await db.query(
    'SELECT categorie, COUNT(*) AS count FROM signalements GROUP BY categorie ORDER BY count DESC'
  )
  return rows
}

// Délai moyen entre le signalement et sa résolution, en jours (null si aucun résolu).
export async function delaiMoyenResolutionJours() {
  const { rows } = await db.query(`
    SELECT AVG(
             TIMESTAMPDIFF(
               SECOND,
               STR_TO_DATE(LEFT(date_signalement, 19), '%Y-%m-%dT%H:%i:%s'),
               STR_TO_DATE(LEFT(date_resolution, 19), '%Y-%m-%dT%H:%i:%s')
             ) / 86400
           ) AS jours
    FROM signalements
    WHERE date_resolution IS NOT NULL AND date_resolution <> ''
  `)
  return rows[0].jours
}

// --- Écriture ---

export async function creer({
  categorie,
  commune,
  description,
  photos,
  dateSignalement,
  latitude,
  longitude,
  emailContact,
  tokenSuppression,
  utilisateurId,
  urgent
}) {
  const { rows } = await db.query(
    `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude, email_contact, token_suppression, utilisateur_id, urgent)
     VALUES (?, ?, ?, ?, 'Signalé', ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [
      categorie,
      commune,
      description,
      // Colonne JSON : la liste des photos est enregistrée sous forme de texte JSON.
      JSON.stringify(photos),
      dateSignalement,
      latitude,
      longitude,
      emailContact,
      tokenSuppression,
      utilisateurId,
      urgent
    ]
  )
  return rows[0]
}

// Renvoie le signalement modifié.
// MariaDB ne sait pas renvoyer la ligne modifiée (pas de UPDATE … RETURNING) : on la relit.
export async function modifierStatut(id, { statut, photoResolution, dateResolution }) {
  await db.query('UPDATE signalements SET statut = ?, photo_resolution = ?, date_resolution = ? WHERE id = ?', [
    statut,
    photoResolution,
    dateResolution,
    id
  ])
  return trouverParId(id)
}

// Correction du contenu par son auteur. La date de modification est tracée : sur un
// registre public, le contenu ne doit pas pouvoir changer en silence après coup.
export async function modifierContenu(id, { categorie, commune, description, photos, latitude, longitude, urgent }) {
  await db.query(
    `UPDATE signalements SET categorie = ?, commune = ?, description = ?, photos = ?, latitude = ?, longitude = ?,
            urgent = ?, date_modification = ?
     WHERE id = ?`,
    [categorie, commune, description, JSON.stringify(photos), latitude, longitude, urgent, new Date().toISOString(), id]
  )
  return trouverParId(id)
}

// L'incrément se fait dans la base (nb_soutiens + 1), sans risque de perdre un soutien
// si deux personnes soutiennent au même instant. Renvoie le nouveau total.
export async function incrementerSoutiens(id) {
  await db.query('UPDATE signalements SET nb_soutiens = nb_soutiens + 1 WHERE id = ?', [id])
  const { rows } = await db.query('SELECT nb_soutiens FROM signalements WHERE id = ?', [id])
  return rows[0].nb_soutiens
}

// Supprime aussi, par cascade, ses soutiens, commentaires, mises à jour et notifications.
export async function supprimer(id) {
  await db.query('DELETE FROM signalements WHERE id = ?', [id])
}
