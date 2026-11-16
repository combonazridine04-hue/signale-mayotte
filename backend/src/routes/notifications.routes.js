import { Router } from 'express'
import { requireAuthUtilisateur } from '../middlewares/requireAuth.js'
import * as controleur from '../controllers/notificationsController.js'

const router = Router()

router.get('/notifications', requireAuthUtilisateur, controleur.mesNotifications)
router.post('/notifications/lues', requireAuthUtilisateur, controleur.marquerLues)

export default router
