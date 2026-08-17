import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { revoquerSessionsDe } from '../auth.js'

const router = Router()

function mapRow(row) {
  return { id: row.id, identifiant: row.identifiant, creeLe: row.cree_le }
}

router.use(requireAuth)

router.get('/admins', async (req, res) => {
  const { rows } = await db.query('SELECT id, identifiant, cree_le FROM admins ORDER BY cree_le ASC')
  res.json(rows.map(mapRow))
})

router.post('/admins', async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  if (typeof identifiant !== 'string' || identifiant.trim().length < 3) {
    return res.status(400).json({ erreur: "L'identifiant doit contenir au moins 3 caractères." })
  }
  if (typeof motDePasse !== 'string' || motDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' })
  }

  const identifiantTrim = identifiant.trim()
  const { rows: existant } = await db.query('SELECT id FROM admins WHERE identifiant = $1', [identifiantTrim])
  if (existant.length) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const hash = await bcrypt.hash(motDePasse, 12)
  const { rows } = await db.query(
    'INSERT INTO admins (identifiant, mot_de_passe_hash, cree_le) VALUES ($1, $2, $3) RETURNING id, identifiant, cree_le',
    [identifiantTrim, hash, new Date().toISOString()]
  )

  res.status(201).json(mapRow(rows[0]))
})

router.delete('/admins/:id', async (req, res) => {
  const id = Number(req.params.id)

  if (id === req.admin.id) {
    return res.status(400).json({ erreur: 'Impossible de supprimer votre propre compte.' })
  }

  const { rows: total } = await db.query('SELECT COUNT(*)::int AS count FROM admins')
  if (total[0].count <= 1) {
    return res.status(400).json({ erreur: 'Impossible de supprimer le dernier compte admin.' })
  }

  const { rowCount } = await db.query('DELETE FROM admins WHERE id = $1', [id])
  if (!rowCount) return res.status(404).json({ erreur: 'Compte introuvable.' })

  revoquerSessionsDe(id)
  res.status(204).end()
})

router.patch('/admins/me/mot-de-passe', async (req, res) => {
  const { motDePasseActuel, nouveauMotDePasse } = req.body || {}

  if (typeof nouveauMotDePasse !== 'string' || nouveauMotDePasse.length < 8) {
    return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  }

  const { rows } = await db.query('SELECT * FROM admins WHERE id = $1', [req.admin.id])
  const admin = rows[0]
  if (!admin) return res.status(404).json({ erreur: 'Compte introuvable.' })

  const valide = await bcrypt.compare(String(motDePasseActuel || ''), admin.mot_de_passe_hash)
  if (!valide) {
    return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' })
  }

  const hash = await bcrypt.hash(nouveauMotDePasse, 12)
  await db.query('UPDATE admins SET mot_de_passe_hash = $1 WHERE id = $2', [hash, req.admin.id])

  res.status(204).end()
})

export default router
