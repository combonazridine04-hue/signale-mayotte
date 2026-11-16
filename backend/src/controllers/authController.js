import {
  verifierIdentifiants,
  consommerCodeAdmin,
  creerSession,
  inscrireUtilisateur,
  verifierIdentifiantsUtilisateur,
  creerSessionUtilisateur,
  confirmerEmailUtilisateur,
  regenererTokenVerification,
  genererTokenReinitialisation,
  reinitialiserMotDePasse,
  recupererProfil,
  recupererStatsUtilisateur,
  mettreAJourPseudo,
  mettreAJourAvatar
} from '../services/authService.js'
import { envoyerVerificationEmail, envoyerReinitialisationMotDePasse } from '../services/emailService.js'
import { motDePasseInterdit } from '../shared/motDePasse.js'
import { fermerSession, ouvrirSession, sessionDeLaRequete } from '../services/sessionService.js'
import { traiterPhoto } from '../middlewares/photoUpload.js'
import { supprimerPhoto } from '../config/storage.js'
import { contientContenuExplicite } from '../services/moderationService.js'
import { noterConnexion } from '../models/utilisateurModel.js'
import { effacerCompte, exporterDonnees, motDePasseCorrect, mettreAJourNom } from '../services/compteService.js'
import { journaliser } from '../services/journalService.js'

export const connexionAdmin = async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const admin = await verifierIdentifiants(identifiant, motDePasse)
  if (!admin) {
    // L'identifiant tapé n'est pas gardé : ce pourrait être un mot de passe saisi dans
    // le mauvais champ.
    journaliser(req, 'admin.connexion', { resultat: 'echec', details: { motif: 'identifiants' } })
    return res.status(401).json({ erreur: 'Identifiant ou mot de passe incorrect.' })
  }
  const acteur = { type: 'admin', id: admin.id, nom: admin.identifiant }

  // Double authentification activée : le mot de passe seul ne suffit pas. Le nombre
  // d'essais reste limité par le limiteur de /api/auth/login (10 par quart d'heure).
  if (admin.totpSecret) {
    const { code } = req.body || {}
    if (!code) {
      return res.status(401).json({ erreur: 'Saisissez le code à 6 chiffres de votre application.', codeRequis: true })
    }
    if (!(await consommerCodeAdmin(admin.id, admin.totpSecret, admin.totpDernierPas, code))) {
      journaliser(req, 'admin.connexion', { resultat: 'echec', acteur, details: { motif: 'code 2FA' } })
      return res.status(401).json({ erreur: 'Code incorrect ou expiré.', codeRequis: true })
    }
  }

  ouvrirSession(req, res, creerSession(admin))
  journaliser(req, 'admin.connexion', { acteur, details: { deuxFacteurs: Boolean(admin.totpSecret) } })
  res.json({ identifiant: admin.identifiant })
}

export const inscription = async (req, res) => {
  const { nom, email, telephone, motDePasse, site_web: honeypot } = req.body || {}

  if (honeypot) {
    return res.status(400).json({ erreur: 'Inscription impossible.' })
  }

  const resultat = await inscrireUtilisateur({ nom, email, telephone, motDePasse })
  if (resultat.erreur) {
    return res.status(400).json({ erreur: resultat.erreur })
  }

  noterConnexion(resultat.utilisateur.id)
  if (resultat.codeVerification) {
    envoyerVerificationEmail(resultat.utilisateur.nom, resultat.utilisateur.email, resultat.codeVerification)
  }

  ouvrirSession(req, res, creerSessionUtilisateur(resultat.utilisateur))
  res.status(201).json({
    nom: resultat.utilisateur.nom,
    emailAConfirmer: Boolean(resultat.codeVerification)
  })
}

export const verifierEmail = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const ok = await confirmerEmailUtilisateur(req.utilisateur.id, req.body?.code)
  if (!ok) return res.status(400).json({ erreur: 'Code invalide ou expiré.' })
  res.json({ succes: true })
}

export const renvoyerVerification = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const resultat = await regenererTokenVerification(req.utilisateur.id)
  if (!resultat) {
    return res
      .status(400)
      .json({ erreur: 'Aucun email à vérifier sur ce compte (déjà vérifié, ou inscrit par téléphone).' })
  }
  envoyerVerificationEmail(resultat.nom, resultat.email, resultat.code)
  res.status(204).end()
}

export const connexion = async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  const utilisateur = await verifierIdentifiantsUtilisateur(identifiant, motDePasse)
  if (!utilisateur) {
    return res.status(401).json({ erreur: 'Identifiants incorrects.' })
  }

  noterConnexion(utilisateur.id)
  ouvrirSession(req, res, creerSessionUtilisateur(utilisateur))
  res.json({ nom: utilisateur.nom })
}

