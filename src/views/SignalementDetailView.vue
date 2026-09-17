<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { TITRE_SITE } from '../router/index.js'
import { CATEGORIES, COMMUNES, STATUTS, ORGANISME_PAR_CATEGORIE } from '../models/signalement.js'
import { useSignalementStore } from '../stores/signalementStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import { useUiStore } from '../stores/uiStore.js'
import { enregistrerTokenSuppression, lireTokenSuppression } from '../utils/tokensSuppression.js'
import PhotoDropzone from '../components/PhotoDropzone.vue'
import LocationPicker from '../components/LocationPicker.vue'
import OrganismeCompetent from '../components/OrganismeCompetent.vue'
import StatutSuivi from '../components/StatutSuivi.vue'
import { dateRelative, dateComplete } from '../utils/dates.js'

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
const citoyenStore = useCitoyenStore()
const uiStore = useUiStore()
const peutAgir = computed(() => authStore.estConnecte || citoyenStore.estConnecte)
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

// Titre d'onglet propre à ce signalement (le routeur ne connaît que le titre générique).
watch(
  () => signalementStore.signalementCourant,
  (signalement) => {
    document.title = signalement
      ? `${signalement.categorie} à ${signalement.commune} · ${TITRE_SITE}`
      : `Signalement · ${TITRE_SITE}`
  },
  { immediate: true }
)

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

const messagePartage = ref('')

// Beaucoup de signalements circulent par WhatsApp : on utilise le partage natif du
// téléphone quand il existe, sinon on copie simplement le lien dans le presse-papier.
const partager = async () => {
  const signalement = signalementStore.signalementCourant
  if (!signalement) return

  const lien = `${window.location.origin}/signalements/${signalement.id}`
  const texte = `${signalement.categorie} à ${signalement.commune} — Signale Mayotte`

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Signale Mayotte', text: texte, url: lien })
      return
    } catch {
      // Partage annulé par l'utilisateur : on retombe sur la copie du lien.
    }
  }

  try {
    await navigator.clipboard.writeText(lien)
    messagePartage.value = 'Lien copié !'
  } catch {
    messagePartage.value = 'Copie impossible'
  }
  setTimeout(() => { messagePartage.value = '' }, 2500)
}

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

