import crypto from 'node:crypto'
import * as Signalement from '../models/signalementModel.js'
import * as Soutien from '../models/soutienModel.js'
import * as Commentaire from '../models/commentaireModel.js'
import * as MiseAJour from '../models/miseAJourModel.js'
import * as Utilisateur from '../models/utilisateurModel.js'
import { CATEGORIES, COMMUNES, STATUTS } from '../shared/signalement.js'
import {
  envoyerNotificationSignalement,
  envoyerConfirmationSignalement,
  envoyerChangementStatut
} from '../services/emailService.js'
import { supprimerPhoto } from '../config/storage.js'
import { contientContenuExplicite } from '../services/moderationService.js'
import { creerNotification } from '../services/notificationService.js'
import {
  estUnRobot,
  sessionDeLaRequete,
  estAutoriseASupprimer,
  estAutoriseAModifier
} from '../services/signalements/acces.js'
import { mapRow, mapMiseAJour, mapCommentaire } from '../services/signalements/representation.js'
import { MAX_PHOTOS, traiterPhoto, traiterPhotos, contientUnePhotoInterdite } from '../services/signalements/photos.js'
import { emailSuiviSignalement } from '../services/signalements/suivi.js'
import { lirePosition } from '../services/signalements/localisation.js'
import { celluleCsv } from '../services/signalements/csv.js'
import { texte, emailValide } from '../middlewares/validation.js'
import { dansLePerimetre } from '../shared/perimetrePartenaire.js'
import { alerterPartenaires } from '../services/partenaires/alerte.js'
import { journaliser, acteurDeSession } from '../services/journalService.js'

// Signalements eux-mêmes. Les commentaires et les mises à jour, qui sont des
// sous-ressources, ont leurs propres contrôleurs ; les requêtes SQL sont dans
// src/models/, les contrôles d'accès, la conversion des données et le traitement des
// photos dans src/services/signalements/.

// Contrôles communs à la création et à la correction d'un signalement.
function erreurDeContenu({ categorie, commune, description }) {
  if (!CATEGORIES.includes(categorie)) return 'Catégorie invalide.'
  if (!COMMUNES.includes(commune)) return 'Commune invalide.'
  const longueur = texte(description).trim().length
  if (longueur < 10) return 'La description doit contenir au moins 10 caractères.'
  if (longueur > 2000) return 'La description ne doit pas dépasser 2000 caractères.'
  return null
}

// FormData n'envoie que des chaînes : « false » est une chaîne non vide et serait vrai.
const lireUrgent = (valeur) => valeur === 'true' || valeur === '1' || valeur === true

export const compter = async (req, res) => {
  res.json({ count: await Signalement.compterTout() })
}

export const statistiques = async (req, res) => {
  res.json(await Signalement.compterParStatut())
}

export const statistiquesPubliques = async (req, res) => {
  const parStatut = await Signalement.compterParStatut()
  const parCommune = await Signalement.compterParCommune()
  const parCategorie = await Signalement.compterParCategorie()
  const jours = await Signalement.delaiMoyenResolutionJours()

  res.json({
    parStatut,
    parCommune: parCommune.map((r) => ({ commune: r.commune, count: r.count })),
    parCategorie: parCategorie.map((r) => ({ categorie: r.categorie, count: r.count })),
    delaiMoyenResolutionJours: jours !== null ? Math.round(jours * 10) / 10 : null
  })
}

export const exporterCsv = async (req, res) => {
  const signalements = await Signalement.listerPourExport()

  const entetes = [
    'id',
    'categorie',
    'commune',
    'description',
    'statut',
    'urgent',
    'date_signalement',
    'date_resolution',
    'latitude',
    'longitude',
    'nb_soutiens',
    'auteur_nom',
    'auteur_email',
    'auteur_telephone'
  ]
  const lignes = [entetes.join(',')]
  for (const row of signalements) {
    lignes.push(
      [
        row.id,
        row.categorie,
        row.commune,
        row.description,
        row.statut,
        row.urgent ? 'oui' : 'non',
        row.date_signalement,
        row.date_resolution,
        row.latitude,
        row.longitude,
        row.nb_soutiens,
        row.auteur_nom,
        row.auteur_email,
        row.auteur_telephone
      ]
        .map(celluleCsv)
        .join(',')
    )
  }

  const BOM = String.fromCharCode(0xfeff)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="signalements.csv"')
  res.send(BOM + lignes.join('\n'))
}

