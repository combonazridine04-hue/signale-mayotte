import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import * as controleur from '../controllers/journalController.js'

const router = Router()

router.use('/journal', requireAuth)
router.get('/journal', controleur.consulterJournal)
router.get('/journal/statistiques', controleur.statistiquesDuJournal)

export default router
