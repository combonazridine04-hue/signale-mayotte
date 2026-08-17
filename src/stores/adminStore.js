import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api.js'

async function traiterReponse(reponse) {
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}))
    throw new Error(corps.erreur || `Erreur serveur (${reponse.status})`)
  }
  if (reponse.status === 204) return null
  return reponse.json()
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    comptes: [],
    chargement: false,
    erreur: ''
  }),

  actions: {
    async charger() {
      this.chargement = true
      this.erreur = ''
      try {
        const reponse = await apiFetch('/api/admins')
        this.comptes = await traiterReponse(reponse)
      } catch (e) {
        this.erreur = e.message
        this.comptes = []
      } finally {
        this.chargement = false
      }
    },

    async creer(identifiant, motDePasse) {
      const reponse = await apiFetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant, motDePasse })
      })
      const compte = await traiterReponse(reponse)
      this.comptes.push(compte)
      return compte
    },

    async supprimer(id) {
      const reponse = await apiFetch(`/api/admins/${id}`, { method: 'DELETE' })
      await traiterReponse(reponse)
      this.comptes = this.comptes.filter((c) => c.id !== id)
    },

    async changerMotDePasse(motDePasseActuel, nouveauMotDePasse) {
      const reponse = await apiFetch('/api/admins/me/mot-de-passe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse })
      })
      await traiterReponse(reponse)
    }
  }
})
