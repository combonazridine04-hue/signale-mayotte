import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import { usePartenaireStore } from '../stores/partenaireStore.js'
import { fermerSession } from '../utils/session.js'
import { fetchApi } from './adresseApi.js'

function estConnecte() {
  return useAuthStore().estConnecte || useCitoyenStore().estConnecte || usePartenaireStore().estConnecte
}

// Le serveur de l'API peut être momentanément indisponible (redémarrage après une mise
// à jour, coupure réseau) : la requête échoue ou le proxy répond 502/503. Sans reprise, le
// site affichait aussitôt une erreur alors qu'il suffisait d'attendre quelques secondes.
const ATTENTES_MS = [1000, 2000, 4000, 8000]
const DELAI_LECTURE_MS = 15000
const DELAI_ECRITURE_MS = 60000
const CODES_SERVEUR_ENDORMI = [502, 503, 504]

// Les reprises se font en silence : aucun bandeau n'est affiché pendant le réveil du
// serveur, la page attend simplement sa réponse.
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

function estLecture(methode) {
  return !methode || methode.toUpperCase() === 'GET' || methode.toUpperCase() === 'HEAD'
}

async function envoyer(url, options, delaiMs) {
  // Sans limite de temps, une requête partie vers un serveur endormi peut rester
  // suspendue une minute : mieux vaut abandonner et retenter, c'est plus rapide.
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(), delaiMs)
  try {
    // fetchApi : adresse de l'API (back-end séparé) et cookie de session joint.
    return await fetchApi(url, { ...options, signal: controleur.signal })
  } finally {
    clearTimeout(minuteur)
  }
}

export async function apiFetch(url, options = {}) {
  // Le cookie de session est joint par le navigateur lui-même (credentials: 'include',
  // voir adresseApi.js) : aucun jeton n'est jamais manipulé par le JavaScript de la page.
  const headers = new Headers(options.headers || {})

  // On ne rejoue QUE les lectures. Rejouer un envoi de signalement ou de commentaire
  // après une coupure créerait un doublon : impossible de savoir si le serveur l'avait
  // déjà enregistré avant de perdre la connexion. Pour ces cas, c'est l'utilisateur qui
  // décide de réessayer.
  const lecture = estLecture(options.method)
  const essaisMax = lecture ? ATTENTES_MS.length + 1 : 1
  const delai = lecture ? DELAI_LECTURE_MS : DELAI_ECRITURE_MS

  let derniereErreur = null

  for (let essai = 0; essai < essaisMax; essai++) {
    const dernier = essai === essaisMax - 1
    try {
      const reponse = await envoyer(url, { ...options, headers }, delai)

      if (CODES_SERVEUR_ENDORMI.includes(reponse.status) && !dernier) {
        await pause(ATTENTES_MS[essai])
        continue
      }

      // Session expirée ou effacée par un redéploiement : l'interface ne doit pas
      // continuer à afficher « connecté ».
      if (reponse.status === 401 && estConnecte()) fermerSession()

      return reponse
    } catch (e) {
      derniereErreur = e
      if (dernier) break
      await pause(ATTENTES_MS[essai])
    }
  }

  throw derniereErreur || new Error('Requête impossible.')
}
