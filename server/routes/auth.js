import { Router } from 'express'
import { verifierIdentifiants, creerSession, revoquerSession } from '../auth.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const admin = await verifierIdentifiants(identifiant, motDePasse)
  if (!admin) {
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }

  res.json({ token: creerSession(admin), identifiant: admin.identifiant })
})

router.post('/logout', (req, res) => {
  const enTete = req.headers.authorization || ''
  const token = enTete.startsWith('Bearer ') ? enTete.slice(7) : ''
  revoquerSession(token)
  res.status(204).end()
})

export default router
