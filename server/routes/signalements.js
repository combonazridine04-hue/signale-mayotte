import { Router } from 'express'
import crypto from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import { db } from '../db.js'
import { CATEGORIES, COMMUNES, STATUTS } from '../../src/models/signalement.js'
import { envoyerNotificationSignalement, envoyerConfirmationSignalement, envoyerChangementStatut } from '../mailer.js'
import { requireAuth, requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { sessionValide } from '../auth.js'
import { supprimerPhoto } from '../storage.js'
import { contientContenuExplicite } from '../moderation.js'
import { creerUpload, traiterPhoto as traiterPhotoPartage } from '../photoUpload.js'

const MAX_PHOTOS = 5

const limiteurCreation = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de signalements envoyés, réessayez plus tard.' }
})

const limiteurSoutien = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de demandes, réessayez plus tard.' }
})

const limiteurCommentaire = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de commentaires envoyés, réessayez plus tard.' }
})

const upload = creerUpload({ fileSize: 5 * 1024 * 1024, files: MAX_PHOTOS })

const router = Router()

// Champ piège invisible : un visiteur humain ne le remplit jamais, un bot qui
// remplit tous les champs automatiquement si.
function estUnRobot(req) {
  return Boolean(req.body?.site_web)
}

function hasherIp(req) {
  return crypto.createHash('sha256').update(`signale-mayotte-soutien:${req.ip}`).digest('hex')
}

function sessionDeLaRequete(req) {
  const entete = req.headers.authorization || ''
  const token = entete.startsWith('Bearer ') ? entete.slice(7) : ''
  return sessionValide(token)
}

// Autorisé si connecté en admin, si c'est le compte citoyen créateur, OU si le token secret
// de suppression (donné au créateur anonyme historique, jamais exposé ailleurs) correspond.
function estAutoriseASupprimer(req, existant) {
  const session = sessionDeLaRequete(req)
  if (session?.type === 'admin') return true
  if (session?.type === 'utilisateur' && session.utilisateurId === existant.utilisateur_id) return true

  const tokenSuppression = req.query.token || req.body?.token
  return Boolean(tokenSuppression) && tokenSuppression === existant.token_suppression
}

const traiterPhoto = traiterPhotoPartage

async function traiterPhotos(fichiers) {
  const urls = []
  for (const fichier of fichiers) {
    urls.push(await traiterPhoto(fichier))
  }
  return urls
}

// Renvoie true si au moins une des photos envoyées est jugée à caractère explicite
// (analysée avant tout traitement/envoi, pour ne rien stocker si elle est rejetée).
async function contientUnePhotoInterdite(fichiers) {
  for (const fichier of fichiers) {
    if (await contientContenuExplicite(fichier.buffer)) return true
  }
  return false
}

function mapRow(row, avecAuteur = false) {
  const base = {
    id: row.id,
    categorie: row.categorie,
    commune: row.commune,
    description: row.description,
    photoUrls: row.photos || [],
    photoResolution: row.photo_resolution || '',
    statut: row.statut,
    dateSignalement: row.date_signalement,
    dateResolution: row.date_resolution || '',
    latitude: row.latitude,
    longitude: row.longitude,
    nbSoutiens: row.nb_soutiens || 0
  }
  // Identité du créateur : jamais publique, visible uniquement par l'admin (traçabilité anti-abus).
  if (avecAuteur) {
    base.auteurNom = row.auteur_nom || null
    base.auteurEmail = row.auteur_email || null
    base.auteurTelephone = row.auteur_telephone || null
  }
  return base
}

function mapMiseAJour(row) {
  return { id: row.id, texte: row.texte, dateCreation: row.date_creation }
}

