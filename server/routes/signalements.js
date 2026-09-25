import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import { CATEGORIES, COMMUNES, STATUTS } from '../../src/models/signalement.js'
import { envoyerNotificationSignalement, envoyerConfirmationSignalement, envoyerChangementStatut } from '../mailer.js'
import { requireAuth, requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { limiteurCreation, limiteurSoutien } from '../middleware/limiteurs.js'
import { supprimerPhoto } from '../storage.js'
import { contientContenuExplicite } from '../moderation.js'
import { creerNotification } from '../notifications.js'
import {
  estUnRobot,
  hasherIp,
  sessionDeLaRequete,
  estAutoriseASupprimer,
  estAutoriseAModifier
} from '../signalements/acces.js'
import { mapRow, mapMiseAJour, mapCommentaire } from '../signalements/representation.js'
import { MAX_PHOTOS, upload, traiterPhoto, traiterPhotos, contientUnePhotoInterdite } from '../signalements/photos.js'
import { emailSuiviSignalement } from '../signalements/suivi.js'
import { lirePosition } from '../signalements/localisation.js'
import { celluleCsv } from '../signalements/csv.js'
import { texte, emailValide, verifierParametreId } from '../validation.js'

// Routes des signalements eux-mêmes. Les commentaires et les mises à jour, qui sont
// des sous-ressources, ont leurs propres fichiers ; les contrôles d'accès, la conversion
// des données et le traitement des photos vivent dans server/signalements/.

const router = Router()

router.param('id', verifierParametreId('Signalement introuvable.'))

// Contrôles communs à la création et à la correction d'un signalement.
function erreurDeContenu({ categorie, commune, description }) {
  if (!CATEGORIES.includes(categorie)) return 'Catégorie invalide.'
  if (!COMMUNES.includes(commune)) return 'Commune invalide.'
  const longueur = texte(description).trim().length
  if (longueur < 10) return 'La description doit contenir au moins 10 caractères.'
  if (longueur > 2000) return 'La description ne doit pas dépasser 2000 caractères.'
  return null
}

// FormData n'envoie que des chaînes : « false » est une chaîne non vide et serait vrai.
const lireUrgent = (valeur) => valeur === 'true' || valeur === '1' || valeur === true

router.get('/signalements/count', async (req, res) => {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM signalements')
  res.json({ count: rows[0].count })
})

router.get('/signalements/stats', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT statut, COUNT(*)::int AS count FROM signalements GROUP BY statut')
  const stats = { total: 0, signale: 0, enCours: 0, resolu: 0 }
  for (const row of rows) {
    stats.total += row.count
    if (row.statut === 'Signalé') stats.signale = row.count
    else if (row.statut === 'En cours') stats.enCours = row.count
    else if (row.statut === 'Résolu') stats.resolu = row.count
  }
  res.json(stats)
})

