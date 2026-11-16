import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import * as Admin from '../models/adminModel.js'
import { consommerCodeAdmin, revoquerSessionsDe } from '../services/authService.js'
import { genererSecret, lienOtpauth, verifierCode } from '../services/totpService.js'
import { jetonDeLaRequete } from '../services/sessionService.js'
import { motDePasseInterdit } from '../shared/motDePasse.js'
import { journaliser } from '../services/journalService.js'

function mapRow(row) {
  return { id: row.id, identifiant: row.identifiant, creeLe: row.cree_le, deuxFacteurs: Boolean(row.deux_facteurs) }
}

export const listerAdmins = async (req, res) => {
  const admins = await Admin.lister()
  res.json(admins.map(mapRow))
}

// --- Double authentification (code à 6 chiffres d'une application) ---

export const etatDeuxFacteurs = async (req, res) => {
  res.json({ actif: await Admin.aDeuxFacteurs(req.admin.id) })
}

// Étape 1 : un secret est proposé (QR code à scanner). Il ne protège rien tant qu'un
// premier code n'a pas prouvé que l'application l'a bien enregistré.
export const preparerDeuxFacteurs = async (req, res) => {
  const secret = genererSecret()
  await Admin.enregistrerSecretEnAttente(req.admin.id, secret)
  const qr = await QRCode.toDataURL(lienOtpauth(secret, req.admin.identifiant), { margin: 1, width: 220 })
  res.json({ secret, qr })
}

// Étape 2 : le premier code valide active la protection.
export const activerDeuxFacteurs = async (req, res) => {
  const secret = await Admin.lireSecretEnAttente(req.admin.id)
  if (!secret) return res.status(400).json({ erreur: 'Recommencez la configuration : aucun QR code en attente.' })

  const pas = verifierCode(secret, req.body?.code)
  if (pas === null)
    return res.status(400).json({ erreur: 'Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.' })

  await Admin.activerDeuxFacteurs(req.admin.id, secret, pas)
  // Toute autre session ouverte avec le seul mot de passe est fermée.
  revoquerSessionsDe(req.admin.id, jetonDeLaRequete(req) || null)
  journaliser(req, 'admin.2fa_activation')
  res.status(204).end()
}

// Désactiver sa propre protection exige le mot de passe ET un code : une session volée
// ne suffit pas à la retirer.
export const desactiverDeuxFacteurs = async (req, res) => {
  const { motDePasse, code } = req.body || {}
  const admin = await Admin.trouverParId(req.admin.id)
  if (!admin?.totp_secret) return res.status(400).json({ erreur: 'La double authentification n’est pas activée.' })
  if (!(await bcrypt.compare(String(motDePasse || ''), admin.mot_de_passe_hash))) {
    return res.status(400).json({ erreur: 'Mot de passe incorrect.' })
  }
  const dernierPas = admin.totp_dernier_pas === null ? null : Number(admin.totp_dernier_pas)
  if (!(await consommerCodeAdmin(admin.id, admin.totp_secret, dernierPas, code))) {
    return res.status(400).json({ erreur: 'Code incorrect ou expiré.' })
  }
  await Admin.desactiverDeuxFacteurs(admin.id)
  journaliser(req, 'admin.2fa_desactivation')
  res.status(204).end()
}

// Téléphone perdu : un autre admin réinitialise la protection de son collègue, qui
// devra la reconfigurer. Ses sessions en cours sont fermées.
export const retirerDeuxFacteursAdmin = async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.admin.id) {
    return res.status(400).json({ erreur: 'Pour votre propre compte, utilisez « Désactiver ».' })
  }
  if (!(await Admin.reinitialiserDeuxFacteurs(id))) return res.status(404).json({ erreur: 'Compte introuvable.' })
  revoquerSessionsDe(id)
  journaliser(req, 'admin.2fa_reinitialisation', { cible: { type: 'admin', id } })
  res.status(204).end()
}

export const creerAdmin = async (req, res) => {
  const { identifiant, motDePasse } = req.body || {}

  if (typeof identifiant !== 'string' || identifiant.trim().length < 3) {
    return res.status(400).json({ erreur: "L'identifiant doit contenir au moins 3 caractères." })
  }
  // Même règle que pour les citoyens : un compte administrateur protégé par « 12345678 »
  // ouvrirait toute la modération à qui le devine.
  const refus = motDePasseInterdit(motDePasse)
  if (refus) return res.status(400).json({ erreur: refus })

  const identifiantTrim = identifiant.trim()
  if (await Admin.identifiantExiste(identifiantTrim)) {
    return res.status(409).json({ erreur: 'Cet identifiant existe déjà.' })
  }

  const admin = await Admin.creer(identifiantTrim, await bcrypt.hash(motDePasse, 12))

  journaliser(req, 'admin.creation', { cible: { type: 'admin', id: admin.id, nom: admin.identifiant } })
  res.status(201).json(mapRow(admin))
}

export const supprimerAdmin = async (req, res) => {
  const id = Number(req.params.id)

  if (id === req.admin.id) {
    return res.status(400).json({ erreur: 'Impossible de supprimer votre propre compte.' })
  }

  if ((await Admin.compter()) <= 1) {
    return res.status(400).json({ erreur: 'Impossible de supprimer le dernier compte admin.' })
  }

  const identifiant = await Admin.supprimer(id)
  if (identifiant === undefined) return res.status(404).json({ erreur: 'Compte introuvable.' })

  revoquerSessionsDe(id)
  journaliser(req, 'admin.suppression', { cible: { type: 'admin', id, nom: identifiant } })
  res.status(204).end()
}

export const changerMotDePasse = async (req, res) => {
  const { motDePasseActuel, nouveauMotDePasse } = req.body || {}

  const refus = motDePasseInterdit(nouveauMotDePasse)
  if (refus) return res.status(400).json({ erreur: refus })

  const admin = await Admin.trouverParId(req.admin.id)
  if (!admin) return res.status(404).json({ erreur: 'Compte introuvable.' })

  const valide = await bcrypt.compare(String(motDePasseActuel || ''), admin.mot_de_passe_hash)
  // 400 et non 401 : 401 signifie « session invalide », et le site déconnectait alors
  // l'admin pour une simple faute de frappe.
  if (!valide) {
    return res.status(400).json({ erreur: 'Mot de passe actuel incorrect.' })
  }

  await Admin.changerMotDePasse(req.admin.id, await bcrypt.hash(nouveauMotDePasse, 12))
  // Changer son mot de passe sert souvent à couper l'accès à quelqu'un qui le connaissait :
  // les autres sessions de ce compte sont fermées, seule la session en cours est gardée.
  revoquerSessionsDe(req.admin.id, jetonDeLaRequete(req) || null)
  journaliser(req, 'admin.mot_de_passe')

  res.status(204).end()
}
