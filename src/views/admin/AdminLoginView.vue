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

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f4f5f7;
}

.admin-login-card {
  width: 100%;
  max-width: 380px;
  padding: 2.5rem;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
  text-align: center;
}

.admin-login-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
}

.admin-login-icon svg {
  width: 28px;
  height: 28px;
}

.admin-login-title {
  margin: 0 0 4px;
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
}

.admin-login-subtitle {
  margin: 0 0 1.75rem;
  font-size: 0.9rem;
  color: #64748b;
}

.admin-field {
  text-align: left;
  margin-bottom: 1rem;
}

.admin-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.admin-field input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #d8dce3;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  background: #f9fafb;
}

.admin-field input:focus {
  outline: none;
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.16);
  background: #ffffff;
}

.admin-login-erreur {
  margin-bottom: 1rem;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.1);
  color: #b91c1c;
  font-size: 0.85rem;
}

.admin-login-submit {
  width: 100%;
  padding: 0.7rem;
  border: none;
  border-radius: 999px;
  background: #16a34a;
  color: #ffffff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.admin-login-submit:hover:not(:disabled) {
  background: #15803d;
}

.admin-login-submit:disabled {
  opacity: 0.7;
  cursor: default;
}

.admin-login-retour {
  display: inline-block;
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: #64748b;
  text-decoration: none;
}

.admin-login-retour:hover {
  color: #16a34a;
}
</style>
