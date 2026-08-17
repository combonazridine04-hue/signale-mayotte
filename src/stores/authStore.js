import { defineStore } from 'pinia'

const STORAGE_KEY = 'signale-mayotte-auth'
const STORAGE_KEY_IDENTIFIANT = 'signale-mayotte-auth-identifiant'

function chargerJeton() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function chargerIdentifiant() {
  try {
    return sessionStorage.getItem(STORAGE_KEY_IDENTIFIANT) || ''
  } catch {
    return ''
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const token = chargerJeton()
    return {
      token,
      identifiant: chargerIdentifiant(),
      estConnecte: Boolean(token)
    }
  },

  actions: {
    async connecter(identifiant, motDePasse) {
      let reponse
      try {
        reponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiant, motDePasse })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur. Vérifie qu'il est bien lancé." }
      }

      if (!reponse.ok) {
        if (reponse.status === 401) {
          return { succes: false, erreur: 'Identifiant ou mot de passe incorrect.' }
        }
        return { succes: false, erreur: "Impossible de contacter le serveur. Vérifie qu'il est bien lancé." }
      }

      const donnees = await reponse.json()
      this.token = donnees.token
      this.identifiant = donnees.identifiant || ''
      this.estConnecte = true
      sessionStorage.setItem(STORAGE_KEY, donnees.token)
      sessionStorage.setItem(STORAGE_KEY_IDENTIFIANT, this.identifiant)
      return { succes: true }
    },

    async deconnecter() {
      const token = this.token
      this.token = ''
      this.identifiant = ''
      this.estConnecte = false
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY_IDENTIFIANT)

      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {})
      }
    }
  }
})
