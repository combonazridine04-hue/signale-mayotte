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

// Gestion des comptes partenaires DEPUIS l'espace admin (lister, créer, supprimer).
// À ne pas confondre avec partenaireStore.js, qui porte la session du partenaire
// lui-même une fois connecté.
export const usePartenairesAdminStore = defineStore('partenairesAdmin', {
  state: () => ({
    comptes: [],
    modeAlertes: null,
    chargement: false,
    erreur: ''
  }),

  actions: {
    async charger() {
      this.chargement = true
      this.erreur = ''
      try {
        const reponse = await apiFetch('/api/partenaires')
        this.comptes = await traiterReponse(reponse)
      } catch (e) {
        this.erreur = e.message
        this.comptes = []
      } finally {
        this.chargement = false
      }
    },

    async chargerModeAlertes() {
      try {
        const reponse = await apiFetch('/api/partenaires-alertes')
        this.modeAlertes = await traiterReponse(reponse)
      } catch {
        this.modeAlertes = null
      }
    },

    async creer({ nom, identifiant, motDePasse, commune, categories, email }) {
      const reponse = await apiFetch('/api/partenaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, identifiant, motDePasse, commune, categories, email })
      })
      const compte = await traiterReponse(reponse)
      this.comptes.push(compte)
      return compte
    },

    async supprimer(id) {
      const reponse = await apiFetch(`/api/partenaires/${id}`, { method: 'DELETE' })
      await traiterReponse(reponse)
      this.comptes = this.comptes.filter((c) => c.id !== id)
    }
  }
})
