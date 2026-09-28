import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import { db } from '../db.js'
import { CATEGORIES, COMMUNES } from '../../src/models/signalement.js'
import { requireAuth, requirePartenaireOuAdmin } from '../middleware/requireAuth.js'
import { alertesPartenairesReelles, boiteTestPartenaires } from '../mailer.js'
import { creerSessionPartenaire, revoquerSessionsPartenaire, verifierIdentifiantsPartenaire } from '../auth.js'
import { motDePasseInterdit } from '../../shared/motDePasse.js'
import { emailValide, verifierParametreId } from '../validation.js'

// « benoblock440@gmail.com » → « be•••••••@gmail.com »
function masquerEmail(email) {
  const [nom, domaine] = String(email).split('@')
  return domaine ? `${nom.slice(0, 2)}${'•'.repeat(Math.max(1, nom.length - 2))}@${domaine}` : ''
}
import { ouvrirSession } from '../sessionCookie.js'

const router = Router()

const limiteurLoginPartenaire = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

function mapRow(row) {
  return {
    id: row.id,
    nom: row.nom,
    identifiant: row.identifiant,
    commune: row.commune,
    categories: row.categories || [],
    email: row.email || '',
    creeLe: row.cree_le
  }
}

// Connexion : ouverte à tous, comme celle des admins et des citoyens.
router.post('/partenaires/login', limiteurLoginPartenaire, async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const partenaire = await verifierIdentifiantsPartenaire(identifiant, motDePasse)
  if (!partenaire) {
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }

  ouvrirSession(req, res, creerSessionPartenaire(partenaire))
  res.json({
    nom: partenaire.nom,
    commune: partenaire.commune,
    categories: partenaire.categories,
    depuis: partenaire.depuis
  })
})

// Déclaré avant router.use('/partenaires', requireAuth) : c'est la seule route de
// gestion ouverte au partenaire lui-même. Combien de signalements de son périmètre
// sont arrivés depuis sa connexion précédente ?
router.get('/partenaires/moi/nouveaux', requirePartenaireOuAdmin, async (req, res) => {
  if (!req.partenaire) return res.status(400).json({ erreur: 'Réservé aux comptes partenaires.' })
  const { commune, categories, depuis } = req.partenaire
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS nombre FROM signalements
     WHERE date_signalement > $1
       AND ($2::text IS NULL OR commune = $2)
       AND (cardinality($3::text[]) = 0 OR categorie = ANY($3::text[]))`,
    [depuis || '', commune || null, categories]
  )
  res.json({ depuis: depuis || '', nombre: rows[0].nombre })
})

// Gestion des comptes partenaires : réservée aux admins, comme pour les comptes admin.
// Limité à /partenaires (et non un router.use() global) pour la même raison que dans
// admins.js : une route inconnue montée après doit répondre 404, pas 401.
router.use('/partenaires', requireAuth)

router.param('id', verifierParametreId('Compte introuvable.'))

router.get('/partenaires', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM partenaires ORDER BY cree_le ASC')
  res.json(rows.map(mapRow))
})

// Pour que l'admin sache où partent réellement les alertes.
router.get('/partenaires-alertes', requireAuth, (req, res) => {
  res.json({ reelles: alertesPartenairesReelles, boiteTest: masquerEmail(boiteTestPartenaires) })
})

router.post('/partenaires', async (req, res) => {
  const { nom, identifiant, motDePasse, commune, email } = req.body || {}
  const categories = [...new Set(Array.isArray(req.body?.categories) ? req.body.categories : [])]

  if (typeof nom !== 'string' || nom.trim().length < 2) {
    return res.status(400).json({ erreur: 'Le nom doit contenir au moins 2 caractères.' })
  }
  if (typeof identifiant !== 'string' || identifiant.trim().length < 3) {
    return res.status(400).json({ erreur: "L'identifiant doit contenir au moins 3 caractères." })
  }
  const refus = motDePasseInterdit(motDePasse)
  if (refus) return res.status(400).json({ erreur: refus })
  // Vide = le partenaire voit les signalements de toutes les communes (ex. un service
  // départemental) ; sinon il est cantonné à une seule, choisie dans la même liste
  // fermée que pour un signalement.
  if (commune && !COMMUNES.includes(commune)) {
    return res.status(400).json({ erreur: 'Commune invalide.' })
  }
  // Vide = tous les domaines ; sinon uniquement des catégories existantes.
  if (categories.some((c) => !CATEGORIES.includes(c))) {
    return res.status(400).json({ erreur: 'Domaine invalide.' })
  }
  // Facultative : sans adresse, le partenaire consulte son espace mais n'est pas alerté.
  const emailPropre = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (emailPropre && !emailValide(emailPropre)) {
    return res.status(400).json({ erreur: 'Adresse e-mail invalide.' })
  }

  const identifiantTrim = identifiant.trim()
  const { rows: existant } = await db.query('SELECT id FROM partenaires WHERE identifiant = $1', [identifiantTrim])
  if (existant.length) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  const { rows } = await db.query(
    `INSERT INTO partenaires (nom, identifiant, mot_de_passe_hash, commune, categories, email, cree_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [nom.trim(), identifiantTrim, hash, commune || null, categories, emailPropre || null, new Date().toISOString()]
  )

  res.status(201).json(mapRow(rows[0]))
})

router.delete('/partenaires/:id', async (req, res) => {
  const id = Number(req.params.id)

  const { rowCount } = await db.query('DELETE FROM partenaires WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ erreur: 'Compte introuvable.' })

  revoquerSessionsPartenaire(id)
  res.status(204).end()
})

export default router
