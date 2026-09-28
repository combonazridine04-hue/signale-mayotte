import { defineStore } from 'pinia'
import { appliquerSession, fermerSession, lireIndice } from '../utils/session.js'

export const useAuthStore = defineStore('auth', {
  state: () => {
    const indice = lireIndice('admin')
    return {
      identifiant: indice?.identifiant || '',
      estConnecte: Boolean(indice)
    }
  },

  actions: {
    async connecter(identifiant, motDePasse, code = '') {
      let reponse
      try {
        reponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiant, motDePasse, ...(code ? { code } : {}) })
        })
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        if (corps.codeRequis) return { succes: false, codeRequis: true, erreur: corps.erreur }
        if (reponse.status === 401) {
          return { succes: false, erreur: 'Identifiant ou mot de passe incorrect.' }
        }
        if (reponse.status === 429) return { succes: false, erreur: corps.erreur }
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      const donnees = await reponse.json()
      appliquerSession({ type: 'admin', identifiant: donnees.identifiant || '' })
      return { succes: true }
    },

    remplir({ identifiant }) {
      this.identifiant = identifiant || ''
      this.estConnecte = true
    },

    vider() {
      this.identifiant = ''
      this.estConnecte = false
    },

    deconnecter() {
      return fermerSession()
    }
  }
})
