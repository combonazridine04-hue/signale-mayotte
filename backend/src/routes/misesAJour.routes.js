import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/misesAJourController.js'

const router = Router()

router.param('id', verifierParametreId('Signalement introuvable.'))
router.param('miseAJourId', verifierParametreId('Mise à jour introuvable.'))
router.post('/signalements/:id/mises-a-jour', requireAuth, controleur.ajouterMiseAJour)
router.delete('/signalements/:id/mises-a-jour/:miseAJourId', requireAuth, controleur.supprimerMiseAJour)

export default router