router.get('/signalements/stats-publiques', async (req, res) => {
  const { rows: parStatutRows } = await db.query(
    'SELECT statut, COUNT(*)::int AS count FROM signalements GROUP BY statut'
  )
  const parStatut = { total: 0, signale: 0, enCours: 0, resolu: 0 }
  for (const row of parStatutRows) {
    parStatut.total += row.count
    if (row.statut === 'Signalé') parStatut.signale = row.count
    else if (row.statut === 'En cours') parStatut.enCours = row.count
    else if (row.statut === 'Résolu') parStatut.resolu = row.count
  }

  const { rows: parCommuneRows } = await db.query(
    'SELECT commune, COUNT(*)::int AS count FROM signalements GROUP BY commune ORDER BY count DESC'
  )

  const { rows: parCategorieRows } = await db.query(
    'SELECT categorie, COUNT(*)::int AS count FROM signalements GROUP BY categorie ORDER BY count DESC'
  )

  const { rows: delaiRows } = await db.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (date_resolution::timestamptz - date_signalement::timestamptz)) / 86400)::float AS jours
    FROM signalements
    WHERE date_resolution IS NOT NULL
  `)

  res.json({
    parStatut,
    parCommune: parCommuneRows.map((r) => ({ commune: r.commune, count: r.count })),
    parCategorie: parCategorieRows.map((r) => ({ categorie: r.categorie, count: r.count })),
    delaiMoyenResolutionJours: delaiRows[0].jours !== null ? Math.round(delaiRows[0].jours * 10) / 10 : null
  })
})

router.get('/signalements/export.csv', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, u.nom AS auteur_nom, u.email AS auteur_email, u.telephone AS auteur_telephone
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id
     ORDER BY s.date_signalement DESC`
  )

  const entetes = [
    'id',
    'categorie',
    'commune',
    'description',
    'statut',
    'urgent',
    'date_signalement',
    'date_resolution',
    'latitude',
    'longitude',
    'nb_soutiens',
    'auteur_nom',
    'auteur_email',
    'auteur_telephone'
  ]
  const lignes = [entetes.join(',')]
  for (const row of rows) {
    lignes.push(
      [
        row.id,
        row.categorie,
        row.commune,
        row.description,
        row.statut,
        row.urgent ? 'oui' : 'non',
        row.date_signalement,
        row.date_resolution,
        row.latitude,
        row.longitude,
        row.nb_soutiens,
        row.auteur_nom,
        row.auteur_email,
        row.auteur_telephone
      ]
        .map(celluleCsv)
        .join(',')
    )
  }

  const BOM = String.fromCharCode(0xfeff)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="signalements.csv"')
  res.send(BOM + lignes.join('\n'))
})

// Signalements proches et non résolus, proposés avant l'envoi d'un nouveau signalement.
// But : transformer un doublon en soutien. Deux personnes qui signalent le même trou ne
// sont pas du spam, mais un problème qui touche plusieurs habitants — et un signalement
// très soutenu pèse davantage que dix signalements dispersés.
router.get('/signalements/similaires', async (req, res) => {
  const { categorie = '', commune = '' } = req.query
  const latitude = Number(req.query.latitude)
  const longitude = Number(req.query.longitude)
  const aDesCoordonnees = Number.isFinite(latitude) && Number.isFinite(longitude)

  if (!CATEGORIES.includes(categorie)) return res.json({ signalements: [] })

  // ~400 m : au-delà, il s'agit le plus souvent d'un autre problème dans la même rue.
  const RAYON_DEGRES = 0.0036

  let requete
  let params
  if (aDesCoordonnees) {
    // Types explicites : sans cast, Postgres ne sait pas résoudre l'opérateur entre
    // deux paramètres non typés ("operator is not unique: unknown - unknown").
    requete = `SELECT * FROM signalements
       WHERE statut <> 'Résolu' AND categorie = $1
         AND latitude BETWEEN $2::float8 - $4::float8 AND $2::float8 + $4::float8
         AND longitude BETWEEN $3::float8 - $4::float8 AND $3::float8 + $4::float8
       ORDER BY (POWER(latitude - $2::float8, 2) + POWER(longitude - $3::float8, 2)) ASC
       LIMIT 3`
    params = [categorie, latitude, longitude, RAYON_DEGRES]
  } else {
    if (!COMMUNES.includes(commune)) return res.json({ signalements: [] })
    requete = `SELECT * FROM signalements
       WHERE statut <> 'Résolu' AND categorie = $1 AND commune = $2
       ORDER BY date_signalement DESC
       LIMIT 3`
    params = [categorie, commune]
  }

  const { rows } = await db.query(requete, params)
  res.json({ signalements: rows.map((r) => mapRow(r)) })
})

router.get('/signalements/mes', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) return res.json({ signalements: [] })

  const { rows } = await db.query(
    'SELECT * FROM signalements WHERE utilisateur_id = $1 ORDER BY date_signalement DESC',
    [req.utilisateur.id]
  )
  res.json({ signalements: rows.map((r) => mapRow(r, false, req.utilisateur.id)) })
})

