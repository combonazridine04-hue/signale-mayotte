import { Router } from 'express'
import { limiteurCommentaire } from '../middlewares/limiteurs.js'
import { requireAuthUtilisateur } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/commentairesController.js'

const router = Router()

router.param('id', verifierParametreId('Signalement introuvable.'))
router.param('commentaireId', verifierParametreId('Commentaire introuvable.'))
router.post(
  '/signalements/:id/commentaires',
  requireAuthUtilisateur,
  limiteurCommentaire,
  controleur.ajouterCommentaire
)
router.delete('/signalements/:id/commentaires/:commentaireId', requireAuthUtilisateur, controleur.supprimerCommentaire)

export default router
