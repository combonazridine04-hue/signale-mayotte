import * as Signalement from '../models/signalementModel.js'
import * as Commentaire from '../models/commentaireModel.js'
import * as Utilisateur from '../models/utilisateurModel.js'
import { envoyerNouveauCommentaire } from '../services/emailService.js'
import { creerNotification } from '../services/notificationService.js'
import { nomPublic } from '../shared/nomPublic.js'
import { mapCommentaire } from '../services/signalements/representation.js'
import { emailSuiviSignalement } from '../services/signalements/suivi.js'
import { idValide, texte as lireTexte } from '../middlewares/validation.js'

// Commentaires et réponses sur un signalement.

export const ajouterCommentaire = async (req, res) => {
  const id = Number(req.params.id)
  const texte = lireTexte(req.body?.texte)
  const parentId = req.body?.parentId ?? null
  // L'auteur affiché vient toujours du compte connecté, jamais d'un champ du formulaire :
  // ça empêche de se faire passer pour quelqu'un d'autre. Le pseudo (s'il est défini)
  // est affiché à la place du vrai nom pour préserver la confidentialité promise à l'inscription.
  let auteur = `Admin (${req.admin?.identifiant})`
  let auteurAvatarUrl = null
  if (req.utilisateur) {
    const identite = await Utilisateur.trouverIdentitePublique(req.utilisateur.id)
    auteur = identite?.pseudo || nomPublic(identite?.nom || req.utilisateur.nom)
    auteurAvatarUrl = identite?.avatar_url || null
  }

  if (texte.trim().length < 3) {
    return res.status(400).json({ erreur: 'Le commentaire doit contenir au moins 3 caractères.' })
  }
  if (texte.trim().length > 1000) {
    return res.status(400).json({ erreur: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  }

  const signalement = await Signalement.trouverResume(id)
  if (!signalement) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Réponse à un commentaire : on vérifie qu'il appartient bien à CE signalement, sinon
  // on pourrait rattacher une réponse au fil d'un autre signalement.
  let parent = null
  if (parentId !== null && parentId !== '') {
    if (idValide(parentId) === null) return res.status(400).json({ erreur: 'Commentaire introuvable.' })
    parent = await Commentaire.trouverParent(Number(parentId), id)
    if (!parent) return res.status(400).json({ erreur: 'Commentaire introuvable.' })
  }

  // Un seul niveau d'imbrication : répondre à une réponse rattache au commentaire
  // d'origine, sinon les fils deviennent illisibles sur téléphone.
  const parentFinal = parent ? parent.parent_id || parent.id : null

  const commentaire = await Commentaire.creer({
    signalementId: id,
    auteur,
    texte: texte.trim(),
    utilisateurId: req.utilisateur?.id || null,
    parentId: parentFinal
  })

  // Personne n'est notifié de son propre message.
  const commenteSonPropreSignalement = req.utilisateur && signalement.utilisateur_id === req.utilisateur.id
  if (!commenteSonPropreSignalement) {
    // Dans le site : fonctionne pour tout le monde, email vérifié ou non.
    creerNotification(signalement.utilisateur_id, {
      signalementId: id,
      texte: `${auteur} a réagi à votre signalement (${signalement.categorie} — ${signalement.commune})`
    })

    const emailSignalement = await emailSuiviSignalement(id)
    if (emailSignalement) {
      envoyerNouveauCommentaire(signalement, emailSignalement, { auteur, texte: texte.trim(), estReponse: false })
    }
  }

  // Si c'est une réponse, l'auteur du commentaire visé est prévenu à son tour —
  // sauf s'il vient déjà d'être prévenu en tant qu'auteur du signalement.
  const repondASoiMeme = req.utilisateur && parent?.utilisateur_id === req.utilisateur.id
  const parentDejaPrevenu =
    parent && parent.utilisateur_id === signalement.utilisateur_id && !commenteSonPropreSignalement
  if (parent && !repondASoiMeme && !parentDejaPrevenu) {
    creerNotification(parent.utilisateur_id, {
      signalementId: id,
      texte: `${auteur} a répondu à votre commentaire`
    })

    if (parent.email_verifie && parent.email_auteur) {
      envoyerNouveauCommentaire(signalement, parent.email_auteur, { auteur, texte: texte.trim(), estReponse: true })
    }
  }

  res.status(201).json({ ...mapCommentaire(commentaire), auteurAvatarUrl })
}

// Un citoyen doit pouvoir retirer son propre commentaire : sans ça, publier une
// information personnelle par erreur oblige à écrire à un administrateur.
export const supprimerCommentaire = async (req, res) => {
  const commentaireId = Number(req.params.commentaireId)

  const commentaire = await Commentaire.trouverAuteur(commentaireId, Number(req.params.id))
  if (!commentaire) return res.status(404).json({ erreur: 'Commentaire introuvable.' })

  const estAuteur = req.utilisateur && commentaire.utilisateur_id === req.utilisateur.id
  if (!req.admin && !estAuteur) {
    return res.status(403).json({ erreur: 'Vous ne pouvez supprimer que vos propres commentaires.' })
  }

  await Commentaire.supprimer(commentaireId)
  res.status(204).end()
}
