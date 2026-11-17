import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth, requirePartenaireOuAdmin } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/partenairesController.js'
import { creerUpload } from '../middlewares/photoUpload.js'

const router = Router()

// Un seul fichier de 2 Mo au plus : un logo n'a pas besoin de plus.
const uploadLogo = creerUpload({ fileSize: 2 * 1024 * 1024, files: 1 })

const limiteurLoginPartenaire = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

router.post('/partenaires/login', limiteurLoginPartenaire, controleur.connexionPartenaire)
// Vitrine de la page d'accueil : publique (hors du préfixe /partenaires protégé ci-dessous).
router.get('/partenaires-publics', controleur.listerPartenairesPublics)
router.get('/partenaires/moi/nouveaux', requirePartenaireOuAdmin, controleur.nouveauxSignalementsPartenaire)
router.use('/partenaires', requireAuth)
router.param('id', verifierParametreId('Compte introuvable.'))
router.get('/partenaires', controleur.listerPartenaires)
router.get('/partenaires-alertes', requireAuth, controleur.etatAlertes)
router.post('/partenaires', controleur.creerPartenaire)
router.delete('/partenaires/:id', controleur.supprimerPartenaire)
router.put('/partenaires/:id/logo', uploadLogo.single('logo'), controleur.changerLogoPartenaire)
router.delete('/partenaires/:id/logo', controleur.supprimerLogoPartenaire)

export default router
