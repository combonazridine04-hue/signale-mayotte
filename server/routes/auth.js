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
  reinitialiserMotDePasse,
  recupererProfil,
  recupererStatsUtilisateur,
  mettreAJourPseudo,
  mettreAJourAvatar
} from '../auth.js'
import { envoyerVerificationEmail, envoyerReinitialisationMotDePasse } from '../mailer.js'
import { motDePasseInterdit } from '../../shared/motDePasse.js'
import { requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { creerUpload, traiterPhoto } from '../photoUpload.js'
import { supprimerPhoto } from '../storage.js'
import { contientContenuExplicite } from '../moderation.js'

const router = Router()

const limiteurRenvoiVerification = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de demandes, réessayez plus tard.' }
})

// Anti brute-force sur le code à 6 chiffres (1 million de combinaisons).
const limiteurVerificationCode = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, réessayez plus tard.' }
})

const limiteurAvatar = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, réessayez plus tard.' }
})

const uploadAvatar = creerUpload({ fileSize: 3 * 1024 * 1024, files: 1 })

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

// La validation du lien de réinitialisation était la seule route d'authentification
// sans limite : rien n'empêchait d'y essayer des jetons en rafale. Le jeton fait
// 64 caractères aléatoires, donc le deviner est hors de portée, mais une route
// d'authentification non limitée reste une porte ouverte à du bruit inutile.
const limiteurReinitialisation = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, réessayez plus tard.' }
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

  if (resultat.codeVerification) {
    envoyerVerificationEmail(resultat.utilisateur.nom, resultat.utilisateur.email, resultat.codeVerification)
  }

  res.status(201).json({
    token: creerSessionUtilisateur(resultat.utilisateur),
    nom: resultat.utilisateur.nom,
    emailAConfirmer: Boolean(resultat.codeVerification)
  })
})

router.post('/verifier-email', requireAuthUtilisateur, limiteurVerificationCode, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const ok = await confirmerEmailUtilisateur(req.utilisateur.id, req.body?.code)
  if (!ok) return res.status(400).json({ erreur: 'Code invalide ou expiré.' })
  res.json({ succes: true })
})

router.post('/renvoyer-verification', requireAuthUtilisateur, limiteurRenvoiVerification, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const resultat = await regenererTokenVerification(req.utilisateur.id)
  if (!resultat) {
    return res
      .status(400)
      .json({ erreur: 'Aucun email à vérifier sur ce compte (déjà vérifié, ou inscrit par téléphone).' })
  }
  envoyerVerificationEmail(resultat.nom, resultat.email, resultat.code)
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

router.get('/profil', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const profil = await recupererProfil(req.utilisateur.id)
  if (!profil) return res.status(404).json({ erreur: 'Compte introuvable.' })
  res.json({ ...profil, stats: await recupererStatsUtilisateur(req.utilisateur.id) })
})

router.patch('/profil', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const resultat = await mettreAJourPseudo(req.utilisateur.id, req.body?.pseudo)
  if (resultat.erreur) return res.status(400).json({ erreur: resultat.erreur })
  res.json(resultat)
})

router.patch('/avatar', requireAuthUtilisateur, limiteurAvatar, uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  if (!req.file) {
    return res.status(400).json({ erreur: 'Aucune image envoyée (formats acceptés : jpg, png, webp, gif).' })
  }
  if (await contientContenuExplicite(req.file.buffer)) {
    return res.status(400).json({ erreur: 'Cette photo a été refusée (contenu inapproprié détecté).' })
  }

  const ancienProfil = await recupererProfil(req.utilisateur.id)

  let avatarUrl
  try {
    avatarUrl = await traiterPhoto(req.file, { largeurMax: 256 })
  } catch {
    // Fichier accepté par son type MIME mais illisible (corrompu, renommé...) :
    // sans ça l'utilisateur reçoit le "Requête invalide." générique du serveur.
    return res.status(400).json({ erreur: "Cette image n'a pas pu être lue. Essayez un autre fichier." })
  }

  await mettreAJourAvatar(req.utilisateur.id, avatarUrl)
  if (ancienProfil?.avatarUrl) await supprimerPhoto(ancienProfil.avatarUrl)

  res.json({ avatarUrl })
})

router.delete('/avatar', requireAuthUtilisateur, async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const profil = await recupererProfil(req.utilisateur.id)
  if (profil?.avatarUrl) await supprimerPhoto(profil.avatarUrl)
  await mettreAJourAvatar(req.utilisateur.id, null)
  res.status(204).end()
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

router.post('/reinitialiser-mot-de-passe', limiteurReinitialisation, async (req, res) => {
  const { token, motDePasse } = req.body || {}

  const refus = motDePasseInterdit(motDePasse)
  if (refus) {
    return res.status(400).json({ erreur: refus })
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
