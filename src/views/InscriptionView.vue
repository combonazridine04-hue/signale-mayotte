<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const router = useRouter()
const citoyenStore = useCitoyenStore()

const messageErreur = ref('')
const envoiEnCours = ref(false)

const inscrire = async (event) => {
  const donnees = new FormData(event.target)
  const nom = donnees.get('nom').trim()
  const email = donnees.get('email').trim()
  const telephone = donnees.get('telephone').trim()
  const motDePasse = donnees.get('motDePasse')

  if (!email && !telephone) {
    messageErreur.value = 'Renseignez un email ou un numéro de téléphone.'
    return
  }

  envoiEnCours.value = true
  messageErreur.value = ''

  const resultat = await citoyenStore.inscrire({ nom, email, telephone, motDePasse })
  if (resultat.succes) {
    router.push({ name: 'accueil' })
  } else {
    messageErreur.value = resultat.erreur
  }

  envoiEnCours.value = false
}
</script>

<template>
  <div class="admin-login-page">
    <form class="admin-login-card" novalidate @submit.prevent="inscrire">
      <div class="admin-login-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </div>
      <h1 class="admin-login-title">Créer un compte</h1>
      <p class="admin-login-subtitle">Nécessaire pour signaler, soutenir et commenter</p>

      <div class="admin-field">
        <label for="nom">Nom</label>
        <input id="nom" name="nom" type="text" autocomplete="name" autofocus required minlength="2" maxlength="100" />
      </div>

      <div class="admin-field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" />
      </div>

      <div class="admin-field">
        <label for="telephone">Téléphone</label>
        <input id="telephone" name="telephone" type="tel" autocomplete="tel" placeholder="ex. 0639 00 00 00" />
      </div>
      <p class="text-secondary small mt-n2 mb-3">Renseignez au moins l'un des deux (email ou téléphone).</p>

      <div class="admin-field">
        <label for="motDePasse">Mot de passe</label>
        <input id="motDePasse" name="motDePasse" type="password" autocomplete="new-password" required minlength="8" />
      </div>

      <div v-if="messageErreur" class="admin-login-erreur">{{ messageErreur }}</div>

      <button type="submit" class="admin-login-submit" :disabled="envoiEnCours">
        {{ envoiEnCours ? 'Création...' : 'Créer mon compte' }}
      </button>

      <p class="text-secondary small text-center mt-3 mb-0">
        Déjà inscrit ? <RouterLink to="/connexion">Se connecter</RouterLink>
      </p>
      <RouterLink to="/" class="admin-login-retour">← Retour au site</RouterLink>
    </form>
  </div>
</template>
