<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CATEGORIES, COMMUNES, ORGANISME_PAR_CATEGORIE } from '../models/signalement.js'
import { useSignalementStore } from '../stores/signalementStore.js'
import PhotoDropzone from '../components/PhotoDropzone.vue'
import LocationPicker from '../components/LocationPicker.vue'
import OrganismeCompetent from '../components/OrganismeCompetent.vue'

const router = useRouter()
const signalementStore = useSignalementStore()

const formulaire = reactive({
  categorie: '',
  commune: '',
  description: '',
  email: '',
  latitude: null,
  longitude: null
})

// Champ piège anti-robot : reste vide pour un visiteur humain, ne pas le retirer.
const siteWeb = ref('')

const fichiersPhotos = ref([])
const envoiEnCours = ref(false)
const erreurEnvoi = ref('')

const soumis = ref(false)
const erreurs = computed(() => ({
  categorie: formulaire.categorie === '',
  commune: formulaire.commune === '',
  description: formulaire.description.trim().length < 10
}))

const formulaireValide = computed(() => !Object.values(erreurs.value).some(Boolean))

const organismeCompetent = computed(() => ORGANISME_PAR_CATEGORIE[formulaire.categorie] || null)

const envoyer = async () => {
  soumis.value = true
  if (!formulaireValide.value) return

  envoiEnCours.value = true
  erreurEnvoi.value = ''

  try {
    const donnees = new FormData()
    donnees.set('categorie', formulaire.categorie)
    donnees.set('commune', formulaire.commune)
    donnees.set('description', formulaire.description)
    donnees.set('site_web', siteWeb.value)
    if (formulaire.email) donnees.set('email', formulaire.email)
    if (formulaire.latitude && formulaire.longitude) {
      donnees.set('latitude', formulaire.latitude)
      donnees.set('longitude', formulaire.longitude)
    }
    for (const fichier of fichiersPhotos.value) {
      donnees.append('photos', fichier)
    }

    const signalement = await signalementStore.ajouter(donnees)
    router.push({ path: `/signalements/${signalement.id}`, query: { nouveau: '1' } })
  } catch (e) {
    erreurEnvoi.value = e.message
  } finally {
    envoiEnCours.value = false
  }
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Nouveau signalement</p>
          <h1 class="fw-bold">Signaler un problème</h1>
          <p class="text-secondary">
            Décrivez le problème que vous constatez : dépôt sauvage, route abîmée,
            éclairage en panne, fuite d'eau... Aucun compte n'est nécessaire.
          </p>
        </div>

        <div class="col-12 col-lg-7">
          <form class="card-glass rounded p-4 shadow-sm" novalidate @submit.prevent="envoyer">
            <div class="mb-3">
              <label for="categorie" class="form-label">Catégorie</label>
              <select
                id="categorie"
                v-model="formulaire.categorie"
                class="form-select"
                :class="{ 'is-invalid': soumis && erreurs.categorie }"
              >
                <option value="">Choisir une catégorie</option>
                <option v-for="categorie in CATEGORIES" :key="categorie" :value="categorie">{{ categorie }}</option>
              </select>
              <div class="invalid-feedback">Veuillez sélectionner une catégorie.</div>

              <OrganismeCompetent v-if="organismeCompetent" :organisme="organismeCompetent" class="mt-2" />
            </div>

            <div class="mb-3">
              <label for="commune" class="form-label">Commune</label>
              <select
                id="commune"
                v-model="formulaire.commune"
                class="form-select"
                :class="{ 'is-invalid': soumis && erreurs.commune }"
              >
                <option value="">Choisir une commune</option>
                <option v-for="commune in COMMUNES" :key="commune" :value="commune">{{ commune }}</option>
              </select>
              <div class="invalid-feedback">Veuillez sélectionner une commune.</div>
            </div>

            <div class="mb-3">
              <label for="description" class="form-label">Description</label>
              <textarea
                id="description"
                v-model="formulaire.description"
                rows="5"
                maxlength="2000"
                class="form-control"
                :class="{ 'is-invalid': soumis && erreurs.description }"
                placeholder="Décrivez précisément le problème et sa localisation..."
              ></textarea>
              <div class="invalid-feedback">La description doit contenir au moins 10 caractères.</div>
            </div>

            <div class="mb-3">
              <label for="email" class="form-label">Email (facultatif)</label>
              <input
                id="email"
                v-model="formulaire.email"
                type="email"
                class="form-control"
                placeholder="Pour recevoir une confirmation et suivre votre signalement"
              />
            </div>

            <div class="mb-3">
              <label class="form-label">Photos (facultatif)</label>
              <PhotoDropzone v-model="fichiersPhotos" />
            </div>

            <div class="honeypot-field" aria-hidden="true">
              <label for="site_web">Site web</label>
              <input id="site_web" v-model="siteWeb" type="text" name="site_web" tabindex="-1" autocomplete="off" />
            </div>

            <div class="mb-3">
              <label class="form-label">Localisation (facultatif)</label>
              <LocationPicker v-model:latitude="formulaire.latitude" v-model:longitude="formulaire.longitude" />
            </div>

            <div v-if="erreurEnvoi" class="alert alert-danger py-2">{{ erreurEnvoi }}</div>

            <button type="submit" class="btn btn-success btn-lg" :disabled="envoiEnCours">
              {{ envoiEnCours ? 'Envoi en cours...' : 'Envoyer le signalement' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
