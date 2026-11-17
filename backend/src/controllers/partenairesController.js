import bcrypt from 'bcryptjs'
import * as Partenaire from '../models/partenaireModel.js'
import * as Signalement from '../models/signalementModel.js'
import { CATEGORIES, COMMUNES } from '../shared/signalement.js'
import { alertesPartenairesReelles, boiteTestPartenaires } from '../services/emailService.js'
import {
  creerSessionPartenaire,
  revoquerSessionsPartenaire,
  verifierIdentifiantsPartenaire
} from '../services/authService.js'
import { ouvrirSession } from '../services/sessionService.js'
import { motDePasseInterdit } from '../shared/motDePasse.js'
import { emailValide } from '../middlewares/validation.js'
import { journaliser } from '../services/journalService.js'
import { traiterPhoto } from '../middlewares/photoUpload.js'
import { supprimerPhoto } from '../config/storage.js'

// Cadre des logos : assez grand pour un écran net, assez petit pour une page légère.
const CADRE_LOGO = { largeur: 480, hauteur: 240 }

// « contact.outilo@gmail.com » → « co••••••••••••@gmail.com »
function masquerEmail(email) {
  const [nom, domaine] = String(email).split('@')
  return domaine ? `${nom.slice(0, 2)}${'•'.repeat(Math.max(1, nom.length - 2))}@${domaine}` : ''
}

function mapRow(row) {
  return {
    id: row.id,
    nom: row.nom,
    identifiant: row.identifiant,
    commune: row.commune,
    categories: row.categories || [],
    email: row.email || '',
    logoUrl: row.logo_url || '',
    creeLe: row.cree_le
  }
}

// Page d'accueil : ouverte à tous. Nom et logo seulement.
export const listerPartenairesPublics = async (req, res) => {
  const partenaires = await Partenaire.listerPublics()
  res.json(partenaires.map((p) => ({ nom: p.nom, logoUrl: p.logo_url || '' })))
}

export const changerLogoPartenaire = async (req, res) => {
  const id = Number(req.params.id)
  const partenaire = await Partenaire.trouver(id)
  if (!partenaire) return res.status(404).json({ erreur: 'Compte introuvable.' })
  if (!req.file) {
    return res.status(400).json({ erreur: 'Aucune image envoyée (formats acceptés : jpg, png, webp, gif).' })
  }

  const logoUrl = await traiterPhoto(req.file, { contenir: CADRE_LOGO })
  await Partenaire.mettreAJourLogo(id, logoUrl)
  if (partenaire.logo_url) await supprimerPhoto(partenaire.logo_url)

  journaliser(req, 'partenaire.logo', { cible: { type: 'partenaire', id, nom: partenaire.nom } })
  res.json({ logoUrl })
}

export const supprimerLogoPartenaire = async (req, res) => {
  const id = Number(req.params.id)
  const partenaire = await Partenaire.trouver(id)
  if (!partenaire) return res.status(404).json({ erreur: 'Compte introuvable.' })

  if (partenaire.logo_url) await supprimerPhoto(partenaire.logo_url)
  await Partenaire.mettreAJourLogo(id, null)
  res.status(204).end()
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

// Seule route de gestion ouverte au partenaire lui-même (déclarée avant
// router.use('/partenaires', requireAuth)) : combien de signalements de son périmètre
// sont arrivés depuis sa connexion précédente ?
export const nouveauxSignalementsPartenaire = async (req, res) => {
  if (!req.partenaire) return res.status(400).json({ erreur: 'Réservé aux comptes partenaires.' })
  const { commune, categories, depuis } = req.partenaire
  const nombre = await Signalement.compterNouveauxDansPerimetre({ commune, categories, depuis })
  res.json({ depuis: depuis || '', nombre })
}

// Gestion des comptes partenaires : réservée aux admins, comme pour les comptes admin.

export const listerPartenaires = async (req, res) => {
  const partenaires = await Partenaire.lister()
  res.json(partenaires.map(mapRow))
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
  if (await Partenaire.identifiantExiste(identifiantTrim)) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const partenaire = await Partenaire.creer({
    nom: nom.trim(),
    identifiant: identifiantTrim,
    motDePasseHash: await bcrypt.hash(motDePasse, 12),
    commune: commune || null,
    categories,
    email: emailPropre || null
  })

  journaliser(req, 'partenaire.creation', {
    cible: { type: 'partenaire', id: partenaire.id, nom: partenaire.nom },
    // Un document journal peut porter des champs propres à son type : ici le périmètre.
    details: { commune: partenaire.commune || 'toute l’île', categories: partenaire.categories || [] }
  })
  res.status(201).json(mapRow(partenaire))
}

export const supprimerPartenaire = async (req, res) => {
  const id = Number(req.params.id)

  const supprime = await Partenaire.supprimer(id)
  if (!supprime) return res.status(404).json({ erreur: 'Compte introuvable.' })
  const { nom } = supprime
  if (supprime.logo_url) await supprimerPhoto(supprime.logo_url)

  revoquerSessionsPartenaire(id)
  journaliser(req, 'partenaire.suppression', { cible: { type: 'partenaire', id, nom } })
  res.status(204).end()
}
