import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { requireAuth } from '../middlewares/requireAuth.js'
import { verifierParametreId } from '../middlewares/validation.js'
import { exigerCaptcha } from '../services/captchaService.js'
import * as controleur from '../controllers/contactController.js'

const router = Router()

const limiteurContact = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de messages envoyés, réessayez plus tard.' }
})

router.param('id', verifierParametreId('Message introuvable.'))
router.post('/contact', limiteurContact, exigerCaptcha, controleur.envoyerMessage)
router.get('/contact', requireAuth, controleur.listerMessages)
router.patch('/contact/:id', requireAuth, controleur.modifierMessage)
router.delete('/contact/:id', requireAuth, controleur.supprimerMessage)

export default router