router.get('/signalements/:id', async (req, res) => {
  const id = Number(req.params.id)
  const session = sessionDeLaRequete(req)
  const estAdmin = session?.type === 'admin'

  const { rows } = await db.query(
    `SELECT s.*, u.nom AS auteur_nom, u.email AS auteur_email, u.telephone AS auteur_telephone
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id
     WHERE s.id = $1`,
    [id]
  )
  if (!rows[0]) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  const { rows: misesAJour } = await db.query(
    'SELECT * FROM mises_a_jour WHERE signalement_id = $1 ORDER BY date_creation DESC',
    [id]
  )
  const { rows: commentaires } = await db.query(
    `SELECT c.*, u.pseudo AS auteur_pseudo_actuel, u.nom AS auteur_nom_actuel, u.avatar_url AS auteur_avatar_actuel
     FROM commentaires c
     LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
     WHERE c.signalement_id = $1
     ORDER BY c.date_creation ASC`,
    [id]
  )

  // Soutenir exige un compte : seul un citoyen connecté peut avoir déjà soutenu.
  let dejaSoutenu = false
  if (session?.type === 'utilisateur') {
    const { rows: soutienExistant } = await db.query(
      'SELECT 1 FROM soutiens WHERE signalement_id = $1 AND utilisateur_id = $2',
      [id, session.utilisateurId]
    )
    dejaSoutenu = soutienExistant.length > 0
  }

  res.json({
    ...mapRow(rows[0], estAdmin, session?.utilisateurId || null),
    misesAJour: misesAJour.map(mapMiseAJour),
    commentaires: commentaires.map((c) => mapCommentaire(c, session?.utilisateurId || null)),
    dejaSoutenu
  })
})

