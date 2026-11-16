import * as Signalement from '../models/signalementModel.js'
import * as Commentaire from '../models/commentaireModel.js'
import * as SignalementAbus from '../models/signalementAbusModel.js'
import { envoyerAlerteContenuAbusif } from '../services/emailService.js'
import { journaliser } from '../services/journalService.js'
import { idValide } from '../middlewares/validation.js'

const TYPES_AUTORISES = new Set(['signalement', 'commentaire'])

async function alerterAssociation(type, id, motif) {
  const contenu = type === 'commentaire' ? await Commentaire.trouverExtrait(id) : await Signalement.trouverExtrait(id)
  if (!contenu) return
  await envoyerAlerteContenuAbusif({
    type,
    signalementId: contenu.signalement_id,
    extrait: String(contenu.extrait || '').slice(0, 300),
    motif: typeof motif === 'string' ? motif.trim().slice(0, 500) : ''
  })
}

export const signalerContenu = async (req, res) => {
  const { type, cibleId, motif } = req.body || {}

  if (!TYPES_AUTORISES.has(type)) {
    return res.status(400).json({ erreur: 'Type invalide.' })
  }
  const id = idValide(cibleId)
  if (id === null) {
    return res.status(400).json({ erreur: 'Cible invalide.' })
  }

  try {
    await SignalementAbus.creer({
      type,
      cibleId: id,
      motif: typeof motif === 'string' ? motif.trim().slice(0, 500) : null,
      utilisateurId: req.utilisateur?.id || null
    })
    // 204 et pas 201 : la réponse n'a pas de corps, et le client tentait d'y lire du JSON.
    res.status(204).end()
    // Après la réponse : l'alerte de l'association ne doit ni ralentir ni faire échouer
    // l'enregistrement du signalement d'abus.
    alerterAssociation(type, id, req.body?.motif).catch((e) =>
      console.error("[moderation] Échec de l'alerte de l'association :", e.message)
    )
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erreur: 'Vous avez déjà signalé ce contenu.' })
    }
    throw e
  }
}

export const listerSignalementsAbus = async (req, res) => {
  const groupes = await SignalementAbus.listerParCible()

  const resultats = []
  for (const groupe of groupes) {
    const apercu =
      (groupe.type === 'signalement'
        ? await Signalement.trouverApercu(groupe.cible_id)
        : await Commentaire.trouverApercu(groupe.cible_id)) || null
    resultats.push({
      type: groupe.type,
      cibleId: groupe.cible_id,
      nbSignalements: groupe.nb_signalements,
      dernierSignalement: groupe.dernier_signalement,
      // Les motifs laissés vides arrivent en null dans la liste : on ne garde que les vrais.
      motifs: (groupe.motifs || []).filter(Boolean),
      existeEncore: Boolean(apercu),
      apercu
    })
  }

  res.json({ signalementsAbus: resultats })
}

export const traiterSignalementAbus = async (req, res) => {
  const retires = await SignalementAbus.supprimerPourCible(req.params.type, Number(req.params.cibleId))
  if (retires) {
    journaliser(req, 'moderation.ignore', {
      cible: { type: String(req.params.type).slice(0, 20), id: Number(req.params.cibleId) },
      details: { signalementsAbusRetires: retires }
    })
  }
  res.status(204).end()
}
