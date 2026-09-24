import { reactive } from 'vue'
import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'

// L'hébergement gratuit éteint le serveur après un quart d'heure sans visite. Le premier
// visiteur le réveille, ce qui prend entre trente secondes et une minute : pendant ce
// temps la requête échoue ou le proxy répond 502/503. Sans reprise, le site affichait
// aussitôt une erreur alors qu'il suffisait d'attendre.
const ATTENTES_MS = [1000, 2000, 4000, 8000]
const DELAI_LECTURE_MS = 15000
const DELAI_ECRITURE_MS = 60000
const CODES_SERVEUR_ENDORMI = [502, 503, 504]

// Permet à l'interface de dire « le serveur redémarre » au lieu de laisser croire à une panne.
// Un compteur et non un simple drapeau : plusieurs requêtes partent en même temps au
// chargement d'une page, et celles qui aboutissent tout de suite effaçaient l'indication
// pendant qu'une autre était encore en train de réessayer.
export const etatReseau = reactive({ reveilEnCours: false })
let reprisesEnCours = 0

function marquerReprise() {
  reprisesEnCours += 1
  etatReseau.reveilEnCours = true
}

function finReprise(aRepris) {
  if (!aRepris) return
  reprisesEnCours = Math.max(0, reprisesEnCours - 1)
  etatReseau.reveilEnCours = reprisesEnCours > 0
}

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
    return await fetch(url, { ...options, signal: controleur.signal })
  } finally {
    clearTimeout(minuteur)
  }
}

export async function apiFetch(url, options = {}) {
  const authStore = useAuthStore()
  const citoyenStore = useCitoyenStore()

  // Un admin connecté agit toujours avec ses droits admin ; sinon, on utilise
  // la session citoyenne si elle existe.
  const utiliseAdmin = Boolean(authStore.token)
  const token = utiliseAdmin ? authStore.token : citoyenStore.token

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // On ne rejoue QUE les lectures. Rejouer un envoi de signalement ou de commentaire
  // après une coupure créerait un doublon : impossible de savoir si le serveur l'avait
  // déjà enregistré avant de perdre la connexion. Pour ces cas, c'est l'utilisateur qui
  // décide de réessayer.
  const lecture = estLecture(options.method)
  const essaisMax = lecture ? ATTENTES_MS.length + 1 : 1
  const delai = lecture ? DELAI_LECTURE_MS : DELAI_ECRITURE_MS

  let derniereErreur = null
  let aRepris = false

  try {
    for (let essai = 0; essai < essaisMax; essai++) {
      const dernier = essai === essaisMax - 1
      try {
        const reponse = await envoyer(url, { ...options, headers }, delai)

        if (CODES_SERVEUR_ENDORMI.includes(reponse.status) && !dernier) {
          if (!aRepris) { aRepris = true; marquerReprise() }
          await pause(ATTENTES_MS[essai])
          continue
        }

        if (reponse.status === 401 && token) {
          if (utiliseAdmin) {
            authStore.deconnecter()
          } else {
            citoyenStore.deconnecter()
          }
        }

        return reponse
      } catch (e) {
        derniereErreur = e
        if (dernier) break
        if (!aRepris) { aRepris = true; marquerReprise() }
        await pause(ATTENTES_MS[essai])
      }
    }

    throw derniereErreur || new Error('Requête impossible.')
  } finally {
    finReprise(aRepris)
  }
}
