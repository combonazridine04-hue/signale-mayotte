import * as Signalement from '../models/signalementModel.js'
import * as MiseAJour from '../models/miseAJourModel.js'
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

  const signalement = await Signalement.trouverResume(id)
  if (!signalement) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Enregistré avant de prévenir : en cas d'échec, personne ne reçoit l'annonce d'un
  // message qui n'existe pas.
  const miseAJour = await MiseAJour.creerMiseAJour(id, texte.trim())

  // Un suivi publié sans prévenir personne ne sert à rien : le citoyen ne revient pas
  // consulter la page de lui-même.
  creerNotification(signalement.utilisateur_id, {
    signalementId: id,
    texte: `Du nouveau sur votre signalement (${signalement.categorie} — ${signalement.commune})`
  })

  const destinataire = await emailSuiviSignalement(id)
  if (destinataire) envoyerMiseAJourSignalement(signalement, destinataire, texte.trim())

  res.status(201).json(mapMiseAJour(miseAJour))
}

export const supprimerMiseAJour = async (req, res) => {
  const supprimee = await MiseAJour.supprimerMiseAJour(Number(req.params.miseAJourId), Number(req.params.id))
  if (!supprimee) return res.status(404).json({ erreur: 'Mise à jour introuvable.' })
  res.status(204).end()
}
