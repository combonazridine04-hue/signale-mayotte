<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CATEGORIES, COMMUNES, STATUTS, ORGANISME_PAR_CATEGORIE } from '../models/signalement.js'
import { useSignalementStore } from '../stores/signalementStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useUiStore } from '../stores/uiStore.js'
import { enregistrerTokenSuppression, lireTokenSuppression } from '../utils/tokensSuppression.js'
import PhotoDropzone from '../components/PhotoDropzone.vue'
import LocationPicker from '../components/LocationPicker.vue'
import OrganismeCompetent from '../components/OrganismeCompetent.vue'

const props = defineProps({
  id: {
    type: [String, Number],
    required: true
  }
})

const route = useRoute()
const router = useRouter()
const signalementStore = useSignalementStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const imageEnErreur = ref(false)
const indexImageActive = ref(0)

const modeEdition = ref(false)
const formulaire = reactive({ categorie: '', commune: '', description: '', latitude: null, longitude: null })
const fichiersPhotos = ref([])
const photosConservees = ref([])
const envoiEnCours = ref(false)
const erreurEnvoi = ref('')
const soumis = ref(false)

const erreurs = computed(() => ({
  categorie: formulaire.categorie === '',
  commune: formulaire.commune === '',
  description: formulaire.description.trim().length < 10
}))
const formulaireValide = computed(() => !Object.values(erreurs.value).some(Boolean))

const organismeCompetent = computed(() => {
  const categorie = signalementStore.signalementCourant?.categorie
  return categorie ? ORGANISME_PAR_CATEGORIE[categorie] || null : null
})

const monToken = ref(null)

const charger = () => {
  imageEnErreur.value = false
  indexImageActive.value = 0
  modeEdition.value = false
  signalementStore.chargerParId(props.id)

  if (route.query.token) {
    enregistrerTokenSuppression(props.id, route.query.token)
    // On retire le token de l'URL affichée (historique, partage de lien...) une fois enregistré.
    const { token, ...resteQuery } = route.query
    router.replace({ path: route.path, query: resteQuery })
  }
  monToken.value = lireTokenSuppression(props.id)
}

onMounted(charger)
watch(() => props.id, charger)

const peutSupprimer = computed(() => authStore.estConnecte || Boolean(monToken.value))

const choisirImage = (index) => {
  indexImageActive.value = index
  imageEnErreur.value = false
}

const ouvrirEdition = () => {
  const s = signalementStore.signalementCourant
  formulaire.categorie = s.categorie
  formulaire.commune = s.commune
  formulaire.description = s.description
  formulaire.latitude = s.latitude
  formulaire.longitude = s.longitude
  fichiersPhotos.value = []
  photosConservees.value = [...s.photoUrls]
  soumis.value = false
  erreurEnvoi.value = ''
  modeEdition.value = true
}

const annulerEdition = () => {
  modeEdition.value = false
}

const enregistrer = async () => {
  soumis.value = true
  if (!formulaireValide.value) return

  envoiEnCours.value = true
  erreurEnvoi.value = ''
  try {
    const donnees = new FormData()
    donnees.set('categorie', formulaire.categorie)
    donnees.set('commune', formulaire.commune)
    donnees.set('description', formulaire.description)
    donnees.set('photosConservees', JSON.stringify(photosConservees.value))
    if (formulaire.latitude && formulaire.longitude) {
      donnees.set('latitude', formulaire.latitude)
      donnees.set('longitude', formulaire.longitude)
    }
    for (const fichier of fichiersPhotos.value) {
      donnees.append('photos', fichier)
    }

    await signalementStore.modifier(signalementStore.signalementCourant.id, donnees)
    imageEnErreur.value = false
    indexImageActive.value = 0
    modeEdition.value = false
  } catch (e) {
    erreurEnvoi.value = e.message
  } finally {
    envoiEnCours.value = false
  }
}

