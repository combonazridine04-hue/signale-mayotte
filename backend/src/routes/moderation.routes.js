import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth, requireAuthUtilisateur } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/moderationController.js'

const router = Router()

const limiteurSignalementAbus = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de signalements de contenu, réessayez plus tard.' }
})

router.param('cibleId', verifierParametreId('Contenu introuvable.'))
router.post('/moderation/signaler', requireAuthUtilisateur, limiteurSignalementAbus, controleur.signalerContenu)
router.get('/moderation/signalements-abus', requireAuth, controleur.listerSignalementsAbus)
router.delete('/moderation/signalements-abus/:type/:cibleId', requireAuth, controleur.traiterSignalementAbus)

export default router
