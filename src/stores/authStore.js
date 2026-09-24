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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        if (reponse.status === 401) {
          return { succes: false, erreur: 'Identifiant ou mot de passe incorrect.' }
        }
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      const donnees = await reponse.json()
      this.token = donnees.token
      this.identifiant = donnees.identifiant || ''
      this.estConnecte = true
      sessionStorage.setItem(STORAGE_KEY, donnees.token)
      sessionStorage.setItem(STORAGE_KEY_IDENTIFIANT, this.identifiant)
      return { succes: true }
    },

    // Les sessions vivent en mémoire côté serveur : le moindre redéploiement les efface,
    // alors que le jeton reste dans le navigateur. Sans cette vérification, l'admin se
    // croyait connecté, /admin/login le renvoyait vers /admin, et il ne pouvait plus se
    // reconnecter du tout sans vider son stockage à la main.
    async verifierSession() {
      if (!this.token) return
      try {
        const reponse = await fetch('/api/admins', {
          headers: { Authorization: `Bearer ${this.token}` }
        })
        if (reponse.status === 401 || reponse.status === 403) this.deconnecter()
      } catch {
        // Serveur injoignable : on ne déconnecte pas, ce serait punir une coupure réseau.
      }
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
