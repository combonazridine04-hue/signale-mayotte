<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const citoyenStore = useCitoyenStore()

const code = ref('')
const messageErreur = ref('')
const envoiEnCours = ref(false)
const succes = ref(false)

const renvoiEnCours = ref(false)
const renvoiMessage = ref('')

const confirmer = async () => {
  messageErreur.value = ''
  envoiEnCours.value = true

  const resultat = await citoyenStore.confirmerEmail(code.value.trim())
  envoiEnCours.value = false

  if (resultat.succes) {
    succes.value = true
  } else {
    messageErreur.value = resultat.erreur
  }
}

const renvoyer = async () => {
  renvoiEnCours.value = true
  renvoiMessage.value = ''
  const resultat = await citoyenStore.renvoyerVerificationEmail()
  renvoiMessage.value = resultat.succes ? 'Nouveau code envoyé, vérifiez votre boîte de réception.' : resultat.erreur
  renvoiEnCours.value = false
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-6 text-center">
          <div class="card-glass rounded p-4 shadow-sm">
            <template v-if="succes">
              <h1 class="h4 fw-bold text-success mb-2">Email confirmé !</h1>
              <p class="text-secondary mb-3">Vous pouvez maintenant envoyer des signalements.</p>
              <RouterLink to="/signaler" class="btn btn-primary">Faire un signalement</RouterLink>
            </template>
            <template v-else>
              <h1 class="h4 fw-bold mb-2">Confirmez votre email</h1>
              <p class="text-secondary mb-3">
                On vient de vous envoyer un code à 6 chiffres par email. Saisissez-le ci-dessous
                (il expire dans 30 minutes).
              </p>

              <form class="text-start" novalidate @submit.prevent="confirmer">
                <label for="code" class="form-label">Code de confirmation</label>
                <input
                  id="code"
                  v-model="code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="6"
                  autocomplete="one-time-code"
                  autofocus
                  required
                  class="form-control form-control-lg text-center"
                  style="letter-spacing: 0.5em; font-size: 1.5rem;"
                />

                <div v-if="messageErreur" class="alert alert-danger py-2 mt-3 mb-0">{{ messageErreur }}</div>

                <button type="submit" class="btn btn-primary btn-lg w-100 mt-4" :disabled="envoiEnCours || code.trim().length !== 6">
                  {{ envoiEnCours ? 'Vérification...' : 'Confirmer' }}
                </button>
              </form>

              <div class="mt-3">
                <button type="button" class="btn btn-link btn-sm p-0" :disabled="renvoiEnCours" @click="renvoyer">
                  Je n'ai pas reçu de code, renvoyer
                </button>
                <div v-if="renvoiMessage" class="small text-secondary mt-1">{{ renvoiMessage }}</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
