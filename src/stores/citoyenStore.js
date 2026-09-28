import { defineStore } from 'pinia'
import { appliquerSession, fermerSession, lireIndice, memoriserIndice } from '../utils/session.js'

// Aucun jeton ici : la session voyage dans un cookie HttpOnly que le navigateur joint
// seul à chaque requête vers le site.
export const useCitoyenStore = defineStore('citoyen', {
  state: () => {
    const indice = lireIndice('utilisateur')
    return {
      nom: indice?.nom || '',
      estConnecte: Boolean(indice),
      pseudo: '',
      avatarUrl: '',
      email: '',
      telephone: '',
      emailVerifie: false,
      creeLe: '',
      stats: { signalements: 0, resolus: 0, soutiens: 0 },
      notifications: [],
      notificationsNonLues: 0
    }
  },

  actions: {
    enregistrerSession(donnees) {
      appliquerSession({ type: 'utilisateur', nom: donnees.nom || '' })
    },

    remplir({ nom }) {
      this.nom = nom || ''
      this.estConnecte = true
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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Identifiants incorrects.' }
      }

      const donnees = await reponse.json()
      this.enregistrerSession(donnees)
      return { succes: true }
    },

    deconnecter() {
      return fermerSession()
    },

    vider() {
      this.nom = ''
      this.estConnecte = false
      this.pseudo = ''
      this.avatarUrl = ''
      this.notifications = []
      this.notificationsNonLues = 0
      this.creeLe = ''
      this.stats = { signalements: 0, resolus: 0, soutiens: 0 }
      this.email = ''
      this.telephone = ''
      this.emailVerifie = false
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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Réinitialisation impossible.' }
      }

      return { succes: true }
    },

    async renvoyerVerificationEmail() {
      try {
        const reponse = await fetch('/api/auth/renvoyer-verification', { method: 'POST' })
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Envoi impossible.' }
        }
        return { succes: true }
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    },

    async confirmerEmail(code) {
      let reponse
      try {
        reponse = await fetch('/api/auth/verifier-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Code invalide.' }
      }

      return { succes: true }
    },

    async chargerProfil() {
      if (!this.estConnecte) return { succes: false, erreur: 'Non connecté.' }

      try {
        const reponse = await fetch('/api/auth/profil')
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
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    },

    async mettreAJourPseudo(pseudo) {
      let reponse
      try {
        reponse = await fetch('/api/auth/profil', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pseudo })
        })
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Mise à jour impossible.' }
      }

      const donnees = await reponse.json()
      this.pseudo = donnees.pseudo || ''
      return { succes: true }
    },

    async chargerNotifications() {
      if (!this.estConnecte) return
      try {
        const reponse = await fetch('/api/notifications')
        if (!reponse.ok) return
        const donnees = await reponse.json()
        this.notifications = donnees.notifications || []
        this.notificationsNonLues = donnees.nonLues || 0
      } catch {
        // Une notification manquée ne doit rien casser dans la navigation.
      }
    },

    async marquerNotificationsLues() {
      if (!this.notificationsNonLues) return
      this.notificationsNonLues = 0
      this.notifications = this.notifications.map((n) => ({ ...n, lue: true }))
      try {
        await fetch('/api/notifications/lues', { method: 'POST' })
      } catch {
        // Sans conséquence : elles seront remarquées lues au prochain chargement.
      }
    },

    // Une photo de profil dont le fichier n'existe plus affichait une icône d'image
    // brisée dans la barre de navigation et sur le profil. On retombe sur l'initiale,
    // qui est déjà l'affichage prévu quand il n'y a pas de photo.
    avatarIllisible() {
      this.avatarUrl = ''
    },

    async televerserAvatar(fichier) {
      let reponse
      try {
        const formData = new FormData()
        formData.set('avatar', fichier)
        reponse = await fetch('/api/auth/avatar', {
          method: 'PATCH',
          body: formData
        })
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => ({}))
        return { succes: false, erreur: corps.erreur || 'Envoi impossible.' }
      }

      const donnees = await reponse.json()
      this.avatarUrl = donnees.avatarUrl || ''
      return { succes: true }
    },

    // Rectification du nom (RGPD art. 16).
    async mettreAJourNom(nom) {
      try {
        const reponse = await fetch('/api/auth/profil', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom })
        })
        const corps = await reponse.json().catch(() => ({}))
        if (!reponse.ok) return { succes: false, erreur: corps.erreur || 'Modification impossible.' }
        this.nom = corps.nom
        memoriserIndice({ type: 'utilisateur', nom: corps.nom })
        return { succes: true }
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    },

    // Droit d'accès et à la portabilité (RGPD art. 15 et 20) : télécharge un fichier JSON.
    async telechargerMesDonnees() {
      try {
        const reponse = await fetch('/api/auth/mes-donnees')
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Téléchargement impossible.' }
        }
        const url = URL.createObjectURL(await reponse.blob())
        const lien = document.createElement('a')
        lien.href = url
        lien.download = 'mes-donnees-signale-mayotte.json'
        document.body.appendChild(lien)
        lien.click()
        lien.remove()
        URL.revokeObjectURL(url)
        return { succes: true }
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    },

    // Droit à l'effacement (RGPD art. 17).
    async supprimerCompte(motDePasse, avecContenus) {
      try {
        const reponse = await fetch('/api/auth/compte', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motDePasse, avecContenus })
        })
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Suppression impossible.' }
        }
        // Le serveur a déjà fermé la session et effacé le cookie : on vide l'état local.
        appliquerSession(null)
        return { succes: true }
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    },

    async supprimerAvatar() {
      try {
        const reponse = await fetch('/api/auth/avatar', { method: 'DELETE' })
        if (!reponse.ok) {
          const corps = await reponse.json().catch(() => ({}))
          return { succes: false, erreur: corps.erreur || 'Suppression impossible.' }
        }
        this.avatarUrl = ''
        return { succes: true }
      } catch {
        return {
          succes: false,
          erreur: 'Le serveur ne répond pas. Il redémarre peut-être : réessayez dans un instant.'
        }
      }
    }
  }
})
