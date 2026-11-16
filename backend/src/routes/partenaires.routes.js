import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth, requirePartenaireOuAdmin } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/partenairesController.js'

const router = Router()

const limiteurLoginPartenaire = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

router.post('/partenaires/login', limiteurLoginPartenaire, controleur.connexionPartenaire)
router.get('/partenaires/moi/nouveaux', requirePartenaireOuAdmin, controleur.nouveauxSignalementsPartenaire)
router.use('/partenaires', requireAuth)
router.param('id', verifierParametreId('Compte introuvable.'))
router.get('/partenaires', controleur.listerPartenaires)
router.get('/partenaires-alertes', requireAuth, controleur.etatAlertes)
router.post('/partenaires', controleur.creerPartenaire)
router.delete('/partenaires/:id', controleur.supprimerPartenaire)

export default router