// Signalements proches et non résolus, proposés avant l'envoi d'un nouveau signalement.
// But : transformer un doublon en soutien. Deux personnes qui signalent le même trou ne
// sont pas du spam, mais un problème qui touche plusieurs habitants — et un signalement
// très soutenu pèse davantage que dix signalements dispersés.
export const similaires = async (req, res) => {
  const { categorie = '', commune = '' } = req.query
  const latitude = Number(req.query.latitude)
  const longitude = Number(req.query.longitude)
  const aDesCoordonnees = Number.isFinite(latitude) && Number.isFinite(longitude)

  if (!CATEGORIES.includes(categorie)) return res.json({ signalements: [] })
  if (!aDesCoordonnees && !COMMUNES.includes(commune)) return res.json({ signalements: [] })

  const proches = await Signalement.trouverSimilaires(
    aDesCoordonnees ? { categorie, latitude, longitude } : { categorie, commune }
  )
  res.json({ signalements: proches.map((r) => mapRow(r)) })
}

export const mesSignalements = async (req, res) => {
  if (!req.utilisateur) return res.json({ signalements: [] })

  const signalements = await Signalement.listerParAuteur(req.utilisateur.id)
  res.json({ signalements: signalements.map((r) => mapRow(r, false, req.utilisateur.id)) })
}

export const lireSignalement = async (req, res) => {
  const id = Number(req.params.id)
  const session = sessionDeLaRequete(req)
  const estAdmin = session?.type === 'admin'

  const signalement = await Signalement.trouverAvecAuteur(id)
  if (!signalement) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  const misesAJour = await MiseAJour.listerMisesAJour(id)
  const commentaires = await Commentaire.listerParSignalement(id)

  // Soutenir exige un compte : seul un citoyen connecté peut avoir déjà soutenu.
  const dejaSoutenu = session?.type === 'utilisateur' ? await Soutien.aDejaSoutenu(id, session.utilisateurId) : false

  res.json({
    ...mapRow(signalement, estAdmin, session?.utilisateurId || null),
    misesAJour: misesAJour.map(mapMiseAJour),
    commentaires: commentaires.map((c) => mapCommentaire(c, session?.utilisateurId || null)),
    dejaSoutenu
  })
}

export const listerSignalements = async (req, res) => {
  const { commune = '', categorie = '', statut = '', recherche = '', tri = 'recent', urgent = '' } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const parPage = Math.min(50, Math.max(1, Number(req.query.parPage) || 12))

  const { total, rows } = await Signalement.rechercher({
    commune,
    categorie,
    statut,
    recherche: recherche.trim(),
    urgent: urgent === '1' || urgent === 'true',
    tri,
    page,
    parPage
  })

  const session = sessionDeLaRequete(req)
  const estAdmin = session?.type === 'admin'
  res.json({
    signalements: rows.map((r) => mapRow(r, estAdmin, session?.utilisateurId || null)),
    total,
    page,
    parPage
  })
}

export const soutenir = async (req, res) => {
  const id = Number(req.params.id)

  if (!(await Signalement.existe(id))) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Un soutien est rattaché à un compte citoyen. Un administrateur n'a pas de compte
  // citoyen : sans ce refus, ses soutiens n'étaient dédoublonnés par rien.
  if (!req.utilisateur) {
    return res.status(403).json({ erreur: 'Seul un compte citoyen peut soutenir un signalement.' })
  }

  try {
    await Soutien.ajouter(id, req.utilisateur.id)
  } catch (e) {
    // Seul le conflit d'unicité signifie « déjà soutenu » ; toute autre erreur est une
    // panne, qui ne doit pas être présentée à l'utilisateur comme un doublon.
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ erreur: 'Vous avez déjà soutenu ce signalement.' })
    throw e
  }

  res.json({ nbSoutiens: await Signalement.incrementerSoutiens(id) })
}