function mapCommentaire(row) {
  // Si l'auteur a un compte encore actif, on affiche son pseudo/nom/avatar ACTUELS (pas
  // celui au moment du commentaire) : changer son profil doit s'appliquer à tout l'historique.
  const auteur = row.auteur_pseudo_actuel || row.auteur_nom_actuel || row.auteur
  return { id: row.id, auteur, auteurAvatarUrl: row.auteur_avatar_actuel || null, texte: row.texte, dateCreation: row.date_creation }
}

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
  const { rows: parStatutRows } = await db.query('SELECT statut, COUNT(*)::int AS count FROM signalements GROUP BY statut')
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

  const echapperCsv = (valeur) => `"${String(valeur ?? '').replace(/"/g, '""')}"`
  const entetes = ['id', 'categorie', 'commune', 'description', 'statut', 'date_signalement', 'date_resolution', 'latitude', 'longitude', 'nb_soutiens', 'auteur_nom', 'auteur_email', 'auteur_telephone']
  const lignes = [entetes.join(',')]
  for (const row of rows) {
    lignes.push(
      [row.id, row.categorie, row.commune, row.description, row.statut, row.date_signalement, row.date_resolution, row.latitude, row.longitude, row.nb_soutiens, row.auteur_nom, row.auteur_email, row.auteur_telephone]
        .map(echapperCsv)
        .join(',')
    )
  }

  const BOM = String.fromCharCode(0xfeff)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="signalements.csv"')
  res.send(BOM + lignes.join('\n'))
})

router.get('/signalements/mes', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) return res.json({ signalements: [] })

  const { rows } = await db.query(
    'SELECT * FROM signalements WHERE utilisateur_id = $1 ORDER BY date_signalement DESC',
    [req.utilisateur.id]
  )
  res.json({ signalements: rows.map((r) => mapRow(r)) })
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

  let dejaSoutenu = false
  if (session?.type === 'utilisateur') {
    const { rows: soutienExistant } = await db.query(
      'SELECT 1 FROM soutiens WHERE signalement_id = $1 AND utilisateur_id = $2',
      [id, session.utilisateurId]
    )
    dejaSoutenu = soutienExistant.length > 0
  } else {
    const { rows: soutienExistant } = await db.query(
      'SELECT 1 FROM soutiens WHERE signalement_id = $1 AND ip_hash = $2',
      [id, hasherIp(req)]
    )
    dejaSoutenu = soutienExistant.length > 0
  }

  res.json({
    ...mapRow(rows[0], estAdmin),
    misesAJour: misesAJour.map(mapMiseAJour),
    commentaires: commentaires.map(mapCommentaire),
    dejaSoutenu
  })
})

