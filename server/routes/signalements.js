import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import crypto from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import { db } from '../db.js'
import { CATEGORIES, COMMUNES, STATUTS } from '../../src/models/signalement.js'
import { envoyerNotificationSignalement, envoyerConfirmationSignalement, envoyerChangementStatut } from '../mailer.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { sessionValide } from '../auth.js'
import { uploaderPhoto, supprimerPhoto } from '../storage.js'

const MAX_PHOTOS = 5

const limiteurCreation = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
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

const EXTENSIONS_AUTORISEES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    // Liste blanche stricte : exclut notamment image/svg+xml, vecteur de XSS stocké.
    cb(null, Object.hasOwn(EXTENSIONS_AUTORISEES, file.mimetype))
  }
})

const router = Router()

// Champ piège invisible : un visiteur humain ne le remplit jamais, un bot qui
// remplit tous les champs automatiquement si.
function estUnRobot(req) {
  return Boolean(req.body?.site_web)
}

function hasherIp(req) {
  return crypto.createHash('sha256').update(`signale-mayotte-soutien:${req.ip}`).digest('hex')
}

// Autorisé si connecté en admin, OU si le token secret de suppression (donné au créateur
// à la création, jamais exposé ailleurs) correspond à celui du signalement.
function estAutoriseASupprimer(req, existant) {
  const entete = req.headers.authorization || ''
  const token = entete.startsWith('Bearer ') ? entete.slice(7) : ''
  if (sessionValide(token)) return true

  const tokenSuppression = req.query.token || req.body?.token
  return Boolean(tokenSuppression) && tokenSuppression === existant.token_suppression
}

async function traiterPhoto(fichier) {
  const format = EXTENSIONS_AUTORISEES[fichier.mimetype]
  // .rotate() sans argument applique l'orientation EXIF avant de la supprimer,
  // pour éviter les photos de travers ; toBuffer() par défaut retire déjà toutes
  // les métadonnées (dont la géolocalisation GPS embarquée par les smartphones).
  const image = sharp(fichier.buffer, { animated: format === 'gif' }).rotate()
  const buffer = await image.toFormat(format).toBuffer()

  const nomFichier = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${format}`
  return uploaderPhoto(buffer, nomFichier, fichier.mimetype)
}

async function traiterPhotos(fichiers) {
  const urls = []
  for (const fichier of fichiers) {
    urls.push(await traiterPhoto(fichier))
  }
  return urls
}

function mapRow(row) {
  return {
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
}

function mapMiseAJour(row) {
  return { id: row.id, texte: row.texte, dateCreation: row.date_creation }
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

  const { rows: delaiRows } = await db.query(`
    SELECT AVG(EXTRACT(EPOCH FROM (date_resolution::timestamptz - date_signalement::timestamptz)) / 86400)::float AS jours
    FROM signalements
    WHERE date_resolution IS NOT NULL
  `)

  res.json({
    parStatut,
    parCommune: parCommuneRows.map((r) => ({ commune: r.commune, count: r.count })),
    delaiMoyenResolutionJours: delaiRows[0].jours !== null ? Math.round(delaiRows[0].jours * 10) / 10 : null
  })
})

router.get('/signalements/export.csv', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM signalements ORDER BY date_signalement DESC')

  const echapperCsv = (valeur) => `"${String(valeur ?? '').replace(/"/g, '""')}"`
  const entetes = ['id', 'categorie', 'commune', 'description', 'statut', 'date_signalement', 'date_resolution', 'latitude', 'longitude', 'nb_soutiens']
  const lignes = [entetes.join(',')]
  for (const row of rows) {
    lignes.push(
      [row.id, row.categorie, row.commune, row.description, row.statut, row.date_signalement, row.date_resolution, row.latitude, row.longitude, row.nb_soutiens]
        .map(echapperCsv)
        .join(',')
    )
  }

  const BOM = String.fromCharCode(0xfeff)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="signalements.csv"')
  res.send(BOM + lignes.join('\n'))
})

router.get('/signalements/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { rows } = await db.query('SELECT * FROM signalements WHERE id = $1', [id])
  if (!rows[0]) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  const { rows: misesAJour } = await db.query(
    'SELECT * FROM mises_a_jour WHERE signalement_id = $1 ORDER BY date_creation DESC',
    [id]
  )
  const { rows: soutienExistant } = await db.query(
    'SELECT 1 FROM soutiens WHERE signalement_id = $1 AND ip_hash = $2',
    [id, hasherIp(req)]
  )

  res.json({ ...mapRow(rows[0]), misesAJour: misesAJour.map(mapMiseAJour), dejaSoutenu: soutienExistant.length > 0 })
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
    `SELECT * FROM signalements ${where} ORDER BY ${ordre} ${sens} LIMIT $${paramsPage.length - 1} OFFSET $${paramsPage.length}`,
    paramsPage
  )

  res.json({ signalements: rows.map(mapRow), total, page, parPage })
})

router.post('/signalements/:id/soutenir', limiteurSoutien, async (req, res) => {
  const id = Number(req.params.id)
  const ipHash = hasherIp(req)

  const { rows: existant } = await db.query('SELECT id FROM signalements WHERE id = $1', [id])
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  try {
    await db.query('INSERT INTO soutiens (signalement_id, ip_hash, date_soutien) VALUES ($1, $2, $3)', [
      id,
      ipHash,
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

router.post('/signalements', limiteurCreation, upload.array('photos', MAX_PHOTOS), async (req, res) => {
  if (estUnRobot(req)) {
    return res.status(201).json({ id: 0, statut: 'Signalé' })
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

  const emailValide = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  const photos = req.files?.length ? await traiterPhotos(req.files) : []
  const dateSignalement = new Date().toISOString()
  const lat = latitude ? Number(latitude) : null
  const lon = longitude ? Number(longitude) : null
  const tokenSuppression = crypto.randomBytes(24).toString('hex')

  const { rows } = await db.query(
    `INSERT INTO signalements (categorie, commune, description, photos, statut, date_signalement, latitude, longitude, email_contact, token_suppression)
     VALUES ($1, $2, $3, $4, 'Signalé', $5, $6, $7, $8, $9)
     RETURNING *`,
    [categorie, commune, description.trim(), photos, dateSignalement, lat, lon, emailValide, tokenSuppression]
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
