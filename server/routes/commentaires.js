import { Router } from 'express'
import { db } from '../db.js'
import { envoyerNouveauCommentaire } from '../mailer.js'
import { limiteurCommentaire } from '../middleware/limiteurs.js'
import { requireAuthUtilisateur } from '../middleware/requireAuth.js'
import { creerNotification } from '../notifications.js'
import { nomPublic } from '../../shared/nomPublic.js'
import { mapCommentaire } from '../signalements/representation.js'
import { emailSuiviSignalement } from '../signalements/suivi.js'
import { idValide, texte as lireTexte, verifierParametreId } from '../validation.js'

// Commentaires et réponses sur un signalement.

const router = Router()

router.param('id', verifierParametreId('Signalement introuvable.'))
router.param('commentaireId', verifierParametreId('Commentaire introuvable.'))

router.post('/signalements/:id/commentaires', requireAuthUtilisateur, limiteurCommentaire, async (req, res) => {
  const id = Number(req.params.id)
  const texte = lireTexte(req.body?.texte)
  const parentId = req.body?.parentId ?? null
  // L'auteur affiché vient toujours du compte connecté, jamais d'un champ du formulaire :
  // ça empêche de se faire passer pour quelqu'un d'autre. Le pseudo (s'il est défini)
  // est affiché à la place du vrai nom pour préserver la confidentialité promise à l'inscription.
  let auteur = `Admin (${req.admin?.identifiant})`
  let auteurAvatarUrl = null
  if (req.utilisateur) {
    const { rows } = await db.query('SELECT nom, pseudo, avatar_url FROM utilisateurs WHERE id = $1', [
      req.utilisateur.id
    ])
    auteur = rows[0]?.pseudo || nomPublic(rows[0]?.nom || req.utilisateur.nom)
    auteurAvatarUrl = rows[0]?.avatar_url || null
  }

  if (texte.trim().length < 3) {
    return res.status(400).json({ erreur: 'Le commentaire doit contenir au moins 3 caractères.' })
  }
  if (texte.trim().length > 1000) {
    return res.status(400).json({ erreur: 'Le commentaire ne doit pas dépasser 1000 caractères.' })
  }

  const { rows: existant } = await db.query(
    'SELECT id, categorie, commune, utilisateur_id FROM signalements WHERE id = $1',
    [id]
  )
  if (!existant.length) return res.status(404).json({ erreur: 'Signalement introuvable.' })
  const signalement = existant[0]

  // Réponse à un commentaire : on vérifie qu'il appartient bien à CE signalement, sinon
  // on pourrait rattacher une réponse au fil d'un autre signalement.
  let parent = null
  if (parentId !== null && parentId !== '') {
    if (idValide(parentId) === null) return res.status(400).json({ erreur: 'Commentaire introuvable.' })
    const { rows: parents } = await db.query(
      `SELECT c.id, c.parent_id, c.utilisateur_id, u.email AS email_auteur, u.email_verifie
       FROM commentaires c
       LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
       WHERE c.id = $1 AND c.signalement_id = $2`,
      [Number(parentId), id]
    )
    if (!parents.length) return res.status(400).json({ erreur: 'Commentaire introuvable.' })
    parent = parents[0]
  }

  // Un seul niveau d'imbrication : répondre à une réponse rattache au commentaire
  // d'origine, sinon les fils deviennent illisibles sur téléphone.
  const parentFinal = parent ? parent.parent_id || parent.id : null

  const { rows } = await db.query(
    'INSERT INTO commentaires (signalement_id, auteur, texte, date_creation, utilisateur_id, parent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [id, auteur, texte.trim(), new Date().toISOString(), req.utilisateur?.id || null, parentFinal]
  )

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

  res.status(201).json({ ...mapCommentaire(rows[0]), auteurAvatarUrl })
})

// Un citoyen doit pouvoir retirer son propre commentaire : sans ça, publier une
// information personnelle par erreur oblige à écrire à un administrateur.
router.delete('/signalements/:id/commentaires/:commentaireId', requireAuthUtilisateur, async (req, res) => {
  const commentaireId = Number(req.params.commentaireId)
  const signalementId = Number(req.params.id)

  const { rows } = await db.query('SELECT utilisateur_id FROM commentaires WHERE id = $1 AND signalement_id = $2', [
    commentaireId,
    signalementId
  ])
  if (!rows.length) return res.status(404).json({ erreur: 'Commentaire introuvable.' })

  const estAuteur = req.utilisateur && rows[0].utilisateur_id === req.utilisateur.id
  if (!req.admin && !estAuteur) {
    return res.status(403).json({ erreur: 'Vous ne pouvez supprimer que vos propres commentaires.' })
  }

  await db.query('DELETE FROM commentaires WHERE id = $1', [commentaireId])
  res.status(204).end()
})

export default router
