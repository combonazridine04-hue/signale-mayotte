import { apiFetch } from './api.js'
import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import { usePartenaireStore } from '../stores/partenaireStore.js'

// Le jeton de session vit dans un cookie HttpOnly que la page ne peut pas lire. On garde
// seulement un indice d'affichage (type de compte, nom) pour dessiner l'interface sans
// attendre le serveur ; c'est le serveur, via /api/auth/session, qui fait foi.
const CLE = 'signale-mayotte-session'

// Anciennes clés : elles contenaient le jeton lui-même. On les efface chez les visiteurs
// qui les ont encore, pour qu'aucun jeton ne traîne dans le stockage du navigateur.
const ANCIENNES_CLES = [
  'signale-mayotte-auth',
  'signale-mayotte-auth-identifiant',
  'signale-mayotte-citoyen',
  'signale-mayotte-citoyen-nom',
  'signale-mayotte-partenaire',
  'signale-mayotte-partenaire-nom',
  'signale-mayotte-partenaire-commune'
]
try {
  for (const cle of ANCIENNES_CLES) sessionStorage.removeItem(cle)
} catch {
  // Stockage indisponible (navigation privée stricte) : rien à nettoyer.
}

export function lireIndice(type) {
  try {
    const indice = JSON.parse(sessionStorage.getItem(CLE))
    return indice?.type === type ? indice : null
  } catch {
    return null
  }
}

export function memoriserIndice(session) {
  try {
    if (session) sessionStorage.setItem(CLE, JSON.stringify(session))
    else sessionStorage.removeItem(CLE)
  } catch {
    // Sans stockage, l'interface se resynchronise simplement au prochain chargement.
  }
}

let version = 0

// Un seul compte connecté à la fois par navigateur, comme côté serveur.
export function appliquerSession(session) {
  version += 1
  const stores = { admin: useAuthStore(), utilisateur: useCitoyenStore(), partenaire: usePartenaireStore() }
  for (const [type, store] of Object.entries(stores)) {
    if (session?.type === type) store.remplir(session)
    else if (store.estConnecte) store.vider()
  }
  memoriserIndice(session?.type ? session : null)
}

export async function fermerSession() {
  appliquerSession(null)
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Serveur injoignable : la session expirera d'elle-même côté serveur.
  }
}

let synchronisation = null

// Une seule fois par chargement de page. Si une connexion ou une déconnexion a lieu
// pendant la requête, sa réponse est périmée : on l'ignore.
export function synchroniserSession() {
  synchronisation ??= (async () => {
    const depart = version
    try {
      const reponse = await apiFetch('/api/auth/session')
      if (!reponse.ok) return
      const session = await reponse.json()
      if (depart === version) appliquerSession(session.type ? session : null)
    } catch {
      // Serveur injoignable : on garde l'état affiché, ce serait punir une coupure réseau.
    }
  })()
  return synchronisation
}
