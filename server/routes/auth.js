import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  verifierIdentifiants,
  creerSession,
  revoquerSession,
  inscrireUtilisateur,
  verifierIdentifiantsUtilisateur,
  creerSessionUtilisateur
} from '../auth.js'

const router = Router()

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

router.post('/login', async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const admin = await verifierIdentifiants(identifiant, motDePasse)
  if (!admin) {
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }

  res.json({ token: creerSession(admin), identifiant: admin.identifiant })
})

router.post('/inscription', limiteurInscription, async (req, res) => {
  const { nom, email, telephone, motDePasse } = req.body || {}

  const resultat = await inscrireUtilisateur({ nom, email, telephone, motDePasse })
  if (resultat.erreur) {
    return res.status(400).json({ erreur: resultat.erreur })
  }

  res.status(201).json({ token: creerSessionUtilisateur(resultat.utilisateur), nom: resultat.utilisateur.nom })
})

router.post('/connexion', limiteurConnexionUtilisateur, async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const utilisateur = await verifierIdentifiantsUtilisateur(identifiant, motDePasse)
  if (!utilisateur) {
    return res.status(401).json({ erreur: 'Identifiants incorrects.' })
  }

  res.json({ token: creerSessionUtilisateur(utilisateur), nom: utilisateur.nom })
})

router.post('/logout', (req, res) => {
  const enTete = req.headers.authorization || ''
  const token = enTete.startsWith('Bearer ') ? enTete.slice(7) : ''
  revoquerSession(token)
  res.status(204).end()
})

export default router
