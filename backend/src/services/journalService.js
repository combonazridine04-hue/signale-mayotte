import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Datastore from '@seald-io/nedb'

// Journal d'activité, stocké dans NeDB : une base de données NoSQL orientée documents,
// embarquée dans l'application (aucun serveur à installer). Ses données vivent dans un
// fichier, data/journal/journal-activite.db, un document JSON par ligne : on peut
// l'ouvrir dans VS Code pour voir exactement ce qui est enregistré.
//
// Pourquoi une base à part, et pourquoi NoSQL : chaque événement a une forme différente
// (une connexion n'a pas les mêmes détails qu'un changement de statut). En SQL, il
// faudrait une table par type d'événement ou une colonne fourre-tout ; ici, chaque
// événement est un document qui porte exactement ses propres champs. Le journal grossit
// vite, se lit presque toujours du plus récent au plus ancien, et ses entrées expirent
// d'elles-mêmes : c'est le cas d'usage typique d'une base documents.
//
// Les données métier (signalements, comptes…) restent dans MariaDB (voir db.js).
//
// Le journal est un complément, jamais une condition : si son fichier est illisible, le
// site fonctionne exactement comme avant. Aucune écriture dans le journal ne ralentit ni
// ne fait échouer la requête qui l'a déclenchée.

// Fichier de la base. Les tests utilisent le leur (voir tests/environnementTest.js),
// pour ne jamais vider le vrai journal.
const DOSSIER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'journal')
const FICHIER = path.join(DOSSIER, process.env.JOURNAL_FICHIER || 'journal-activite.db')

// RGPD : les traces d'activité ne sont pas gardées indéfiniment. La base les efface
// elle-même grâce à l'index TTL ci-dessous, sans tâche planifiée à écrire.
const CONSERVATION_JOURS = 365

export const journalActif = true

// Liste fermée : elle sert aussi de filtre autorisé pour l'API de consultation.
export const TYPES_EVENEMENTS = {
  'admin.connexion': 'Connexion admin',
  'admin.creation': 'Création de compte admin',
  'admin.suppression': 'Suppression de compte admin',
  'admin.mot_de_passe': 'Changement de mot de passe admin',
  'admin.2fa_activation': 'Activation de la double authentification',
  'admin.2fa_desactivation': 'Désactivation de la double authentification',
  'admin.2fa_reinitialisation': "Réinitialisation de la double authentification d'un admin",
  'partenaire.connexion': 'Connexion partenaire',
  'partenaire.creation': 'Création de compte partenaire',
  'partenaire.suppression': 'Suppression de compte partenaire',
  'signalement.statut': 'Changement de statut',
  'signalement.suppression': "Suppression d'un signalement",
  'moderation.ignore': 'Signalement d’abus ignoré',
  'captcha.echec': 'Vérification anti-robot échouée'
}

export const RESULTATS = ['succes', 'echec']

let basePromesse = null

// Ouvre la base au premier besoin (et la crée si elle n'existe pas encore).
function base() {
  if (!basePromesse) {
    basePromesse = (async () => {
      mkdirSync(DOSSIER, { recursive: true })
      const journal = new Datastore({ filename: FICHIER })
      await journal.loadDatabaseAsync()
      // Index TTL : chaque document est supprimé CONSERVATION_JOURS après sa date.
      // Il sert aussi au tri « du plus récent au plus ancien ».
      await journal.ensureIndexAsync({ fieldName: 'date', expireAfterSeconds: CONSERVATION_JOURS * 24 * 60 * 60 })
      // Filtre par type d'événement.
      await journal.ensureIndexAsync({ fieldName: 'type' })
      // NeDB ajoute chaque écriture à la fin du fichier, et le réécrit proprement (sans
      // les documents supprimés ou expirés) à chaque ouverture, soit à chaque démarrage.
      return journal
    })().catch((e) => {
      // Échec d'ouverture : on réessaiera au prochain événement plutôt que de rester bloqué.
      basePromesse = null
      throw e
    })
  }
  return basePromesse
}

