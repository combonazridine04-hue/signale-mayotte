<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import ChampMotDePasse from '../components/ChampMotDePasse.vue'
import logo from '../assets/img/logo.svg'

const route = useRoute()
const router = useRouter()
const citoyenStore = useCitoyenStore()

const motDePasse = ref('')
const confirmation = ref('')
const messageErreur = ref('')
const envoiEnCours = ref(false)
const succes = ref(false)

const confirmationInvalide = computed(() => confirmation.value.length > 0 && confirmation.value !== motDePasse.value)
const confirmationValide = computed(() => confirmation.value.length > 0 && confirmation.value === motDePasse.value)

const valider = async () => {
  messageErreur.value = ''

  if (motDePasse.value.length < 8) {
    messageErreur.value = 'Le mot de passe doit contenir au moins 8 caractères.'
    return
  }
  if (motDePasse.value !== confirmation.value) {
    messageErreur.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  envoiEnCours.value = true
  const resultat = await citoyenStore.reinitialiserMotDePasse(route.query.token || '', motDePasse.value)
  envoiEnCours.value = false

  if (resultat.succes) {
    succes.value = true
    setTimeout(() => router.push({ name: 'connexion' }), 2000)
  } else {
    messageErreur.value = resultat.erreur
  }
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5 align-items-center justify-content-center">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold">Nouveau mot de passe</h1>
          <p class="text-secondary">
            Choisis un nouveau mot de passe pour ton compte.
          </p>
          <div class="d-flex align-items-center gap-2 mt-4">
            <img :src="logo" alt="" width="36" height="36" />
            <span class="fw-bold">Signale Mayotte</span>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card-glass rounded p-4 shadow-sm">
            <template v-if="succes">
              <h2 class="h5 fw-bold text-success mb-2">Mot de passe mis à jour !</h2>
              <p class="text-secondary mb-0">Tu vas être redirigé vers la connexion...</p>
            </template>
            <form v-else novalidate @submit.prevent="valider">
              <h2 class="h5 fw-bold mb-3">Choisir un nouveau mot de passe</h2>

              <div class="mb-3">
                <label for="motDePasse" class="form-label">Nouveau mot de passe</label>
                <ChampMotDePasse
                  id="motDePasse"
                  v-model="motDePasse"
                  autocomplete="new-password"
                  autofocus
                  required
                />
              </div>

              <div class="mb-3">
                <label for="confirmation" class="form-label">Confirmation</label>
                <ChampMotDePasse
                  id="confirmation"
                  v-model="confirmation"
                  autocomplete="new-password"
                  required
                  :class="{ 'is-invalid': confirmationInvalide, 'is-valid': confirmationValide }"
                >
                  <div class="invalid-feedback">Les mots de passe ne correspondent pas.</div>
                  <div class="valid-feedback">Les mots de passe correspondent.</div>
                </ChampMotDePasse>
              </div>

              <div v-if="messageErreur" class="alert alert-danger py-2 mb-0">{{ messageErreur }}</div>

              <button type="submit" class="btn btn-primary btn-lg w-100 mt-4" :disabled="envoiEnCours">
                {{ envoiEnCours ? 'Validation...' : 'Valider' }}
              </button>
            </form>

            <p class="text-secondary text-center mt-3 mb-0">
              <RouterLink to="/connexion">Retour à la connexion</RouterLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
