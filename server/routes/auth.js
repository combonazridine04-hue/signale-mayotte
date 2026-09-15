import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  verifierIdentifiants,
  creerSession,
  revoquerSession,
  inscrireUtilisateur,
  verifierIdentifiantsUtilisateur,
  creerSessionUtilisateur,
  confirmerEmailUtilisateur,
  regenererTokenVerification,
  genererTokenReinitialisation,
  reinitialiserMotDePasse
} from '../auth.js'
import { envoyerVerificationEmail, envoyerReinitialisationMotDePasse } from '../mailer.js'
import { requireAuthUtilisateur } from '../middleware/requireAuth.js'

const router = Router()

const limiteurRenvoiVerification = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de demandes, réessayez plus tard.' }
})

const limiteurInscription = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: "Trop de tentatives d'inscription, réessayez plus tard." }
})

const limiteurConnexionUtilisateur = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

const limiteurMotDePasseOublie = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de demandes, réessayez plus tard.' }
})

router.post('/login', async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const admin = await verifierIdentifiants(identifiant, motDePasse)
  if (!admin) {
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }

  res.json({ token: creerSession(admin), identifiant: admin.identifiant })
})

router.post('/inscription', limiteurInscription, async (req, res) => {
  const { nom, email, telephone, motDePasse, site_web: honeypot } = req.body || {}

  if (honeypot) {
    return res.status(400).json({ erreur: 'Inscription impossible.' })
  }

  const resultat = await inscrireUtilisateur({ nom, email, telephone, motDePasse })
  if (resultat.erreur) {
    return res.status(400).json({ erreur: resultat.erreur })
  }

  if (resultat.tokenVerification) {
    envoyerVerificationEmail(resultat.utilisateur.nom, resultat.utilisateur.email, resultat.tokenVerification)
  }

  res.status(201).json({ token: creerSessionUtilisateur(resultat.utilisateur), nom: resultat.utilisateur.nom })
})

router.get('/verifier-email', async (req, res) => {
  const ok = await confirmerEmailUtilisateur(req.query.token)
  if (!ok) return res.status(400).json({ erreur: 'Lien de vérification invalide ou déjà utilisé.' })
  res.json({ succes: true })
})

router.post('/renvoyer-verification', requireAuthUtilisateur, limiteurRenvoiVerification, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const resultat = await regenererTokenVerification(req.utilisateur.id)
  if (!resultat) {
    return res.status(400).json({ erreur: 'Aucun email à vérifier sur ce compte (déjà vérifié, ou inscrit par téléphone).' })
  }
  envoyerVerificationEmail(resultat.nom, resultat.email, resultat.token)
  res.status(204).end()
})

router.post('/connexion', limiteurConnexionUtilisateur, async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const utilisateur = await verifierIdentifiantsUtilisateur(identifiant, motDePasse)
  if (!utilisateur) {
    return res.status(401).json({ erreur: 'Identifiants incorrects.' })
  }

  res.json({ token: creerSessionUtilisateur(utilisateur), nom: utilisateur.nom })
})

router.post('/mot-de-passe-oublie', limiteurMotDePasseOublie, async (req, res) => {
  const { email } = req.body || {}

  const resultat = await genererTokenReinitialisation(email)
  if (resultat) {
    envoyerReinitialisationMotDePasse(resultat.nom, resultat.email, resultat.token)
  }

  // Réponse identique que le compte existe ou non, pour ne pas révéler les emails inscrits.
  res.status(204).end()
})

router.post('/reinitialiser-mot-de-passe', async (req, res) => {
  const { token, motDePasse } = req.body || {}

  if (!motDePasse || motDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' })
  }

  const ok = await reinitialiserMotDePasse(token, motDePasse)
  if (!ok) {
    return res.status(400).json({ erreur: 'Lien de réinitialisation invalide ou expiré.' })
  }

  res.status(204).end()
})

router.post('/logout', (req, res) => {
  const enTete = req.headers.authorization || ''
  const token = enTete.startsWith('Bearer ') ? enTete.slice(7) : ''
  revoquerSession(token)
  res.status(204).end()
})

export default router
