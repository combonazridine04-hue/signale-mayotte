import { defineStore } from 'pinia'
import { appliquerSession, fermerSession, lireIndice } from '../utils/session.js'

// Session d'un compte partenaire (agent municipal) : mêmes principes que authStore.js,
// adaptés à ce troisième type de compte.
export const usePartenaireStore = defineStore('partenaire', {
  state: () => {
    const indice = lireIndice('partenaire')
    return {
      nom: indice?.nom || '',
      commune: indice?.commune || '',
      categories: indice?.categories || [],
      depuis: indice?.depuis || '',
      estConnecte: Boolean(indice)
    }
  },

  actions: {
    async connecter(identifiant, motDePasse) {
      let reponse
      try {
        reponse = await fetch('/api/partenaires/login', {
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
      appliquerSession({
        type: 'partenaire',
        nom: donnees.nom || '',
        commune: donnees.commune || '',
        categories: donnees.categories || [],
        depuis: donnees.depuis || ''
      })
      return { succes: true }
    },

    remplir({ nom, commune, categories, depuis }) {
      this.nom = nom || ''
      this.commune = commune || ''
      this.categories = categories || []
      this.depuis = depuis || ''
      this.estConnecte = true
    },

    vider() {
      this.nom = ''
      this.commune = ''
      this.categories = []
      this.depuis = ''
      this.estConnecte = false
    },

    deconnecter() {
      return fermerSession()
    }
  }
})
