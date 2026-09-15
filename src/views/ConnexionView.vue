<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import logo from '../assets/img/logo.svg'

const router = useRouter()
const route = useRoute()
const citoyenStore = useCitoyenStore()

const identifiant = ref('')
const motDePasse = ref('')
const messageErreur = ref('')
const envoiEnCours = ref(false)

const connecter = async () => {
  envoiEnCours.value = true
  messageErreur.value = ''

  const resultat = await citoyenStore.connecter(identifiant.value.trim(), motDePasse.value)
  if (resultat.succes) {
    router.push(route.query.retour || { name: 'accueil' })
  } else {
    messageErreur.value = resultat.erreur
  }

  envoiEnCours.value = false
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5 align-items-center justify-content-center">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold">Connexion</h1>
          <p class="text-secondary">
            Connecte-toi pour signaler un problème, soutenir un signalement existant
            ou laisser un commentaire.
          </p>
          <div class="d-flex align-items-center gap-2 mt-4">
            <img :src="logo" alt="" width="36" height="36" />
            <span class="fw-bold">Signale Mayotte</span>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <form class="card-glass rounded p-4 shadow-sm" novalidate @submit.prevent="connecter">
            <h2 class="h5 fw-bold mb-3">Mes identifiants</h2>

            <div class="mb-3">
              <label for="identifiant" class="form-label">Email ou téléphone</label>
              <input
                id="identifiant"
                v-model="identifiant"
                type="text"
                autocomplete="username"
                autofocus
                required
                class="form-control"
              />
            </div>

            <div class="mb-3">
              <label for="motDePasse" class="form-label">Mot de passe</label>
              <input
                id="motDePasse"
                v-model="motDePasse"
                type="password"
                autocomplete="current-password"
                required
                class="form-control"
              />
              <div class="text-end mt-1">
                <RouterLink to="/mot-de-passe-oublie" class="small">Mot de passe oublié ?</RouterLink>
              </div>
            </div>

            <div v-if="messageErreur" class="alert alert-danger py-2 mb-0">{{ messageErreur }}</div>

            <button type="submit" class="btn btn-primary btn-lg w-100 mt-4" :disabled="envoiEnCours">
              {{ envoiEnCours ? 'Connexion...' : 'Se connecter' }}
            </button>

            <p class="text-secondary text-center mt-3 mb-0">
              Pas encore de compte ? <RouterLink to="/inscription">S'inscrire</RouterLink>
            </p>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
