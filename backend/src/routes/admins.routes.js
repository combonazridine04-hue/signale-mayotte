import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import * as controleur from '../controllers/adminsController.js'

const router = Router()

router.use('/admins', requireAuth)
router.param('id', verifierParametreId('Compte introuvable.'))
router.get('/admins', controleur.listerAdmins)
router.get('/admins/me/2fa', controleur.etatDeuxFacteurs)
router.post('/admins/me/2fa/preparer', controleur.preparerDeuxFacteurs)
router.post('/admins/me/2fa/activer', controleur.activerDeuxFacteurs)
router.post('/admins/me/2fa/desactiver', controleur.desactiverDeuxFacteurs)
router.delete('/admins/:id/2fa', controleur.retirerDeuxFacteursAdmin)
router.post('/admins', controleur.creerAdmin)
router.delete('/admins/:id', controleur.supprimerAdmin)
router.patch('/admins/me/mot-de-passe', controleur.changerMotDePasse)

export default router
