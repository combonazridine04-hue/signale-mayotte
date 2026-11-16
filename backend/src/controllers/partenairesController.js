import bcrypt from 'bcryptjs'
import { db } from '../config/db.js'
import { CATEGORIES, COMMUNES } from '../shared/signalement.js'
import { alertesPartenairesReelles, boiteTestPartenaires } from '../services/emailService.js'
import {
  creerSessionPartenaire,
  revoquerSessionsPartenaire,
  verifierIdentifiantsPartenaire
} from '../services/authService.js'
import { motDePasseInterdit } from '../shared/motDePasse.js'
import { emailValide } from '../middlewares/validation.js'
import { journaliser } from '../services/journalService.js'

// « benoblock440@gmail.com » → « be•••••••@gmail.com »
function masquerEmail(email) {
  const [nom, domaine] = String(email).split('@')
  return domaine ? `${nom.slice(0, 2)}${'•'.repeat(Math.max(1, nom.length - 2))}@${domaine}` : ''
}
import { ouvrirSession } from '../services/sessionService.js'

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
export const connexionPartenaire = async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const partenaire = await verifierIdentifiantsPartenaire(identifiant, motDePasse)
  if (!partenaire) {
    journaliser(req, 'partenaire.connexion', { resultat: 'echec', details: { motif: 'identifiants' } })
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }

  ouvrirSession(req, res, creerSessionPartenaire(partenaire))
  journaliser(req, 'partenaire.connexion', { acteur: { type: 'partenaire', id: partenaire.id, nom: partenaire.nom } })
  res.json({
    nom: partenaire.nom,
    commune: partenaire.commune,
    categories: partenaire.categories,
    depuis: partenaire.depuis
  })
}

// Déclaré avant router.use('/partenaires', requireAuth) : c'est la seule route de
// gestion ouverte au partenaire lui-même. Combien de signalements de son périmètre
// sont arrivés depuis sa connexion précédente ?
export const nouveauxSignalementsPartenaire = async (req, res) => {
  if (!req.partenaire) return res.status(400).json({ erreur: 'Réservé aux comptes partenaires.' })
  const { commune, categories, depuis } = req.partenaire
  // Périmètre : commune NULL = toute l'île ; liste de domaines vide = tous les domaines.
  const domaines = JSON.stringify(categories || [])
  const { rows } = await db.query(
    `SELECT COUNT(*) AS nombre FROM signalements
     WHERE date_signalement > ?
       AND (? IS NULL OR commune = ?)
       AND (JSON_LENGTH(?) = 0 OR JSON_CONTAINS(?, JSON_QUOTE(categorie)))`,
    [depuis || '', commune || null, commune || null, domaines, domaines]
  )
  res.json({ depuis: depuis || '', nombre: rows[0].nombre })
}

// Gestion des comptes partenaires : réservée aux admins, comme pour les comptes admin.
// Limité à /partenaires (et non un router.use() global) pour la même raison que dans
// admins.js : une route inconnue montée après doit répondre 404, pas 401.

export const listerPartenaires = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM partenaires ORDER BY cree_le ASC')
  res.json(rows.map(mapRow))
}

// Pour que l'admin sache où partent réellement les alertes.
export const etatAlertes = (req, res) => {
  res.json({ reelles: alertesPartenairesReelles, boiteTest: masquerEmail(boiteTestPartenaires) })
}

export const creerPartenaire = async (req, res) => {
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
  const { rows: existant } = await db.query('SELECT id FROM partenaires WHERE identifiant = ?', [identifiantTrim])
  if (existant.length) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  const { rows } = await db.query(
    `INSERT INTO partenaires (nom, identifiant, mot_de_passe_hash, commune, categories, email, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      nom.trim(),
      identifiantTrim,
      hash,
      commune || null,
      // Colonne JSON : la liste est enregistrée sous forme de texte JSON.
      JSON.stringify(categories),
      emailPropre || null,
      new Date().toISOString()
    ]
  )

  journaliser(req, 'partenaire.creation', {
    cible: { type: 'partenaire', id: rows[0].id, nom: rows[0].nom },
    // Un document journal peut porter des champs propres à son type : ici le périmètre.
    details: { commune: rows[0].commune || 'toute l’île', categories: rows[0].categories || [] }
  })
  res.status(201).json(mapRow(rows[0]))
}

export const supprimerPartenaire = async (req, res) => {
  const id = Number(req.params.id)

  const { rows: supprime } = await db.query('DELETE FROM partenaires WHERE id = ? RETURNING nom', [id])
  if (!supprime.length) return res.status(404).json({ erreur: 'Compte introuvable.' })

  revoquerSessionsPartenaire(id)
  journaliser(req, 'partenaire.suppression', { cible: { type: 'partenaire', id, nom: supprime[0].nom } })
  res.status(204).end()
}
