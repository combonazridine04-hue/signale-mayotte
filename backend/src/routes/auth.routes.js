import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuthUtilisateur } from '../middlewares/requireAuth.js'
import { creerUpload } from '../middlewares/photoUpload.js'
import { exigerCaptcha } from '../services/captchaService.js'
import * as controleur from '../controllers/authController.js'

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

// Confirmer une suppression de compte exige le mot de passe : on limite les essais.
const limiteurSuppressionCompte = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives, réessayez plus tard.' }
})

router.post('/login', controleur.connexionAdmin)
router.post('/inscription', limiteurInscription, exigerCaptcha, controleur.inscription)
router.post('/verifier-email', requireAuthUtilisateur, limiteurVerificationCode, controleur.verifierEmail)
router.post(
  '/renvoyer-verification',
  requireAuthUtilisateur,
  limiteurRenvoiVerification,
  controleur.renvoyerVerification
)
router.post('/connexion', limiteurConnexionUtilisateur, controleur.connexion)
router.get('/session', controleur.session)
router.get('/profil', requireAuthUtilisateur, controleur.lireProfil)
router.patch('/profil', requireAuthUtilisateur, controleur.modifierProfil)
router.patch('/avatar', requireAuthUtilisateur, limiteurAvatar, uploadAvatar.single('avatar'), controleur.changerAvatar)
router.delete('/avatar', requireAuthUtilisateur, controleur.supprimerAvatar)
router.post('/mot-de-passe-oublie', limiteurMotDePasseOublie, exigerCaptcha, controleur.motDePasseOublie)
router.post('/reinitialiser-mot-de-passe', limiteurReinitialisation, controleur.nouveauMotDePasse)
router.get('/mes-donnees', requireAuthUtilisateur, controleur.mesDonnees)
router.delete('/compte', requireAuthUtilisateur, limiteurSuppressionCompte, controleur.supprimerCompte)
router.post('/logout', controleur.deconnexion)

export default router
