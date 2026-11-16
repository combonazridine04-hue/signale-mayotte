import { db } from '../config/db.js'
import { envoyerMiseAJourSignalement } from '../services/emailService.js'
import { creerNotification } from '../services/notificationService.js'
import { mapMiseAJour } from '../services/signalements/representation.js'
import { emailSuiviSignalement } from '../services/signalements/suivi.js'

// Mises à jour publiques d'un signalement : le suivi officiel publié par un administrateur.

export const ajouterMiseAJour = async (req, res) => {
  const id = Number(req.params.id)
  const { texte } = req.body || {}

  if (typeof texte !== 'string' || texte.trim().length < 3) {
    return res.status(400).json({ erreur: 'Le message doit contenir au moins 3 caractères.' })
  }
  if (texte.trim().length > 1000) {
    return res.status(400).json({ erreur: 'Le message ne doit pas dépasser 1000 caractères.' })
  }

  const { rows: existant } = await db.query(
    'SELECT id, categorie, commune, utilisateur_id FROM signalements WHERE id = ?',
    [id]
  )
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Enregistré avant de prévenir : en cas d'échec, personne ne reçoit l'annonce d'un
  // message qui n'existe pas.
  const { rows } = await db.query(
    'INSERT INTO mises_a_jour (signalement_id, texte, date_creation) VALUES (?, ?, ?) RETURNING *',
    [id, texte.trim(), new Date().toISOString()]
  )

  // Un suivi publié sans prévenir personne ne sert à rien : le citoyen ne revient pas
  // consulter la page de lui-même.
  creerNotification(existant[0].utilisateur_id, {
    signalementId: id,
    texte: `Du nouveau sur votre signalement (${existant[0].categorie} — ${existant[0].commune})`
  })

  const destinataire = await emailSuiviSignalement(id)
  if (destinataire) envoyerMiseAJourSignalement(existant[0], destinataire, texte.trim())

  res.status(201).json(mapMiseAJour(rows[0]))
}

export const supprimerMiseAJour = async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM mises_a_jour WHERE id = ? AND signalement_id = ?', [
    Number(req.params.miseAJourId),
    Number(req.params.id)
  ])
  if (!rowCount) return res.status(404).json({ erreur: 'Mise à jour introuvable.' })
  res.status(204).end()
}