const supprimer = async () => {
  if (!(await uiStore.confirmer('Supprimer définitivement ce signalement ?'))) return
  try {
    await signalementStore.supprimer(signalementStore.signalementCourant.id, authStore.estConnecte ? null : monToken.value)
    router.push('/')
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const changerStatutPublic = async (statut) => {
  try {
    await signalementStore.changerStatut(signalementStore.signalementCourant.id, statut)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const soutienEnCours = ref(false)
const erreurSoutien = ref('')

const soutenir = async () => {
  soutienEnCours.value = true
  erreurSoutien.value = ''
  try {
    await signalementStore.soutenir(signalementStore.signalementCourant.id)
  } catch (e) {
    erreurSoutien.value = e.message
  } finally {
    soutienEnCours.value = false
  }
}

const nouveauTexteMiseAJour = ref('')
const ajoutMiseAJourEnCours = ref(false)

const ajouterMiseAJour = async () => {
  if (nouveauTexteMiseAJour.value.trim().length < 3) return
  ajoutMiseAJourEnCours.value = true
  try {
    await signalementStore.ajouterMiseAJour(signalementStore.signalementCourant.id, nouveauTexteMiseAJour.value.trim())
    nouveauTexteMiseAJour.value = ''
  } catch (e) {
    uiStore.alerter(e.message)
  } finally {
    ajoutMiseAJourEnCours.value = false
  }
}

const supprimerMiseAJour = async (miseAJourId) => {
  if (!(await uiStore.confirmer('Supprimer définitivement cette mise à jour ?'))) return
  try {
    await signalementStore.supprimerMiseAJour(signalementStore.signalementCourant.id, miseAJourId)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const fichierPhotoResolution = ref(null)
const resolutionEnCours = ref(false)

const marquerResolu = async () => {
  resolutionEnCours.value = true
  try {
    await signalementStore.changerStatut(
      signalementStore.signalementCourant.id,
      'Résolu',
      fichierPhotoResolution.value
    )
    fichierPhotoResolution.value = null
  } catch (e) {
    uiStore.alerter(e.message)
  } finally {
    resolutionEnCours.value = false
  }
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div v-if="route.query.nouveau" class="alert alert-success mb-4">
        Votre signalement a bien été enregistré. Merci pour votre contribution !
        Vous pourrez le supprimer vous-même depuis ce navigateur, ou depuis le lien reçu par email si vous en avez laissé un.
      </div>

      <p v-if="signalementStore.chargement" class="text-secondary">Chargement...</p>

      <div v-else-if="signalementStore.signalementCourant" class="row g-5">
        <div class="col-12 col-lg-6">
          <img
            v-if="signalementStore.signalementCourant.photoUrls?.[indexImageActive] && !imageEnErreur"
            :src="signalementStore.signalementCourant.photoUrls[indexImageActive]"
            class="detail-image"
            :alt="`${signalementStore.signalementCourant.categorie} — ${signalementStore.signalementCourant.commune}`"
            @error="imageEnErreur = true"
          />
          <div v-else class="detail-image d-flex align-items-center justify-content-center bg-light text-secondary">
            Aucune photo
          </div>

          <div v-if="signalementStore.signalementCourant.photoUrls?.length > 1" class="detail-galerie mt-2">
            <button
              v-for="(url, index) in signalementStore.signalementCourant.photoUrls"
              :key="url"
              type="button"
              class="detail-galerie-vignette"
              :class="{ active: index === indexImageActive }"
              :aria-label="`Voir la photo ${index + 1}`"
              @click="choisirImage(index)"
            >
              <img :src="url" alt="" />
            </button>
          </div>

          <div v-if="signalementStore.signalementCourant.photoResolution" class="mt-4">
            <p class="section-kicker mb-2">Après résolution</p>
            <img :src="signalementStore.signalementCourant.photoResolution" class="detail-image" alt="Photo après résolution" />
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card-glass rounded p-4">
            <template v-if="!modeEdition">
              <span class="badge text-bg-secondary mb-2">{{ signalementStore.signalementCourant.categorie }}</span>
              <h1 class="fw-bold">{{ signalementStore.signalementCourant.commune }}</h1>
              <p class="text-secondary">{{ signalementStore.signalementCourant.description }}</p>
              <p class="text-secondary small">
                Signalé le {{ new Date(signalementStore.signalementCourant.dateSignalement).toLocaleDateString('fr-FR') }}
              </p>

              <OrganismeCompetent v-if="organismeCompetent" :organisme="organismeCompetent" class="mb-3" />

              <div v-if="authStore.estConnecte || peutSupprimer" class="d-flex flex-wrap gap-2 mt-3">
                <button v-if="authStore.estConnecte" type="button" class="btn btn-outline-secondary btn-sm" @click="ouvrirEdition">
                  Modifier
                </button>
                <button v-if="peutSupprimer" type="button" class="btn btn-outline-danger btn-sm" @click="supprimer">
                  Supprimer
                </button>
              </div>
              <p v-if="peutSupprimer && !authStore.estConnecte" class="text-secondary small mt-1 mb-0">
                Vous pouvez supprimer ce signalement car c'est vous qui l'avez créé.
              </p>

              <div class="info-box mt-4">
                <span>Statut</span>
                <select
                  v-if="authStore.estConnecte"
                  class="form-select mt-1"
                  :value="signalementStore.signalementCourant.statut"
                  @change="changerStatutPublic($event.target.value)"
                >
                  <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
                </select>
                <p v-else class="mb-0 fw-semibold">{{ signalementStore.signalementCourant.statut }}</p>
              </div>

              <div class="d-flex align-items-center gap-3 mt-3">
                <button
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  :disabled="soutienEnCours || signalementStore.signalementCourant.dejaSoutenu"
                  @click="soutenir"
                >
                  👍 {{ signalementStore.signalementCourant.dejaSoutenu ? 'Soutenu' : 'Moi aussi' }}
                </button>
                <span class="text-secondary small">
                  {{ signalementStore.signalementCourant.nbSoutiens }} soutien{{ signalementStore.signalementCourant.nbSoutiens > 1 ? 's' : '' }}
                </span>
              </div>
              <p v-if="erreurSoutien" class="text-danger small mt-1 mb-0">{{ erreurSoutien }}</p>

              <div v-if="authStore.estConnecte && signalementStore.signalementCourant.statut !== 'Résolu'" class="info-box mt-4">
                <span>Marquer comme résolu</span>
                <div class="d-flex flex-wrap gap-2 align-items-center mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    class="form-control form-control-sm"
                    style="max-width: 220px"
                    @change="fichierPhotoResolution = $event.target.files[0] || null"
                  />
                  <button type="button" class="btn btn-success btn-sm" :disabled="resolutionEnCours" @click="marquerResolu">
                    {{ resolutionEnCours ? 'Enregistrement...' : 'Marquer résolu' }}
                  </button>
                </div>
                <p class="text-secondary small mt-1 mb-0">Photo facultative, montrant le problème réglé.</p>
              </div>

              <div class="info-box mt-4">
                <span>Suivi</span>
                <div v-if="authStore.estConnecte" class="d-flex gap-2 mt-2">
                  <input
                    v-model="nouveauTexteMiseAJour"
                    type="text"
                    class="form-control form-control-sm"
                    maxlength="1000"
                    placeholder="Ajouter une mise à jour publique..."
                    @keyup.enter="ajouterMiseAJour"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm text-nowrap"
                    :disabled="ajoutMiseAJourEnCours || nouveauTexteMiseAJour.trim().length < 3"
                    @click="ajouterMiseAJour"
                  >
                    Ajouter
                  </button>
                </div>

                <p v-if="!signalementStore.signalementCourant.misesAJour?.length" class="text-secondary small mt-2 mb-0">
                  Aucune mise à jour pour le moment.
                </p>
                <ul v-else class="detail-suivi mt-2 mb-0">
                  <li v-for="m in signalementStore.signalementCourant.misesAJour" :key="m.id" class="detail-suivi-item">
                    <p class="mb-0">{{ m.texte }}</p>
                    <div class="d-flex align-items-center gap-2">
                      <span class="text-secondary small">{{ new Date(m.dateCreation).toLocaleString('fr-FR') }}</span>
                      <button
                        v-if="authStore.estConnecte"
                        type="button"
                        class="btn btn-link btn-sm text-danger p-0"
                        @click="supprimerMiseAJour(m.id)"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                </ul>
              </div>
            </template>

            <form v-else novalidate @submit.prevent="enregistrer">
              <h2 class="h5 fw-bold mb-3">Modifier le signalement</h2>

              <div class="mb-3">
                <label for="edit-categorie" class="form-label">Catégorie</label>
                <select
                  id="edit-categorie"
                  v-model="formulaire.categorie"
                  class="form-select"
                  :class="{ 'is-invalid': soumis && erreurs.categorie }"
                >
                  <option value="">Choisir une catégorie</option>
                  <option v-for="categorie in CATEGORIES" :key="categorie" :value="categorie">{{ categorie }}</option>
                </select>
                <div class="invalid-feedback">Veuillez sélectionner une catégorie.</div>
              </div>

              <div class="mb-3">
                <label for="edit-commune" class="form-label">Commune</label>
                <select
                  id="edit-commune"
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
                <label for="edit-description" class="form-label">Description</label>
                <textarea
                  id="edit-description"
                  v-model="formulaire.description"
                  rows="4"
                  maxlength="2000"
                  class="form-control"
                  :class="{ 'is-invalid': soumis && erreurs.description }"
                ></textarea>
                <div class="invalid-feedback">La description doit contenir au moins 10 caractères.</div>
              </div>

              <div class="mb-3">
                <label class="form-label">Photos (facultatif)</label>
                <PhotoDropzone
                  v-model="fichiersPhotos"
                  :existantes="photosConservees"
                  @update:existantes="photosConservees = $event"
                />
              </div>

              <div class="mb-3">
                <label class="form-label">Localisation (facultatif)</label>
                <LocationPicker v-model:latitude="formulaire.latitude" v-model:longitude="formulaire.longitude" />
              </div>

              <div v-if="erreurEnvoi" class="alert alert-danger py-2">{{ erreurEnvoi }}</div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-success" :disabled="envoiEnCours">
                  {{ envoiEnCours ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
                <button type="button" class="btn btn-outline-secondary" @click="annulerEdition">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div v-else class="empty-state text-center py-5">
        <p class="text-secondary mb-0">{{ signalementStore.erreur || 'Ce signalement est introuvable.' }}</p>
      </div>
    </div>
  </main>
</template>
