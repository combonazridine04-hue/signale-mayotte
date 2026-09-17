<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import ChampMotDePasse from '../components/ChampMotDePasse.vue'
import logo from '../assets/img/logo.svg'

const router = useRouter()
const citoyenStore = useCitoyenStore()

const formulaire = reactive({
  nom: '',
  email: '',
  telephone: '',
  motDePasse: '',
  confirmationMotDePasse: ''
})
const siteWeb = ref('')

const soumis = ref(false)
const erreurEnvoi = ref('')
const envoiEnCours = ref(false)

const erreurs = computed(() => ({
  nom: formulaire.nom.trim().length < 2,
  contact: !formulaire.email.trim() && !formulaire.telephone.trim(),
  motDePasse: formulaire.motDePasse.length < 8,
  confirmation: formulaire.confirmationMotDePasse !== formulaire.motDePasse
}))
const formulaireValide = computed(() => !Object.values(erreurs.value).some(Boolean))

const inscrire = async () => {
  soumis.value = true
  erreurEnvoi.value = ''
  if (!formulaireValide.value) return

  envoiEnCours.value = true
  const resultat = await citoyenStore.inscrire({
    nom: formulaire.nom.trim(),
    email: formulaire.email.trim(),
    telephone: formulaire.telephone.trim(),
    motDePasse: formulaire.motDePasse,
    site_web: siteWeb.value
  })
  if (resultat.succes) {
    router.push(resultat.emailAConfirmer ? { name: 'verifier-email' } : { name: 'accueil' })
  } else {
    erreurEnvoi.value = resultat.erreur
  }
  envoiEnCours.value = false
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5 align-items-center">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold">Créer mon compte</h1>
          <p class="text-secondary">
            Un compte gratuit est nécessaire pour signaler un problème, soutenir un
            signalement existant ou laisser un commentaire. Ça nous permet de savoir
            qui contribue et de limiter les abus — ton identité reste privée, jamais
            affichée publiquement.
          </p>
          <div class="d-flex align-items-center gap-2 mt-4">
            <img :src="logo" alt="" width="36" height="36" />
            <span class="fw-bold">Signale Mayotte</span>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <form class="card-glass rounded p-4 shadow-sm" novalidate @submit.prevent="inscrire">
            <h2 class="h5 fw-bold mb-3">Mes informations</h2>

            <div class="mb-3">
              <label for="nom" class="form-label">Nom complet</label>
              <input
                id="nom"
                v-model="formulaire.nom"
                type="text"
                autocomplete="name"
                autofocus
                maxlength="100"
                class="form-control"
                :class="{ 'is-invalid': soumis && erreurs.nom }"
              />
              <div class="invalid-feedback">Le nom doit contenir au moins 2 caractères.</div>
            </div>

            <div class="row g-3">
              <div class="col-12 col-sm-6">
                <label for="email" class="form-label">Email</label>
                <input
                  id="email"
                  v-model="formulaire.email"
                  type="email"
                  autocomplete="email"
                  class="form-control"
                  :class="{ 'is-invalid': soumis && erreurs.contact }"
                />
              </div>
              <div class="col-12 col-sm-6">
                <label for="telephone" class="form-label">Téléphone</label>
                <input
                  id="telephone"
                  v-model="formulaire.telephone"
                  type="tel"
                  autocomplete="tel"
                  placeholder="ex. 0639 00 00 00"
                  class="form-control"
                  :class="{ 'is-invalid': soumis && erreurs.contact }"
                />
                <div class="invalid-feedback">Renseignez au moins l'un des deux (email ou téléphone).</div>
              </div>
            </div>

            <hr class="my-4 border-secondary-subtle" />

            <div class="row g-3">
              <div class="col-12 col-sm-6">
                <label for="motDePasse" class="form-label">Mot de passe</label>
                <ChampMotDePasse
                  id="motDePasse"
                  v-model="formulaire.motDePasse"
                  autocomplete="new-password"
                  :class="{ 'is-invalid': soumis && erreurs.motDePasse }"
                >
                  <div class="invalid-feedback">Au moins 8 caractères.</div>
                </ChampMotDePasse>
              </div>
              <div class="col-12 col-sm-6">
                <label for="confirmationMotDePasse" class="form-label">Confirmation</label>
                <ChampMotDePasse
                  id="confirmationMotDePasse"
                  v-model="formulaire.confirmationMotDePasse"
                  autocomplete="new-password"
                  :class="{
                    'is-invalid': formulaire.confirmationMotDePasse.length > 0 && erreurs.confirmation,
                    'is-valid': formulaire.confirmationMotDePasse.length > 0 && !erreurs.confirmation
                  }"
                >
                  <div class="invalid-feedback">Les mots de passe ne correspondent pas.</div>
                  <div class="valid-feedback">Les mots de passe correspondent.</div>
                </ChampMotDePasse>
              </div>
            </div>

            <div class="honeypot-field" aria-hidden="true">
              <label for="inscription-site-web">Site web</label>
              <input id="inscription-site-web" v-model="siteWeb" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <div v-if="erreurEnvoi" class="alert alert-danger py-2 mt-3 mb-0">{{ erreurEnvoi }}</div>

            <button type="submit" class="btn btn-primary btn-lg w-100 mt-4" :disabled="envoiEnCours">
              {{ envoiEnCours ? 'Création en cours...' : 'Créer mon compte' }}
            </button>

            <p class="text-secondary text-center mt-3 mb-0">
              Déjà inscrit ? <RouterLink to="/connexion">Se connecter</RouterLink>
            </p>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
