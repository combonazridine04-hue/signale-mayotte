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
      estConnecte: Boolean(token),
      pseudo: '',
      avatarUrl: '',
      email: '',
      telephone: '',
      emailVerifie: false,
      creeLe: '',
      stats: { signalements: 0, resolus: 0, soutiens: 0 }
    }
  },

  actions: {
    enregistrerSession(donnees) {
      this.token = donnees.token
      this.nom = donnees.nom || ''
      this.estConnecte = true
      sessionStorage.setItem(STORAGE_KEY, donnees.token)
      sessionStorage.setItem(STORAGE_KEY_NOM, this.nom)
      // Récupère pseudo et photo pour que la barre de navigation les affiche tout de suite.
      this.chargerProfil()
    },

    async inscrire({ nom, email, telephone, motDePasse, site_web }) {
      let reponse
      try {
        reponse = await fetch('/api/auth/inscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom, email, telephone, motDePasse, site_web })
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
      return { succes: true, emailAConfirmer: Boolean(donnees.emailAConfirmer) }
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
      this.pseudo = ''
      this.avatarUrl = ''
      this.creeLe = ''
      this.stats = { signalements: 0, resolus: 0, soutiens: 0 }
      this.email = ''
      this.telephone = ''
      this.emailVerifie = false
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY_NOM)

      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {})
      }
    },

    async demanderReinitialisationMotDePasse(email) {
      try {
        await fetch('/api/auth/mot-de-passe-oublie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        return { succes: true }
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }
    },

    async reinitialiserMotDePasse(token, motDePasse) {
      let reponse
      try {
        reponse = await fetch('/api/auth/reinitialiser-mot-de-passe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, motDePasse })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Réinitialisation impossible.' }
      }

      return { succes: true }
    },

    async renvoyerVerificationEmail() {
      try {
        const reponse = await fetch('/api/auth/renvoyer-verification', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` }
        })
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Envoi impossible.' }
        }
        return { succes: true }
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }
    },

    async confirmerEmail(code) {
      let reponse
      try {
        reponse = await fetch('/api/auth/verifier-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ code })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Code invalide.' }
      }

      return { succes: true }
    },

    async chargerProfil() {
      if (!this.token) return { succes: false, erreur: 'Non connecté.' }

      try {
        const reponse = await fetch('/api/auth/profil', {
          headers: { Authorization: `Bearer ${this.token}` }
        })
        if (!reponse.ok) {
          // Les sessions vivent en mémoire côté serveur : après un redéploiement elles
          // disparaissent. Sans ça le site continue d'afficher "connecté" avec un jeton mort.
          if (reponse.status === 401) this.deconnecter()
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Impossible de charger le profil.' }
        }
        const profil = await reponse.json()
        this.pseudo = profil.pseudo || ''
        this.avatarUrl = profil.avatarUrl || ''
        this.email = profil.email || ''
        this.telephone = profil.telephone || ''
        this.emailVerifie = Boolean(profil.emailVerifie)
        this.creeLe = profil.creeLe || ''
        this.stats = profil.stats || { signalements: 0, resolus: 0, soutiens: 0 }
        return { succes: true }
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }
    },

    async mettreAJourPseudo(pseudo) {
      let reponse
      try {
        reponse = await fetch('/api/auth/profil', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ pseudo })
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Mise à jour impossible.' }
      }

      const donnees = await reponse.json()
      this.pseudo = donnees.pseudo || ''
      return { succes: true }
    },

    async televerserAvatar(fichier) {
      let reponse
      try {
        const formData = new FormData()
        formData.set('avatar', fichier)
        reponse = await fetch('/api/auth/avatar', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${this.token}` },
          body: formData
        })
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Envoi impossible.' }
      }

      const donnees = await reponse.json()
      this.avatarUrl = donnees.avatarUrl || ''
      return { succes: true }
    },

    async supprimerAvatar() {
      try {
        const reponse = await fetch('/api/auth/avatar', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.token}` }
        })
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Suppression impossible.' }
        }
        this.avatarUrl = ''
        return { succes: true }
      } catch {
        return { succes: false, erreur: "Impossible de contacter le serveur." }
      }
    }
  }
})
