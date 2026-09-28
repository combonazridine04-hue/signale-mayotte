<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { usePartenaireStore } from '../../stores/partenaireStore.js'
import ChampMotDePasse from '../../components/ChampMotDePasse.vue'

const router = useRouter()
const partenaireStore = usePartenaireStore()

const messageErreur = ref('')
const envoiEnCours = ref(false)

const connecter = async (event) => {
  const donnees = new FormData(event.target)
  const identifiant = donnees.get('identifiant').trim()
  const motDePasse = donnees.get('motDePasse')

  envoiEnCours.value = true
  messageErreur.value = ''

  const resultat = await partenaireStore.connecter(identifiant, motDePasse)
  if (resultat.succes) {
    router.push({ name: 'partenaire-dashboard' })
  } else {
    messageErreur.value = resultat.erreur
  }

  envoiEnCours.value = false
}
</script>

<template>
  <!-- Même mise en page que la connexion admin (admin-login.css, réutilisé tel quel) :
       c'est un autre espace privé, protégé de la même façon. -->
  <div class="admin-login-page">
    <form class="admin-login-card" novalidate @submit.prevent="connecter">
      <div class="admin-login-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M5 21V9l7-5 7 5v12" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </div>
      <h1 class="admin-login-title">Espace partenaire</h1>
      <p class="admin-login-subtitle">Connexion réservée aux communes et services partenaires</p>

      <div class="admin-field">
        <label for="identifiant">Identifiant</label>
        <input id="identifiant" name="identifiant" type="text" autocomplete="username" autofocus required />
      </div>

      <div class="admin-field">
        <label for="motDePasse">Mot de passe</label>
        <ChampMotDePasse id="motDePasse" name="motDePasse" autocomplete="current-password" required classe-input="" />
      </div>

      <div v-if="messageErreur" class="admin-login-erreur">{{ messageErreur }}</div>

      <button type="submit" class="admin-login-submit" :disabled="envoiEnCours">
        {{ envoiEnCours ? 'Connexion...' : 'Se connecter' }}
      </button>

      <RouterLink to="/" class="admin-login-retour">← Retour au site</RouterLink>
    </form>
  </div>
</template>