router.get('/signalements', async (req, res) => {
  const { commune = '', categorie = '', statut = '', recherche = '', tri = 'recent', urgent = '' } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const parPage = Math.min(50, Math.max(1, Number(req.query.parPage) || 12))

  const conditions = []
  const params = []

  if (commune) {
    params.push(commune)
    conditions.push(`commune = $${params.length}`)
  }
  if (categorie) {
    params.push(categorie)
    conditions.push(`categorie = $${params.length}`)
  }
  if (statut) {
    params.push(statut)
    conditions.push(`statut = $${params.length}`)
  }
  if (recherche.trim()) {
    params.push(`%${recherche.trim()}%`)
    conditions.push(
      `(description ILIKE $${params.length} OR commune ILIKE $${params.length} OR categorie ILIKE $${params.length})`
    )
  }
  if (urgent === '1' || urgent === 'true') {
    conditions.push(`urgent = true`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  // Liste blanche : `tri` vient de l'URL, il ne doit jamais arriver tel quel dans le SQL.
  const TRIS = {
    recent: 'date_signalement DESC',
    ancien: 'date_signalement ASC',
    populaire: 'nb_soutiens DESC, date_signalement DESC'
  }
  // Les urgences passent devant quel que soit le tri choisi : un danger immédiat n'a pas
  // à attendre la deuxième page parce qu'il a été signalé hier.
  const ordre = `urgent DESC, ${TRIS[tri] || TRIS.recent}`

  const { rows: rowsCompte } = await db.query(`SELECT COUNT(*)::int AS count FROM signalements ${where}`, params)
  const total = rowsCompte[0].count

  const paramsPage = [...params, parPage, (page - 1) * parPage]
  const { rows } = await db.query(
    `SELECT s.*, u.nom AS auteur_nom, u.email AS auteur_email, u.telephone AS auteur_telephone
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id
     ${where}
     ORDER BY ${ordre} LIMIT $${paramsPage.length - 1} OFFSET $${paramsPage.length}`,
    paramsPage
  )

  const sessionListe = sessionDeLaRequete(req)
  const estAdmin = sessionListe?.type === 'admin'
  res.json({
    signalements: rows.map((r) => mapRow(r, estAdmin, sessionListe?.utilisateurId || null)),
    total,
    page,
    parPage
  })
})

router.post('/signalements/:id/soutenir', requireAuthUtilisateur, limiteurSoutien, async (req, res) => {
  const id = Number(req.params.id)
  const ipHash = hasherIp(req)

  const { rows: existant } = await db.query('SELECT id FROM signalements WHERE id = $1', [id])
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Un soutien est rattaché à un compte citoyen. Un administrateur n'a pas de compte
  // citoyen : sans ce refus, ses soutiens n'étaient dédoublonnés par rien.
  if (!req.utilisateur) {
    return res.status(403).json({ erreur: 'Seul un compte citoyen peut soutenir un signalement.' })
  }

  try {
    await db.query(
      'INSERT INTO soutiens (signalement_id, ip_hash, utilisateur_id, date_soutien) VALUES ($1, $2, $3, $4)',
      [id, ipHash, req.utilisateur.id, new Date().toISOString()]
    )
  } catch (e) {
    // Seul le conflit d'unicité signifie « déjà soutenu » ; toute autre erreur est une
    // panne, qui ne doit pas être présentée à l'utilisateur comme un doublon.
    if (e.code === '23505') return res.status(409).json({ erreur: 'Vous avez déjà soutenu ce signalement.' })
    throw e
  }

  const { rows } = await db.query(
    'UPDATE signalements SET nb_soutiens = nb_soutiens + 1 WHERE id = $1 RETURNING nb_soutiens',
    [id]
  )
  res.json({ nbSoutiens: rows[0].nb_soutiens })
})

router.post(
  '/signalements',
  requireAuthUtilisateur,
  limiteurCreation,
  upload.array('photos', MAX_PHOTOS),
  async (req, res) => {
    if (estUnRobot(req)) {
      return res.status(201).json({ id: 0, statut: 'Signalé' })
    }

    if (req.utilisateur) {
      const { rows } = await db.query('SELECT email, email_verifie FROM utilisateurs WHERE id = $1', [
        req.utilisateur.id
      ])
      const compte = rows[0]
      if (compte?.email && !compte.email_verifie) {
        return res.status(403).json({
          erreur: "Confirmez votre email avant d'envoyer un signalement (lien envoyé à l'inscription).",
          emailNonVerifie: true
        })
      }
    }

    const { categorie, commune, description, latitude, longitude, email, urgent } = req.body

    const erreur = erreurDeContenu({ categorie, commune, description })
    if (erreur) return res.status(400).json({ erreur })

    const position = lirePosition(latitude, longitude)
    if (position.erreur) return res.status(400).json({ erreur: position.erreur })

    if (req.files?.length && (await contientUnePhotoInterdite(req.files))) {
      return res.status(400).json({ erreur: 'Une des photos envoyées a été refusée (contenu inapproprié détecté).' })
    }

    const emailContact = emailValide(texte(email).trim()) ? texte(email).trim() : null
    const photos = req.files?.length ? await traiterPhotos(req.files) : []
    const dateSignalement = new Date().toISOString()
    const tokenSuppression = crypto.randomBytes(24).toString('hex')
    const estUrgent = lireUrgent(urgent)

    const { rows } = await db.query(
      `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude, email_contact, token_suppression, utilisateur_id, urgent)
     VALUES ($1, $2, $3, $4, 'Signalé', $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
      [
        categorie,
        commune,
        description.trim(),
        photos,
        dateSignalement,
        position.latitude,
        position.longitude,
        emailContact,
        tokenSuppression,
        req.utilisateur?.id || null,
        estUrgent
      ]
    )

    const signalementCree = mapRow(rows[0], false, req.utilisateur?.id || null)
    envoyerNotificationSignalement(signalementCree)
    if (emailContact) {
      envoyerConfirmationSignalement(signalementCree, emailContact, tokenSuppression)
    }
    // Le token n'est renvoyé qu'ici, une seule fois : c'est la seule façon pour le créateur
    // (sans compte) de prouver plus tard que le signalement lui appartient.
    res.status(201).json({ ...signalementCree, tokenSuppression })
  }
)

router.patch('/signalements/:id', requireAuth, upload.single('photoResolution'), async (req, res) => {
  const id = Number(req.params.id)
  const { statut } = req.body

  if (!STATUTS.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide.' })
  }

  const { rows: rowsExistant } = await db.query('SELECT * FROM signalements WHERE id = $1', [id])
  const existant = rowsExistant[0]
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  let photoResolution = existant.photo_resolution
  if (req.file) {
    if (await contientContenuExplicite(req.file.buffer)) {
      return res.status(400).json({ erreur: 'La photo envoyée a été refusée (contenu inapproprié détecté).' })
    }
    if (photoResolution) await supprimerPhoto(photoResolution)
    photoResolution = await traiterPhoto(req.file)
  }

  const dateResolution = statut === 'Résolu' ? existant.date_resolution || new Date().toISOString() : null

  const { rows } = await db.query(
    'UPDATE signalements SET statut = $1, photo_resolution = $2, date_resolution = $3 WHERE id = $4 RETURNING *',
    [statut, photoResolution, dateResolution, id]
  )

  const signalementMisAJour = mapRow(rows[0])
  if (existant.statut !== statut) {
    creerNotification(existant.utilisateur_id, {
      signalementId: id,
      texte: `Votre signalement (${existant.categorie} — ${existant.commune}) est maintenant « ${statut} »`
    })

    const destinataire = await emailSuiviSignalement(id)
    if (destinataire) envoyerChangementStatut(signalementMisAJour, destinataire)
  }

  res.json(signalementMisAJour)
})

router.put('/signalements/:id', upload.array('photos', MAX_PHOTOS), async (req, res) => {
  const id = Number(req.params.id)
  const { categorie, commune, description, latitude, longitude, urgent } = req.body

  const { rows: rowsExistant } = await db.query('SELECT * FROM signalements WHERE id = $1', [id])
  const existant = rowsExistant[0]
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  if (!estAutoriseAModifier(req, existant)) {
    return res.status(403).json({
      erreur:
        existant.statut === 'Signalé'
          ? 'Vous ne pouvez modifier que vos propres signalements.'
          : "Ce signalement est déjà pris en charge : il n'est plus modifiable."
    })
  }

  const erreur = erreurDeContenu({ categorie, commune, description })
  if (erreur) return res.status(400).json({ erreur })

  // Position non renvoyée : on garde l'ancienne.
  const nouvellePosition = lirePosition(latitude, longitude)
  if (nouvellePosition.erreur) return res.status(400).json({ erreur: nouvellePosition.erreur })
  const lat = nouvellePosition.latitude ?? existant.latitude
  const lon = nouvellePosition.longitude ?? existant.longitude

  if (req.files?.length && (await contientUnePhotoInterdite(req.files))) {
    return res.status(400).json({ erreur: 'Une des photos envoyées a été refusée (contenu inapproprié détecté).' })
  }

  let photosConservees = existant.photos
  if (typeof req.body.photosConservees === 'string') {
    try {
      const demandees = JSON.parse(req.body.photosConservees)
      if (Array.isArray(demandees)) {
        photosConservees = existant.photos.filter((url) => demandees.includes(url))
      }
    } catch {
      // valeur invalide : on garde toutes les photos existantes.
    }
  }

  const nouvellesPhotos = req.files?.length
    ? await traiterPhotos(req.files.slice(0, MAX_PHOTOS - photosConservees.length))
    : []
  const photos = [...photosConservees, ...nouvellesPhotos]

  // Trace la correction : sur un registre public, le contenu ne doit pas pouvoir
  // changer en silence après coup.
  const { rows } = await db.query(
    `UPDATE signalements SET categorie = $1, commune = $2, description = $3, photos = $4, latitude = $5, longitude = $6,
            urgent = $7, date_modification = $8
     WHERE id = $9 RETURNING *`,
    [categorie, commune, description.trim(), photos, lat, lon, lireUrgent(urgent), new Date().toISOString(), id]
  )

  // Les photos retirées ne sont effacées du stockage qu'une fois la correction
  // enregistrée : si l'enregistrement échouait, la base pointerait sinon vers des
  // fichiers déjà détruits.
  const photosSupprimees = existant.photos.filter((url) => !photosConservees.includes(url))
  await Promise.all(photosSupprimees.map(supprimerPhoto))

  const session = sessionDeLaRequete(req)
  res.json(mapRow(rows[0], false, session?.utilisateurId || null))
})

router.delete('/signalements/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { rows } = await db.query('SELECT * FROM signalements WHERE id = $1', [id])
  const existant = rows[0]
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  if (!estAutoriseASupprimer(req, existant)) {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  await db.query('DELETE FROM signalements WHERE id = $1', [id])
  await Promise.all([...(existant.photos || []), existant.photo_resolution].filter(Boolean).map(supprimerPhoto))

  res.status(204).end()
})

export default router
