<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import PanneauAide from '../components/PanneauAide.vue'
import logo from '../assets/img/logo.svg'

// C'est la page où les gens se retrouvent bloqués. Chaque point correspond à une
// cause réelle de non-réception, vérifiée dans le code du serveur.
const aide = [
  {
    titre: 'Regardez dans les spams',
    texte: "L'email arrive parfois dans le courrier indésirable, surtout la première fois."
  },
  {
    titre: "C'est l'adresse du compte qui compte",
    texte: "Le lien ne part que vers l'adresse enregistrée à l'inscription, pas vers une autre."
  },
  {
    titre: 'Compte créé avec un téléphone ?',
    texte: 'Sans email enregistré, aucun lien ne peut être envoyé. Écrivez-nous depuis la page Contact.'
  },
  {
    titre: 'Patientez une minute',
    texte:
      "L'envoi n'est pas toujours instantané. Évitez de redemander plusieurs liens : seul le dernier reste valable."
  }
]

const citoyenStore = useCitoyenStore()

const email = ref('')
const envoiEnCours = ref(false)
const envoye = ref(false)

const envoyer = async () => {
  envoiEnCours.value = true
  await citoyenStore.demanderReinitialisationMotDePasse(email.value.trim())
  envoiEnCours.value = false
  envoye.value = true
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5 align-items-center justify-content-center">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold">Mot de passe oublié</h1>
          <p class="text-secondary">
            Indiquez l'email de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.
          </p>
          <PanneauAide
            titre="Si l'email n'arrive pas"
            :points="aide"
            note="Le lien reste valable une heure. Passé ce délai, redemandez-en un : l'ancien ne fonctionne plus."
          />

          <RouterLink
            to="/"
            class="lien-marque d-inline-flex align-items-center gap-2 mt-4"
            aria-label="Signale Mayotte — retour à l'accueil"
          >
            <img :src="logo" alt="" width="36" height="36" />
            <span class="fw-bold">Signale Mayotte</span>
          </RouterLink>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card-glass rounded p-4 shadow-sm">
            <template v-if="envoye">
              <h2 class="h5 fw-bold mb-2">Email envoyé</h2>
              <p class="text-secondary mb-0">
                Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé. Vérifiez votre
                boîte de réception (et les spams).
              </p>
            </template>
            <form v-else novalidate @submit.prevent="envoyer">
              <h2 class="h5 fw-bold mb-3">Réinitialiser mon mot de passe</h2>

              <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  autofocus
                  required
                  class="form-control"
                />
              </div>

              <button type="submit" class="btn btn-primary btn-lg w-100 mt-2" :disabled="envoiEnCours">
                {{ envoiEnCours ? 'Envoi...' : 'Envoyer le lien' }}
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
