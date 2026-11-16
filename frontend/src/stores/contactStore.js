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

export const useContactStore = defineStore('contact', {
  state: () => ({
    messages: [],
    chargement: false,
    erreur: ''
  }),

  actions: {
    async charger() {
      this.chargement = true
      this.erreur = ''
      try {
        const reponse = await apiFetch('/api/contact')
        this.messages = await traiterReponse(reponse)
      } catch (e) {
        this.erreur = e.message
        this.messages = []
      } finally {
        this.chargement = false
      }
    },

    async marquerLu(id, lu) {
      const reponse = await apiFetch(`/api/contact/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lu })
      })
      const message = await traiterReponse(reponse)
      const index = this.messages.findIndex((m) => m.id === id)
      if (index !== -1) this.messages[index] = message
    },

    async supprimer(id) {
      const reponse = await apiFetch(`/api/contact/${id}`, { method: 'DELETE' })
      await traiterReponse(reponse)
      this.messages = this.messages.filter((m) => m.id !== id)
    }
  }
})