export const creerSignalement = async (req, res) => {
  if (estUnRobot(req)) {
    return res.status(201).json({ id: 0, statut: 'Signalé' })
  }

  if (req.utilisateur) {
    const compte = await Utilisateur.trouverEtatEmail(req.utilisateur.id)
    if (compte?.email && !compte.email_verifie) {
      return res.status(403).json({
        erreur: "Confirmez votre email avant d'envoyer un signalement (lien envoyé à l'inscription).",
        emailNonVerifie: true
      })
    }
  }

  const { categorie, commune, description, latitude, longitude, email, urgent } = req.body

  const erreur = erreurDeContenu({ categorie, commune, description })
  if (erreur) return res.status(400).json({ erreur })

  const position = lirePosition(latitude, longitude)
  if (position.erreur) return res.status(400).json({ erreur: position.erreur })

  if (req.files?.length && (await contientUnePhotoInterdite(req.files))) {
    return res.status(400).json({ erreur: 'Une des photos envoyées a été refusée (contenu inapproprié détecté).' })
  }

  const emailContact = emailValide(texte(email).trim()) ? texte(email).trim() : null
  const tokenSuppression = crypto.randomBytes(24).toString('hex')

  const cree = await Signalement.creer({
    categorie,
    commune,
    description: description.trim(),
    photos: req.files?.length ? await traiterPhotos(req.files) : [],
    dateSignalement: new Date().toISOString(),
    latitude: position.latitude,
    longitude: position.longitude,
    emailContact,
    tokenSuppression,
    utilisateurId: req.utilisateur?.id || null,
    urgent: lireUrgent(urgent)
  })

  const signalementCree = mapRow(cree, false, req.utilisateur?.id || null)
  envoyerNotificationSignalement(signalementCree)
  alerterPartenaires(signalementCree)
  if (emailContact) {
    envoyerConfirmationSignalement(signalementCree, emailContact, tokenSuppression)
  }
  // Le token n'est renvoyé qu'ici, une seule fois : c'est la seule façon pour le créateur
  // (sans compte) de prouver plus tard que le signalement lui appartient.
  res.status(201).json({ ...signalementCree, tokenSuppression })
}

// Un admin peut tout faire ; un partenaire ne peut que faire évoluer le statut, et
// seulement dans son périmètre (voir le contrôle juste après la lecture du signalement).
export const modifierStatut = async (req, res) => {
  const id = Number(req.params.id)
  const { statut } = req.body

  if (!STATUTS.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide.' })
  }

  const existant = await Signalement.trouverParId(id)
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  // Un partenaire n'agit que dans son périmètre : sa commune (ex. « Mairie de Mamoudzou »)
  // et/ou ses domaines (ex. SIDEVAM976 : les déchets, sur toute l'île).
  if (req.partenaire && !dansLePerimetre(req.partenaire, existant)) {
    return res.status(403).json({ erreur: 'Ce signalement ne relève pas de votre périmètre (commune ou domaine).' })
  }

  let photoResolution = existant.photo_resolution
  if (req.file) {
    if (await contientContenuExplicite(req.file.buffer)) {
      return res.status(400).json({ erreur: 'La photo envoyée a été refusée (contenu inapproprié détecté).' })
    }
    if (photoResolution) await supprimerPhoto(photoResolution)
    photoResolution = await traiterPhoto(req.file)
  }

  const dateResolution = statut === 'Résolu' ? existant.date_resolution || new Date().toISOString() : null

  const modifie = await Signalement.modifierStatut(id, { statut, photoResolution, dateResolution })

  const signalementMisAJour = mapRow(modifie)
  if (existant.statut !== statut) {
    journaliser(req, 'signalement.statut', {
      cible: { type: 'signalement', id },
      details: { avant: existant.statut, apres: statut, commune: existant.commune, categorie: existant.categorie }
    })
    creerNotification(existant.utilisateur_id, {
      signalementId: id,
      texte: `Votre signalement (${existant.categorie} — ${existant.commune}) est maintenant « ${statut} »`
    })

    const destinataire = await emailSuiviSignalement(id)
    if (destinataire) envoyerChangementStatut(signalementMisAJour, destinataire)
  }

  res.json(signalementMisAJour)
}