const signalerCommentaire = async (commentaireId) => {
  if (!(await uiStore.confirmer('Signaler ce commentaire comme inapproprié ?'))) return
  try {
    await signalementStore.signalerContenu('commentaire', commentaireId)
    uiStore.alerter('Merci, ce commentaire a été signalé aux administrateurs.')
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const signalerCeSignalement = async () => {
  if (!(await uiStore.confirmer('Signaler ce signalement comme inapproprié ?'))) return
  try {
    await signalementStore.signalerContenu('signalement', signalementStore.signalementCourant.id)
    uiStore.alerter('Merci, ce signalement a été signalé aux administrateurs.')
  } catch (e) {
    uiStore.alerter(e.message)
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

const nouveauCommentaireTexte = ref('')
const ajoutCommentaireEnCours = ref(false)
const erreurCommentaire = ref('')

const ajouterCommentaire = async () => {
  if (nouveauCommentaireTexte.value.trim().length < 3) return
  ajoutCommentaireEnCours.value = true
  erreurCommentaire.value = ''
  try {
    await signalementStore.ajouterCommentaire(signalementStore.signalementCourant.id, {
      texte: nouveauCommentaireTexte.value.trim()
    })
    nouveauCommentaireTexte.value = ''
  } catch (e) {
    erreurCommentaire.value = e.message
  } finally {
    ajoutCommentaireEnCours.value = false
  }
}

const supprimerCommentaire = async (commentaireId) => {
  if (!(await uiStore.confirmer('Supprimer définitivement ce commentaire ?'))) return
  try {
    await signalementStore.supprimerCommentaire(signalementStore.signalementCourant.id, commentaireId)
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
            <p class="section-kicker mb-2">Avant / après</p>
            <div class="avant-apres">
              <figure>
                <img
                  v-if="signalementStore.signalementCourant.photoUrls?.[0]"
                  :src="signalementStore.signalementCourant.photoUrls[0]"
                  alt="Photo au moment du signalement"
                />
                <figcaption>Avant</figcaption>
              </figure>
              <figure>
                <img :src="signalementStore.signalementCourant.photoResolution" alt="Photo après résolution" />
                <figcaption class="apres">Après</figcaption>
              </figure>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card-glass rounded p-4">
            <template v-if="!modeEdition">
              <span class="badge text-bg-secondary mb-2">{{ signalementStore.signalementCourant.categorie }}</span>
              <h1 class="fw-bold">{{ signalementStore.signalementCourant.commune }}</h1>
              <p class="text-secondary">{{ signalementStore.signalementCourant.description }}</p>
              <p class="text-secondary small">
                Signalé
                <time
                  :datetime="signalementStore.signalementCourant.dateSignalement"
                  :title="dateComplete(signalementStore.signalementCourant.dateSignalement)"
                >{{ dateRelative(signalementStore.signalementCourant.dateSignalement) }}</time>
              </p>

              <StatutSuivi
                class="my-4"
                :statut="signalementStore.signalementCourant.statut"
                :date-signalement="signalementStore.signalementCourant.dateSignalement"
                :date-resolution="signalementStore.signalementCourant.dateResolution"
              />

              <OrganismeCompetent v-if="organismeCompetent" :organisme="organismeCompetent" class="mb-3" />

              <p v-if="authStore.estConnecte" class="text-secondary small mb-3">
                Envoyé par :
                <strong>{{ signalementStore.signalementCourant.auteurNom || 'Compte supprimé / signalement anonyme historique' }}</strong>
                <template v-if="signalementStore.signalementCourant.auteurEmail"> — {{ signalementStore.signalementCourant.auteurEmail }}</template>
                <template v-if="signalementStore.signalementCourant.auteurTelephone"> — {{ signalementStore.signalementCourant.auteurTelephone }}</template>
                <span class="d-block">(visible par l'admin uniquement)</span>
              </p>

              <div v-if="authStore.estConnecte || peutSupprimer || peutAgir" class="d-flex flex-wrap gap-2 mt-3">
                <button v-if="authStore.estConnecte" type="button" class="btn btn-outline-secondary btn-sm" @click="ouvrirEdition">
                  Modifier
                </button>
                <button v-if="peutSupprimer" type="button" class="btn btn-outline-danger btn-sm" @click="supprimer">
                  Supprimer
                </button>
                <button v-if="peutAgir" type="button" class="btn btn-outline-warning btn-sm" @click="signalerCeSignalement">
                  🚩 Signaler ce contenu
                </button>
              </div>
              <p v-if="peutSupprimer && !authStore.estConnecte" class="text-secondary small mt-1 mb-0">
                Vous pouvez supprimer ce signalement car c'est vous qui l'avez créé.
              </p>

              <!-- Le statut est déjà lisible dans le suivi visuel ci-dessus : on ne garde
                   ici que le moyen de le modifier, réservé aux administrateurs. -->
              <div v-if="authStore.estConnecte" class="info-box mt-4">
                <span>Changer le statut</span>
                <select
                  class="form-select mt-1"
                  :value="signalementStore.signalementCourant.statut"
                  @change="changerStatutPublic($event.target.value)"
                >
                  <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
                </select>
              </div>

              <div class="d-flex align-items-center gap-3 mt-3">
                <button
                  v-if="peutAgir"
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  :disabled="soutienEnCours || signalementStore.signalementCourant.dejaSoutenu"
                  @click="soutenir"
                >
                  👍 {{ signalementStore.signalementCourant.dejaSoutenu ? 'Soutenu' : 'Moi aussi' }}
                </button>
                <RouterLink
                  v-else
                  :to="{ name: 'connexion', query: { retour: route.fullPath } }"
                  class="btn btn-outline-success btn-sm"
                >
                  👍 Moi aussi
                </RouterLink>
                <span class="text-secondary small">
                  {{ signalementStore.signalementCourant.nbSoutiens }} soutien{{ signalementStore.signalementCourant.nbSoutiens > 1 ? 's' : '' }}
                </span>

                <button type="button" class="btn btn-outline-secondary btn-sm ms-auto" @click="partager">
                  {{ messagePartage || 'Partager' }}
                </button>
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
                      <span class="text-secondary small" :title="dateComplete(m.dateCreation)">{{ dateRelative(m.dateCreation) }}</span>
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

              <div class="info-box mt-4">
                <span>Commentaires</span>

                <ul v-if="signalementStore.signalementCourant.commentaires?.length" class="detail-suivi mt-2 mb-3">
                  <li v-for="c in signalementStore.signalementCourant.commentaires" :key="c.id" class="detail-suivi-item">
                    <div class="d-flex align-items-center gap-2">
                      <div class="detail-commentaire-avatar">
                        <img v-if="c.auteurAvatarUrl" :src="c.auteurAvatarUrl" alt="" />
                        <span v-else>{{ c.auteur.charAt(0).toUpperCase() }}</span>
                      </div>
                      <p class="mb-0 fw-semibold">{{ c.auteur }}</p>
                    </div>
                    <p class="mb-0">{{ c.texte }}</p>
                    <div class="d-flex align-items-center gap-2">
                      <span class="text-secondary small" :title="dateComplete(c.dateCreation)">{{ dateRelative(c.dateCreation) }}</span>
                      <button
                        v-if="peutAgir && !authStore.estConnecte"
                        type="button"
                        class="btn btn-link btn-sm p-0"
                        @click="signalerCommentaire(c.id)"
                      >
                        🚩 Signaler
                      </button>
                      <button
                        v-if="authStore.estConnecte"
                        type="button"
                        class="btn btn-link btn-sm text-danger p-0"
                        @click="supprimerCommentaire(c.id)"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                </ul>
                <p v-else class="text-secondary small mt-2 mb-3">Aucun commentaire pour le moment. Soyez le premier à réagir.</p>

                <form v-if="peutAgir" novalidate @submit.prevent="ajouterCommentaire">
                  <div class="d-flex gap-2">
                    <textarea
                      v-model="nouveauCommentaireTexte"
                      class="form-control form-control-sm"
                      rows="2"
                      maxlength="1000"
                      placeholder="Ajouter un commentaire..."
                    ></textarea>
                    <button
                      type="submit"
                      class="btn btn-outline-secondary btn-sm text-nowrap align-self-start"
                      :disabled="ajoutCommentaireEnCours || nouveauCommentaireTexte.trim().length < 3"
                    >
                      Publier
                    </button>
                  </div>
                  <p v-if="erreurCommentaire" class="text-danger small mt-1 mb-0">{{ erreurCommentaire }}</p>
                </form>
                <p v-else class="text-secondary small mb-0">
                  <RouterLink :to="{ name: 'connexion', query: { retour: route.fullPath } }">Connectez-vous</RouterLink>
                  pour laisser un commentaire.
                </p>
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
