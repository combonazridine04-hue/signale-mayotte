<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const router = useRouter()
const route = useRoute()
const citoyenStore = useCitoyenStore()

const messageErreur = ref('')
const envoiEnCours = ref(false)

const connecter = async (event) => {
  const donnees = new FormData(event.target)
  const identifiant = donnees.get('identifiant').trim()
  const motDePasse = donnees.get('motDePasse')

  envoiEnCours.value = true
  messageErreur.value = ''

  const resultat = await citoyenStore.connecter(identifiant, motDePasse)
  if (resultat.succes) {
    router.push(route.query.retour || { name: 'accueil' })
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
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </div>
      <h1 class="admin-login-title">Connexion</h1>
      <p class="admin-login-subtitle">Signale Mayotte</p>

      <div class="admin-field">
        <label for="identifiant">Email ou téléphone</label>
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

      <p class="text-secondary small text-center mt-3 mb-0">
        Pas encore de compte ? <RouterLink to="/inscription">S'inscrire</RouterLink>
      </p>
      <RouterLink to="/" class="admin-login-retour">← Retour au site</RouterLink>
    </form>
  </div>
</template>