export const modifierSignalement = async (req, res) => {
  const id = Number(req.params.id)
  const { categorie, commune, description, latitude, longitude, urgent } = req.body

  const existant = await Signalement.trouverParId(id)
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  if (!estAutoriseAModifier(req, existant)) {
    return res.status(403).json({
      erreur:
        existant.statut === 'Signalé'
          ? 'Vous ne pouvez modifier que vos propres signalements.'
          : "Ce signalement est déjà pris en charge : il n'est plus modifiable."
    })
  }

  const erreur = erreurDeContenu({ categorie, commune, description })
  if (erreur) return res.status(400).json({ erreur })

  // Position non renvoyée : on garde l'ancienne.
  const nouvellePosition = lirePosition(latitude, longitude)
  if (nouvellePosition.erreur) return res.status(400).json({ erreur: nouvellePosition.erreur })

  if (req.files?.length && (await contientUnePhotoInterdite(req.files))) {
    return res.status(400).json({ erreur: 'Une des photos envoyées a été refusée (contenu inapproprié détecté).' })
  }

  let photosConservees = existant.photos
  if (typeof req.body.photosConservees === 'string') {
    try {
      const demandees = JSON.parse(req.body.photosConservees)
      if (Array.isArray(demandees)) {
        photosConservees = existant.photos.filter((url) => demandees.includes(url))
      }
    } catch {
      // valeur invalide : on garde toutes les photos existantes.
    }
  }

  const nouvellesPhotos = req.files?.length
    ? await traiterPhotos(req.files.slice(0, MAX_PHOTOS - photosConservees.length))
    : []

  const modifie = await Signalement.modifierContenu(id, {
    categorie,
    commune,
    description: description.trim(),
    photos: [...photosConservees, ...nouvellesPhotos],
    latitude: nouvellePosition.latitude ?? existant.latitude,
    longitude: nouvellePosition.longitude ?? existant.longitude,
    urgent: lireUrgent(urgent)
  })

  // Les photos retirées ne sont effacées du stockage qu'une fois la correction
  // enregistrée : si l'enregistrement échouait, la base pointerait sinon vers des
  // fichiers déjà détruits.
  const photosSupprimees = existant.photos.filter((url) => !photosConservees.includes(url))
  await Promise.all(photosSupprimees.map(supprimerPhoto))

  const session = sessionDeLaRequete(req)
  res.json(mapRow(modifie, false, session?.utilisateurId || null))
}

export const supprimerSignalement = async (req, res) => {
  const id = Number(req.params.id)
  const existant = await Signalement.trouverParId(id)
  if (!existant) return res.status(404).json({ erreur: 'Signalement introuvable.' })

  if (!estAutoriseASupprimer(req, existant)) {
    return res.status(401).json({ erreur: 'Non autorisé.' })
  }

  await Signalement.supprimer(id)
  await Promise.all([...(existant.photos || []), existant.photo_resolution].filter(Boolean).map(supprimerPhoto))
  journaliser(req, 'signalement.suppression', {
    // Pas de middleware d'authentification sur cette route (le créateur sans compte
    // prouve son droit par un jeton) : l'acteur est lu dans la session.
    acteur: acteurDeSession(sessionDeLaRequete(req)),
    cible: { type: 'signalement', id },
    details: { commune: existant.commune, categorie: existant.categorie, statut: existant.statut }
  })

  res.status(204).end()
}