router.get('/signalements', async (req, res) => {
  const { commune = '', categorie = '', statut = '', recherche = '', tri = 'recent' } = req.query
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
    conditions.push(`(description ILIKE $${params.length} OR commune ILIKE $${params.length} OR categorie ILIKE $${params.length})`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const ordre = tri === 'ancien' ? 'ASC' : tri === 'populaire' ? 'nb_soutiens DESC, date_signalement' : 'date_signalement'
  const sens = tri === 'ancien' ? 'ASC' : 'DESC'

  const { rows: rowsCompte } = await db.query(`SELECT COUNT(*)::int AS count FROM signalements ${where}`, params)
  const total = rowsCompte[0].count

  const paramsPage = [...params, parPage, (page - 1) * parPage]
  const { rows } = await db.query(
    `SELECT s.*, u.nom AS auteur_nom, u.email AS auteur_email, u.telephone AS auteur_telephone
     FROM signalements s
     LEFT JOIN utilisateurs u ON u.id = s.utilisateur_id
     ${where}
     ORDER BY ${ordre} ${sens} LIMIT $${paramsPage.length - 1} OFFSET $${paramsPage.length}`,
    paramsPage
  )

  const estAdmin = sessionDeLaRequete(req)?.type === 'admin'
  res.json({ signalements: rows.map((r) => mapRow(r, estAdmin)), total, page, parPage })
})

router.post('/signalements/:id/soutenir', requireAuthUtilisateur, limiteurSoutien, async (req, res) => {
  const id = Number(req.params.id)
  const ipHash = hasherIp(req)

  const { rows: existant } = await db.query('SELECT id FROM signalements WHERE id = $1', [id])
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  try {
    await db.query('INSERT INTO soutiens (signalement_id, ip_hash, utilisateur_id, date_soutien) VALUES ($1, $2, $3, $4)', [
      id,
      ipHash,
      req.utilisateur?.id || null,
      new Date().toISOString()
    ])
  } catch {
    return res.status(409).json({ erreur: 'Vous avez déjà soutenu ce signalement.' })
  }

  const { rows } = await db.query(
    'UPDATE signalements SET nb_soutiens = nb_soutiens + 1 WHERE id = $1 RETURNING nb_soutiens',
    [id]
  )
  res.json({ nbSoutiens: rows[0].nb_soutiens })
})

router.post('/signalements', requireAuthUtilisateur, limiteurCreation, upload.array('photos', MAX_PHOTOS), async (req, res) => {
  if (estUnRobot(req)) {
    return res.status(201).json({ id: 0, statut: 'Signalé' })
  }

  if (req.utilisateur) {
    const { rows } = await db.query('SELECT email, email_verifie FROM utilisateurs WHERE id = $1', [req.utilisateur.id])
    const compte = rows[0]
    if (compte?.email && !compte.email_verifie) {
      return res.status(403).json({
        erreur: "Confirmez votre email avant d'envoyer un signalement (lien envoyé à l'inscription).",
        emailNonVerifie: true
      })
    }
  }

  const { categorie, commune, description, latitude, longitude, email } = req.body

  if (!CATEGORIES.includes(categorie)) {
    return res.status(400).json({ erreur: 'Catégorie invalide.' })
  }
  if (!COMMUNES.includes(commune)) {
    return res.status(400).json({ erreur: 'Commune invalide.' })
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ erreur: 'La description doit contenir au moins 10 caractères.' })
  }
  if (description.trim().length > 2000) {
    return res.status(400).json({ erreur: 'La description ne doit pas dépasser 2000 caractères.' })
  }

  if (req.files?.length && (await contientUnePhotoInterdite(req.files))) {
    return res.status(400).json({ erreur: 'Une des photos envoyées a été refusée (contenu inapproprié détecté).' })
  }

  const emailValide = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  const photos = req.files?.length ? await traiterPhotos(req.files) : []
  const dateSignalement = new Date().toISOString()
  const lat = latitude ? Number(latitude) : null
  const lon = longitude ? Number(longitude) : null
  const tokenSuppression = crypto.randomBytes(24).toString('hex')

  const { rows } = await db.query(
    `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude, email_contact, token_suppression, utilisateur_id)
     VALUES ($1, $2, $3, $4, 'Signalé', $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [categorie, commune, description.trim(), photos, dateSignalement, lat, lon, emailValide, tokenSuppression, req.utilisateur?.id || null]
  )

  const signalementCree = mapRow(rows[0])
  envoyerNotificationSignalement(signalementCree)
  if (emailValide) {
    envoyerConfirmationSignalement(signalementCree, emailValide, tokenSuppression)
  }
  // Le token n'est renvoyé qu'ici, une seule fois : c'est la seule façon pour le créateur
  // (sans compte) de prouver plus tard que le signalement lui appartient.
  res.status(201).json({ ...signalementCree, tokenSuppression })
})

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
  if (existant.statut !== statut && existant.email_contact) {
    envoyerChangementStatut(signalementMisAJour, existant.email_contact)
  }

  res.json(signalementMisAJour)
})

router.put('/signalements/:id', requireAuth, upload.array('photos', MAX_PHOTOS), async (req, res) => {
  const id = Number(req.params.id)
  const { categorie, commune, description, latitude, longitude } = req.body

  const { rows: rowsExistant } = await db.query('SELECT * FROM signalements WHERE id = $1', [id])
  const existant = rowsExistant[0]
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  if (!CATEGORIES.includes(categorie)) {
    return res.status(400).json({ erreur: 'Catégorie invalide.' })
  }
  if (!COMMUNES.includes(commune)) {
    return res.status(400).json({ erreur: 'Commune invalide.' })
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ erreur: 'La description doit contenir au moins 10 caractères.' })
  }
  if (description.trim().length > 2000) {
    return res.status(400).json({ erreur: 'La description ne doit pas dépasser 2000 caractères.' })
  }

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

  const photosSupprimees = existant.photos.filter((url) => !photosConservees.includes(url))
  await Promise.all(photosSupprimees.map(supprimerPhoto))

  const nouvellesPhotos = req.files?.length ? await traiterPhotos(req.files.slice(0, MAX_PHOTOS - photosConservees.length)) : []
  const photos = [...photosConservees, ...nouvellesPhotos]

  const lat = latitude ? Number(latitude) : existant.latitude
  const lon = longitude ? Number(longitude) : existant.longitude

  const { rows } = await db.query(
    `UPDATE signalements SET categorie = $1, commune = $2, description = $3, photos = $4, latitude = $5, longitude = $6
     WHERE id = $7 RETURNING *`,
    [categorie, commune, description.trim(), photos, lat, lon, id]
  )

  res.json(mapRow(rows[0]))
})

router.post('/signalements/:id/mises-a-jour', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  const { texte } = req.body || {}

  if (typeof texte !== 'string' || texte.trim().length < 3) {
    return res.status(400).json({ erreur: 'Le message doit contenir au moins 3 caractères.' })
  }
  if (texte.trim().length > 1000) {
    return res.status(400).json({ erreur: 'Le message ne doit pas dépasser 1000 caractères.' })
  }

  const { rows: existant } = await db.query('SELECT id FROM signalements WHERE id = $1', [id])
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  const { rows } = await db.query(
    'INSERT INTO mises_a_jour (signalement_id, texte, date_creation) VALUES ($1, $2, $3) RETURNING *',
    [id, texte.trim(), new Date().toISOString()]
  )

  res.status(201).json(mapMiseAJour(rows[0]))
})

router.delete('/signalements/:id/mises-a-jour/:miseAJourId', requireAuth, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM mises_a_jour WHERE id = $1 AND signalement_id = $2', [
    Number(req.params.miseAJourId),
    Number(req.params.id)
  ])
  if (!rowCount) return res.status(404).json({ erreur: 'Mise à jour introuvable.' })
  res.status(204).end()
})

router.post('/signalements/:id/commentaires', requireAuthUtilisateur, limiteurCommentaire, async (req, res) => {
  const id = Number(req.params.id)
  const { texte = '' } = req.body || {}
  // L'auteur affiché vient toujours du compte connecté, jamais d'un champ du formulaire :
  // ça empêche de se faire passer pour quelqu'un d'autre. Le pseudo (s'il est défini)
  // est affiché à la place du vrai nom pour préserver la confidentialité promise à l'inscription.
  let auteur = `Admin (${req.admin?.identifiant})`
  let auteurAvatarUrl = null
  if (req.utilisateur) {
    const { rows } = await db.query('SELECT nom, pseudo, avatar_url FROM utilisateurs WHERE id = $1', [req.utilisateur.id])
    auteur = rows[0]?.pseudo || rows[0]?.nom || req.utilisateur.nom
    auteurAvatarUrl = rows[0]?.avatar_url || null
  }

  if (texte.trim().length < 3) {
    return res.status(400).json({ erreur: 'Le commentaire doit contenir au moins 3 caractères.' })
  }
  if (texte.trim().length > 1000) {
    return res.status(400).json({ erreur: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  }

  const { rows: existant } = await db.query('SELECT id FROM signalements WHERE id = $1', [id])
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  const { rows } = await db.query(
    'INSERT INTO commentaires (signalement_id, auteur, texte, date_creation, utilisateur_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, auteur, texte.trim(), new Date().toISOString(), req.utilisateur?.id || null]
  )

  res.status(201).json({ ...mapCommentaire(rows[0]), auteurAvatarUrl })
})

router.delete('/signalements/:id/commentaires/:commentaireId', requireAuth, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM commentaires WHERE id = $1 AND signalement_id = $2', [
    Number(req.params.commentaireId),
    Number(req.params.id)
  ])
  if (!rowCount) return res.status(404).json({ erreur: 'Commentaire introuvable.' })
  res.status(204).end()
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
