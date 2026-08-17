import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api.js'
import { enregistrerTokenSuppression } from '../utils/tokensSuppression.js'

async function traiterReponse(reponse) {
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}))
    throw new Error(corps.erreur || `Erreur serveur (${reponse.status})`)
  }
  if (reponse.status === 204) return null
  return reponse.json()
}

export const useSignalementStore = defineStore('signalement', {
  state: () => ({
    signalements: [],
    signalementCourant: null,
    total: 0,
    totalFiltre: 0,
    page: 1,
    parPage: 12,
    stats: { total: 0, signale: 0, enCours: 0, resolu: 0 },
    chargement: false,
    erreur: ''
  }),

  actions: {
    async charger(filtres = {}, page = 1, parPage = this.parPage) {
      this.chargement = true
      this.erreur = ''
      try {
        const params = new URLSearchParams()
        for (const [cle, valeur] of Object.entries(filtres)) {
          if (valeur) params.set(cle, valeur)
        }
        params.set('page', page)
        params.set('parPage', parPage)
        const reponse = await apiFetch(`/api/signalements?${params.toString()}`)
        const donnees = await traiterReponse(reponse)
        this.signalements = donnees.signalements
        this.totalFiltre = donnees.total
        this.page = donnees.page
      } catch (e) {
        this.erreur = "Impossible de contacter le serveur. Vérifie qu'il est bien lancé."
        this.signalements = []
        this.totalFiltre = 0
      } finally {
        this.chargement = false
      }
    },

    async chargerStats() {
      try {
        const reponse = await apiFetch('/api/signalements/stats')
        this.stats = await traiterReponse(reponse)
      } catch {
        this.stats = { total: 0, signale: 0, enCours: 0, resolu: 0 }
      }
    },

    async chargerCompteur() {
      try {
        const reponse = await apiFetch('/api/signalements/count')
        const { count } = await traiterReponse(reponse)
        this.total = count
      } catch {
        this.total = 0
      }
    },

    async chargerParId(id) {
      this.chargement = true
      this.erreur = ''
      this.signalementCourant = null
      try {
        const reponse = await apiFetch(`/api/signalements/${id}`)
        this.signalementCourant = await traiterReponse(reponse)
      } catch (e) {
        this.erreur = e.message
      } finally {
        this.chargement = false
      }
    },

    async ajouter(formData) {
      const reponse = await apiFetch('/api/signalements', {
        method: 'POST',
        body: formData
      })
      const signalement = await traiterReponse(reponse)
      if (signalement.tokenSuppression) {
        enregistrerTokenSuppression(signalement.id, signalement.tokenSuppression)
      }
      return signalement
    },

    async changerStatut(id, statut, photoResolution = null) {
      let options
      if (photoResolution) {
        const donnees = new FormData()
        donnees.set('statut', statut)
        donnees.set('photoResolution', photoResolution)
        options = { method: 'PATCH', body: donnees }
      } else {
        options = {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut })
        }
      }

      const reponse = await apiFetch(`/api/signalements/${id}`, options)
      const signalement = await traiterReponse(reponse)
      if (this.signalementCourant?.id === signalement.id) {
        this.signalementCourant = signalement
      }
      return signalement
    },

    async soutenir(id) {
      const reponse = await apiFetch(`/api/signalements/${id}/soutenir`, { method: 'POST' })
      const donnees = await traiterReponse(reponse)
      if (this.signalementCourant?.id === id) {
        this.signalementCourant.nbSoutiens = donnees.nbSoutiens
        this.signalementCourant.dejaSoutenu = true
      }
      const dansListe = this.signalements.find((s) => s.id === id)
      if (dansListe) dansListe.nbSoutiens = donnees.nbSoutiens
      return donnees
    },

    async ajouterMiseAJour(id, texte) {
      const reponse = await apiFetch(`/api/signalements/${id}/mises-a-jour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte })
      })
      const miseAJour = await traiterReponse(reponse)
      if (this.signalementCourant?.id === id) {
        this.signalementCourant.misesAJour = [miseAJour, ...(this.signalementCourant.misesAJour || [])]
      }
      return miseAJour
    },

    async supprimerMiseAJour(id, miseAJourId) {
      const reponse = await apiFetch(`/api/signalements/${id}/mises-a-jour/${miseAJourId}`, { method: 'DELETE' })
      await traiterReponse(reponse)
      if (this.signalementCourant?.id === id) {
        this.signalementCourant.misesAJour = this.signalementCourant.misesAJour.filter((m) => m.id !== miseAJourId)
      }
    },

    async modifier(id, formData) {
      const reponse = await apiFetch(`/api/signalements/${id}`, {
        method: 'PUT',
        body: formData
      })
      const signalement = await traiterReponse(reponse)
      this.signalementCourant = signalement
      return signalement
    },

    async supprimer(id, tokenSuppression = null) {
      const url = tokenSuppression
        ? `/api/signalements/${id}?token=${encodeURIComponent(tokenSuppression)}`
        : `/api/signalements/${id}`
      const reponse = await apiFetch(url, { method: 'DELETE' })
      await traiterReponse(reponse)
      this.signalements = this.signalements.filter((s) => s.id !== id)
      this.totalFiltre = Math.max(0, this.totalFiltre - 1)
      if (this.signalementCourant?.id === id) {
        this.signalementCourant = null
      }
    }
  }
})