// Le cookie de session est illisible pour la page : c'est ici qu'elle apprend qui est
// connecté (nouvel onglet, rechargement, session effacée par un redéploiement).
export const session = (req, res) => {
  const session = sessionDeLaRequete(req)
  if (!session) return res.json({ type: null })
  if (session.type === 'admin') return res.json({ type: 'admin', identifiant: session.identifiant })
  if (session.type === 'partenaire') {
    return res.json({
      type: 'partenaire',
      nom: session.nom,
      commune: session.commune || '',
      categories: session.categories || [],
      depuis: session.depuis || ''
    })
  }
  res.json({ type: 'utilisateur', nom: session.nom })
}

export const lireProfil = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const profil = await recupererProfil(req.utilisateur.id)
  if (!profil) return res.status(404).json({ erreur: 'Compte introuvable.' })
  res.json({ ...profil, stats: await recupererStatsUtilisateur(req.utilisateur.id) })
}

export const modifierProfil = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  // Pseudo et nom se modifient séparément : seul le champ envoyé est touché.
  const corps = req.body || {}
  if ('nom' in corps) {
    const resultat = await mettreAJourNom(req.utilisateur.id, corps.nom)
    if (resultat.erreur) return res.status(400).json({ erreur: resultat.erreur })
    return res.json(resultat)
  }
  const resultat = await mettreAJourPseudo(req.utilisateur.id, corps.pseudo)
  if (resultat.erreur) return res.status(400).json({ erreur: resultat.erreur })
  res.json(resultat)
}

export const changerAvatar = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  if (!req.file) {
    return res.status(400).json({ erreur: 'Aucune image envoyée (formats acceptés : jpg, png, webp, gif).' })
  }
  if (await contientContenuExplicite(req.file.buffer)) {
    return res.status(400).json({ erreur: 'Cette photo a été refusée (contenu inapproprié détecté).' })
  }

  const ancienProfil = await recupererProfil(req.utilisateur.id)

  let avatarUrl
  try {
    avatarUrl = await traiterPhoto(req.file, { largeurMax: 256 })
  } catch {
    // Fichier accepté par son type MIME mais illisible (corrompu, renommé...) :
    // sans ça l'utilisateur reçoit le "Requête invalide." générique du serveur.
    return res.status(400).json({ erreur: "Cette image n'a pas pu être lue. Essayez un autre fichier." })
  }

  await mettreAJourAvatar(req.utilisateur.id, avatarUrl)
  if (ancienProfil?.avatarUrl) await supprimerPhoto(ancienProfil.avatarUrl)

  res.json({ avatarUrl })
}

export const supprimerAvatar = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const profil = await recupererProfil(req.utilisateur.id)
  if (profil?.avatarUrl) await supprimerPhoto(profil.avatarUrl)
  await mettreAJourAvatar(req.utilisateur.id, null)
  res.status(204).end()
}

export const motDePasseOublie = async (req, res) => {
  const { email } = req.body || {}

  const resultat = await genererTokenReinitialisation(email)
  if (resultat) {
    envoyerReinitialisationMotDePasse(resultat.nom, resultat.email, resultat.token)
  }

  // Réponse identique que le compte existe ou non, pour ne pas révéler les emails inscrits.
  res.status(204).end()
}

export const nouveauMotDePasse = async (req, res) => {
  const { token, motDePasse } = req.body || {}

  const refus = motDePasseInterdit(motDePasse)
  if (refus) {
    return res.status(400).json({ erreur: refus })
  }

  const ok = await reinitialiserMotDePasse(token, motDePasse)
  if (!ok) {
    return res.status(400).json({ erreur: 'Lien de réinitialisation invalide ou expiré.' })
  }

  res.status(204).end()
}

// Droit d'accès et à la portabilité (RGPD art. 15 et 20) : toutes les données du
// compte, dans un fichier JSON téléchargeable.
export const mesDonnees = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const donnees = await exporterDonnees(req.utilisateur.id)
  if (!donnees) return res.status(404).json({ erreur: 'Compte introuvable.' })
  res.attachment('mes-donnees-signale-mayotte.json')
  res.json(donnees)
}

// Droit à l'effacement (RGPD art. 17).
export const supprimerCompte = async (req, res) => {
  if (!req.utilisateur) {
    return res.status(400).json({ erreur: 'Non applicable pour un compte admin.' })
  }
  const { motDePasse, avecContenus } = req.body || {}
  if (!(await motDePasseCorrect(req.utilisateur.id, motDePasse))) {
    return res.status(401).json({ erreur: 'Mot de passe incorrect.' })
  }
  const efface = await effacerCompte(req.utilisateur.id, { avecContenus: avecContenus === true })
  if (!efface) return res.status(404).json({ erreur: 'Compte introuvable.' })
  fermerSession(req, res)
  res.status(204).end()
}

export const deconnexion = (req, res) => {
  fermerSession(req, res)
  res.status(204).end()
}