// Qui a fait l'action ? Les middlewares d'authentification ont déjà rempli req.admin,
// req.partenaire ou req.utilisateur ; une route sans ces middlewares passe l'acteur
// elle-même. Seuls l'identifiant et le type sont gardés : pas d'IP ni d'email, inutiles
// pour ce journal.
function acteurDe(req) {
  if (req.admin) return { type: 'admin', id: req.admin.id, nom: req.admin.identifiant }
  if (req.partenaire) return { type: 'partenaire', id: req.partenaire.id, nom: req.partenaire.nom }
  if (req.utilisateur) return { type: 'citoyen', id: req.utilisateur.id }
  return { type: 'anonyme' }
}

// Même chose à partir d'une session déjà lue (routes sans middleware d'authentification).
export function acteurDeSession(session) {
  if (session?.type === 'admin') return { type: 'admin', id: session.adminId, nom: session.identifiant }
  if (session?.type === 'partenaire') return { type: 'partenaire', id: session.partenaireId, nom: session.nom }
  if (session?.type === 'utilisateur') return { type: 'citoyen', id: session.utilisateurId }
  return { type: 'anonyme' }
}

/**
 * Ajoute un événement au journal. Ne lève jamais d'erreur et ne s'attend pas : la
 * requête continue pendant que la base enregistre.
 *
 * @param {import('express').Request} req
 * @param {keyof typeof TYPES_EVENEMENTS} type
 * @param {{ resultat?: 'succes'|'echec', acteur?: object, cible?: object, details?: object }} [options]
 */
export function journaliser(req, type, { resultat = 'succes', acteur, cible, details } = {}) {
  if (!journalActif) return

  const document = {
    date: new Date(),
    type,
    resultat,
    acteur: acteur || acteurDe(req)
  }
  // Un document ne porte que les champs qui le concernent : pas de « cible: null »
  // sur une connexion, pas de « details: {} » vide.
  if (cible) document.cible = cible
  if (details && Object.keys(details).length) document.details = details

  base()
    .then((journal) => journal.insertAsync(document))
    .catch((e) => console.error('[journal] événement non enregistré :', e.message))
}

function versApi(document) {
  return {
    id: String(document._id),
    date: document.date.toISOString(),
    type: document.type,
    libelle: TYPES_EVENEMENTS[document.type] || document.type,
    resultat: document.resultat,
    acteur: document.acteur,
    cible: document.cible || null,
    details: document.details || null
  }
}

/**
 * Lecture paginée du journal, du plus récent au plus ancien.
 * Les filtres arrivent déjà validés par la route (liste fermée) : jamais d'objet venu
 * de la requête dans le filtre, ce qui écarte l'injection d'opérateurs ($ne, $gt, $where…).
 */
export async function lireJournal({ type, resultat, page = 1, parPage = 25 }) {
  const journal = await base()

  const filtre = {}
  if (type) filtre.type = type
  if (resultat) filtre.resultat = resultat

  const [documents, total] = await Promise.all([
    journal
      .findAsync(filtre)
      .sort({ date: -1 })
      .skip((page - 1) * parPage)
      .limit(parPage),
    journal.countAsync(filtre)
  ])

  return { evenements: documents.map(versApi), total, page, parPage }
}

/**
 * Statistiques des N derniers jours : nombre d'événements par type, réussis ou échoués.
 * La base sélectionne les documents de la période (opérateur $gte) ; le regroupement se
 * fait ensuite ici.
 */
export async function statistiquesJournal(jours = 30) {
  const journal = await base()
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000)

  const documents = await journal.findAsync({ date: { $gte: depuis } }, { type: 1, resultat: 1 })

  const parType = {}
  let total = 0
  let echecs = 0
  for (const { type, resultat } of documents) {
    const ligne = (parType[type] ||= {
      type,
      libelle: TYPES_EVENEMENTS[type] || type,
      succes: 0,
      echec: 0
    })
    ligne[resultat === 'echec' ? 'echec' : 'succes'] += 1
    total += 1
    if (resultat === 'echec') echecs += 1
  }

  return {
    jours,
    total,
    echecs,
    parType: Object.values(parType).sort((a, b) => b.succes + b.echec - (a.succes + a.echec))
  }
}

// Pour les tests et l'arrêt propre du serveur : écrit les dernières données et ferme.
export async function fermerJournal() {
  const promesse = basePromesse
  basePromesse = null
  if (!promesse) return
  const journal = await promesse.catch(() => null)
  if (!journal) return
  await journal.compactDatafileAsync()
}

// Réservé aux tests : vide la base du journal de test.
export async function viderJournal() {
  const journal = await base()
  await journal.removeAsync({}, { multi: true })
}
