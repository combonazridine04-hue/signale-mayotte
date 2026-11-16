import { Router } from 'express'
import { requireAuth, requireAuthUtilisateur, requirePartenaireOuAdmin } from '../middlewares/requireAuth.js'
import { limiteurCreation, limiteurSoutien } from '../middlewares/limiteurs.js'
import { MAX_PHOTOS, upload } from '../services/signalements/photos.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/signalementsController.js'

const router = Router()

router.param('id', verifierParametreId('Signalement introuvable.'))
router.get('/signalements/count', controleur.compter)
router.get('/signalements/stats', requireAuth, controleur.statistiques)
router.get('/signalements/stats-publiques', controleur.statistiquesPubliques)
router.get('/signalements/export.csv', requireAuth, controleur.exporterCsv)
router.get('/signalements/similaires', controleur.similaires)
router.get('/signalements/mes', requireAuthUtilisateur, controleur.mesSignalements)
router.get('/signalements/:id', controleur.lireSignalement)
router.get('/signalements', controleur.listerSignalements)
router.post('/signalements/:id/soutenir', requireAuthUtilisateur, limiteurSoutien, controleur.soutenir)
router.post(
  '/signalements',
  requireAuthUtilisateur,
  limiteurCreation,
  upload.array('photos', MAX_PHOTOS),
  controleur.creerSignalement
)
router.patch('/signalements/:id', requirePartenaireOuAdmin, upload.single('photoResolution'), controleur.modifierStatut)
router.put('/signalements/:id', upload.array('photos', MAX_PHOTOS), controleur.modifierSignalement)
router.delete('/signalements/:id', controleur.supprimerSignalement)

export default router
