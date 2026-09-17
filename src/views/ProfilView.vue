<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const router = useRouter()
const citoyenStore = useCitoyenStore()

const chargement = ref(true)
const pseudo = ref('')
const enregistrementEnCours = ref(false)
const messageErreur = ref('')
const messageSucces = ref('')

onMounted(async () => {
  const resultat = await citoyenStore.chargerProfil()
  if (resultat.succes) pseudo.value = citoyenStore.pseudo
  chargement.value = false
})

const enregistrer = async () => {
  enregistrementEnCours.value = true
  messageErreur.value = ''
  messageSucces.value = ''

  const resultat = await citoyenStore.mettreAJourPseudo(pseudo.value.trim())
  enregistrementEnCours.value = false

  if (resultat.succes) {
    messageSucces.value = 'Pseudo enregistré.'
  } else {
    messageErreur.value = resultat.erreur
  }
}

const deconnecter = () => {
  citoyenStore.deconnecter()
  router.push({ name: 'accueil' })
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-6">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold mb-4">Mon profil</h1>

          <div v-if="chargement" class="card-glass rounded p-4 shadow-sm">
            <p class="mb-0">Chargement...</p>
          </div>

          <template v-else>
            <div class="card-glass rounded p-4 shadow-sm mb-3">
              <h2 class="h5 fw-bold mb-3">Pseudo public</h2>
              <p class="text-secondary small mb-3">
                Ce pseudo est affiché à la place de ton nom complet sur tes commentaires publics.
                Laisse-le vide pour rester anonyme.
              </p>

              <form novalidate @submit.prevent="enregistrer">
                <div class="mb-3">
                  <label for="pseudo" class="form-label">Pseudo</label>
                  <input
                    id="pseudo"
                    v-model="pseudo"
                    type="text"
                    maxlength="24"
                    placeholder="ex. Citoyen76"
                    class="form-control"
                  />
                  <div class="form-text">2 à 24 caractères : lettres, chiffres, espaces, - ou _.</div>
                </div>

                <div v-if="messageErreur" class="alert alert-danger py-2 mb-3">{{ messageErreur }}</div>
                <div v-if="messageSucces" class="alert alert-success py-2 mb-3">{{ messageSucces }}</div>

                <button type="submit" class="btn btn-primary" :disabled="enregistrementEnCours">
                  {{ enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              </form>
            </div>

            <div class="card-glass rounded p-4 shadow-sm mb-3">
              <h2 class="h5 fw-bold mb-3">Mes informations</h2>
              <p class="mb-1"><strong>Nom :</strong> {{ citoyenStore.nom }}</p>
              <p v-if="citoyenStore.email" class="mb-1">
                <strong>Email :</strong> {{ citoyenStore.email }}
                <span v-if="citoyenStore.emailVerifie" class="badge text-bg-success ms-1">vérifié</span>
                <span v-else class="badge text-bg-warning ms-1">non vérifié</span>
              </p>
              <p v-if="citoyenStore.telephone" class="mb-0"><strong>Téléphone :</strong> {{ citoyenStore.telephone }}</p>

              <RouterLink v-if="citoyenStore.email" to="/mot-de-passe-oublie" class="d-inline-block mt-3 small">
                Changer mon mot de passe
              </RouterLink>
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <RouterLink to="/mes-signalements" class="small">Voir mes signalements</RouterLink>
              <button type="button" class="btn btn-outline-danger btn-sm" @click="deconnecter">
                Se déconnecter
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </main>
</template>
