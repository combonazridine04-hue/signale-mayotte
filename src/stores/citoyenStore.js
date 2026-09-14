import { defineStore } from 'pinia'

const STORAGE_KEY = 'signale-mayotte-citoyen'
const STORAGE_KEY_NOM = 'signale-mayotte-citoyen-nom'

function chargerJeton() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function chargerNom() {
  try {
    return sessionStorage.getItem(STORAGE_KEY_NOM) || ''
  } catch {
    return ''
  }
}

export const useCitoyenStore = defineStore('citoyen', {
  state: () => {
    const token = chargerJeton()
    return {
      token,
      nom: chargerNom(),
      estConnecte: Boolean(token)
    }
  },

  actions: {
    enregistrerSession(donnees) {
      this.token = donnees.token
      this.nom = donnees.nom || ''
      this.estConnecte = true
      sessionStorage.setItem(STORAGE_KEY, donnees.token)
      sessionStorage.setItem(STORAGE_KEY_NOM, this.nom)
    },

    async inscrire({ nom, email, telephone, motDePasse }) {
      let reponse
      try {
        reponse = await fetch('/api/auth/inscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom, email, telephone, motDePasse })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur. Vérifie qu'il est bien lancé." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Inscription impossible.' }
      }

      const donnees = await reponse.json()
      this.enregistrerSession(donnees)
      return { succes: true }
    },

    async connecter(identifiant, motDePasse) {
      let reponse
      try {
        reponse = await fetch('/api/auth/connexion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiant, motDePasse })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur. Vérifie qu'il est bien lancé." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Identifiants incorrects.' }
      }

      const donnees = await reponse.json()
      this.enregistrerSession(donnees)
      return { succes: true }
    },

    async deconnecter() {
      const token = this.token
      this.token = ''
      this.nom = ''
      this.estConnecte = false
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY_NOM)

      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {})
      }
    }
  }
})
