<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'

const router = useRouter()
const authStore = useAuthStore()

const messageErreur = ref('')
const envoiEnCours = ref(false)

const connecter = async (event) => {
  const donnees = new FormData(event.target)
  const identifiant = donnees.get('identifiant').trim()
  const motDePasse = donnees.get('motDePasse')

  envoiEnCours.value = true
  messageErreur.value = ''

  const resultat = await authStore.connecter(identifiant, motDePasse)
  if (resultat.succes) {
    router.push({ name: 'admin-dashboard' })
  } else {
    messageErreur.value = resultat.erreur
  }

  envoiEnCours.value = false
}
</script>

<template>
  <div class="admin-login-page">
    <form class="admin-login-card" novalidate @submit.prevent="connecter">
      <div class="admin-login-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l7 3v5c0 4.8-3 8.5-7 10-4-1.5-7-5.2-7-10V6l7-3Z" />
        </svg>
      </div>
      <h1 class="admin-login-title">Espace admin</h1>
      <p class="admin-login-subtitle">Connexion sécurisée — Signale Mayotte</p>

      <div class="admin-field">
        <label for="identifiant">Identifiant</label>
        <input id="identifiant" name="identifiant" type="text" autocomplete="username" autofocus required />
      </div>

      <div class="admin-field">
        <label for="motDePasse">Mot de passe</label>
        <input id="motDePasse" name="motDePasse" type="password" autocomplete="current-password" required />
      </div>

      <div v-if="messageErreur" class="admin-login-erreur">{{ messageErreur }}</div>

      <button type="submit" class="admin-login-submit" :disabled="envoiEnCours">
        {{ envoiEnCours ? 'Connexion...' : 'Se connecter' }}
      </button>

      <RouterLink to="/" class="admin-login-retour">← Retour au site</RouterLink>
    </form>
  </div>
</template>
