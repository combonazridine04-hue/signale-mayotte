import { envoyerMessageContact, mailerActif } from '../services/emailService.js'
import * as Contact from '../models/contactModel.js'
import { SUJETS_CONTACT } from '../shared/sujetsContact.js'
import { texte, emailValide } from '../middlewares/validation.js'

function mapRow(row) {
  return {
    id: row.id,
    nom: row.nom,
    email: row.email,
    sujet: row.sujet,
    message: row.message,
    dateEnvoi: row.date_envoi,
    lu: row.lu
  }
}

export const envoyerMessage = async (req, res) => {
  const corps = req.body || {}
  const nom = texte(corps.nom)
  const email = texte(corps.email).trim()
  const sujet = texte(corps.sujet)
  const message = texte(corps.message)
  const honeypot = corps.site_web

  if (honeypot) {
    return res.status(202).json({ envoye: true })
  }

  if (nom.trim().length < 2) {
    return res.status(400).json({ erreur: 'Le nom doit contenir au moins 2 caractères.' })
  }
  if (nom.trim().length > 100) {
    return res.status(400).json({ erreur: 'Le nom ne doit pas dépasser 100 caractères.' })
  }
  if (!emailValide(email)) {
    return res.status(400).json({ erreur: 'Veuillez saisir une adresse email valide.' })
  }
  if (!SUJETS_CONTACT.includes(sujet)) {
    return res.status(400).json({ erreur: 'Veuillez sélectionner un sujet.' })
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ erreur: 'Le message doit contenir au moins 10 caractères.' })
  }
  if (message.trim().length > 3000) {
    return res.status(400).json({ erreur: 'Le message ne doit pas dépasser 3000 caractères.' })
  }

  const nomTrim = nom.trim()
  const messageTrim = message.trim()

  await Contact.creerMessage({
    nom: nomTrim,
    email,
    sujet,
    message: messageTrim,
    dateEnvoi: new Date().toISOString()
  })

  if (mailerActif) {
    try {
      await envoyerMessageContact({ nom: nomTrim, email, sujet, message: messageTrim })
    } catch (e) {
      console.error('[contact] Échec envoi email :', e.message)
    }
  }

  res.status(202).json({ envoye: true })
}

export const listerMessages = async (req, res) => {
  const messages = await Contact.listerMessages()
  res.json(messages.map(mapRow))
}

export const modifierMessage = async (req, res) => {
  const message = await Contact.marquerLu(Number(req.params.id), Boolean(req.body?.lu))
  if (!message) return res.status(404).json({ erreur: 'Message introuvable.' })
  res.json(mapRow(message))
}

export const supprimerMessage = async (req, res) => {
  const supprime = await Contact.supprimerMessage(Number(req.params.id))
  if (!supprime) return res.status(404).json({ erreur: 'Message introuvable.' })
  res.status(204).end()
}
