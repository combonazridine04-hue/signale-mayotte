<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CATEGORIES, COMMUNES, ORGANISME_PAR_CATEGORIE } from '../models/signalement.js'
import { useSignalementStore } from '../stores/signalementStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import PhotoDropzone from '../components/PhotoDropzone.vue'
import LocationPicker from '../components/LocationPicker.vue'
import OrganismeCompetent from '../components/OrganismeCompetent.vue'
import PanneauAide from '../components/PanneauAide.vue'
import { dateRelative } from '../utils/dates.js'

// Ce qui distingue un signalement traité d'un signalement qui traîne. Rédigé à partir
// de ce que la plateforme fait réellement : point sur la carte, photo, statut public.
const conseils = [
  {
    titre: 'Placez le point sur la carte',
    texte: "Une commune seule ne suffit pas à envoyer une équipe. Le lieu exact, c'est ce qui permet d'intervenir."
  },
  {
    titre: 'Ajoutez une photo',
    texte: "Elle évite les allers-retours pour vérifier, et prouve l'état du problème à la date du signalement."
  },
  {
    titre: "Décrivez ce qu'on voit",
    texte: "Depuis quand, quelle ampleur, ce que ça empêche. Deux phrases précises valent mieux qu'un paragraphe vague."
  },
  {
    titre: 'Vérifiez les signalements voisins',
    texte: "S'il existe déjà, soutenez-le : un problème signalé par dix habitants passe avant dix signalements séparés."
  }
]

const router = useRouter()
const signalementStore = useSignalementStore()
const citoyenStore = useCitoyenStore()

const emailNonVerifie = computed(() => erreurEnvoi.value.includes('Confirmez votre email'))
const renvoiEnCours = ref(false)
const renvoiMessage = ref('')

const renvoyerEmail = async () => {
  renvoiEnCours.value = true
  renvoiMessage.value = ''
  const resultat = await citoyenStore.renvoyerVerificationEmail()
  renvoiMessage.value = resultat.succes ? 'Email renvoyé, vérifiez votre boîte de réception.' : resultat.erreur
  renvoiEnCours.value = false
}

const formulaire = reactive({
  categorie: '',
  commune: '',
  description: '',
  email: '',
  latitude: null,
  longitude: null,
  urgent: false
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
  description: formulaire.description.trim().length < 10,
  // Sans point sur la carte, les services ne savent pas où intervenir et on ne peut
  // pas repérer qu'un voisin a déjà signalé le même problème.
  localisation: !formulaire.latitude || !formulaire.longitude
}))

const formulaireValide = computed(() => !Object.values(erreurs.value).some(Boolean))

const organismeCompetent = computed(() => ORGANISME_PAR_CATEGORIE[formulaire.categorie] || null)

// Doublons : on ne bloque jamais l'envoi, on propose de soutenir le signalement existant.
// Un signalement très soutenu pèse plus lourd que dix signalements dispersés.
const similaires = ref([])
const doublonsIgnores = ref(false)
let delaiSimilaires = null

const chercherSimilaires = () => {
  clearTimeout(delaiSimilaires)
  if (!formulaire.categorie || (!formulaire.commune && !formulaire.latitude)) {
    similaires.value = []
    return
  }

  delaiSimilaires = setTimeout(async () => {
    similaires.value = await signalementStore.chercherSimilaires({
      categorie: formulaire.categorie,
      commune: formulaire.commune,
      latitude: formulaire.latitude,
      longitude: formulaire.longitude
    })
  }, 400)
}

watch(
  () => [formulaire.categorie, formulaire.commune, formulaire.latitude, formulaire.longitude],
  () => {
    doublonsIgnores.value = false
    chercherSimilaires()
  }
)

const soutenirExistant = async (signalement) => {
  try {
    await signalementStore.soutenir(signalement.id)
    router.push(`/signalements/${signalement.id}`)
  } catch (e) {
    erreurEnvoi.value = e.message
  }
}

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
    donnees.set('urgent', formulaire.urgent ? 'true' : 'false')
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
            éclairage en panne, fuite d'eau... Votre identité reste privée : elle
            n'est jamais affichée publiquement.
          </p>

          <PanneauAide
            titre="Pour un signalement vite traité"
            :points="conseils"
            note="Votre nom n'apparaît jamais en entier : les autres habitants voient votre pseudo, ou votre prénom suivi de l'initiale de votre nom."
          />
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

            <!--
              Urgence : un simple drapeau sur le signalement. Il le fait remonter en tête
              de liste, sans créer un circuit parallèle que personne ne surveillerait.
            -->
            <div class="bloc-urgence mb-3" :class="{ actif: formulaire.urgent }">
              <div class="form-check mb-0">
                <input
                  id="urgent"
                  v-model="formulaire.urgent"
                  class="form-check-input"
                  type="checkbox"
                />
                <label class="form-check-label fw-semibold" for="urgent">
                  <span class="bloc-urgence-pastille" aria-hidden="true">SOS</span>
                  Danger immédiat pour les habitants
                </label>
              </div>
              <p class="bloc-urgence-aide mb-0">
                À cocher uniquement en cas de risque réel : câble électrique à terre, route
                effondrée, fuite d'eau importante, ravine bouchée avant la pluie. Le
                signalement apparaîtra en tête de liste.
              </p>
              <p v-if="formulaire.urgent" class="bloc-urgence-secours mb-0">
                En cas d'urgence vitale, n'attendez pas ce site : appelez le 15 (SAMU),
                le 18 (pompiers) ou le 17 (police).
              </p>
            </div>

            <div class="honeypot-field" aria-hidden="true">
              <label for="site_web">Site web</label>
              <input id="site_web" v-model="siteWeb" type="text" name="site_web" tabindex="-1" autocomplete="off" />
            </div>

            <div class="mb-3">
              <label class="form-label">Localisation</label>
              <p class="text-secondary small mb-2">
                Indispensable pour que les services sachent où intervenir. Utilisez votre position
                actuelle, ou placez le point sur la carte.
              </p>
              <LocationPicker v-model:latitude="formulaire.latitude" v-model:longitude="formulaire.longitude" />
              <p v-if="soumis && erreurs.localisation" class="text-danger small mt-2 mb-0">
                Indiquez le lieu du problème avant d'envoyer.
              </p>
            </div>

            <!-- Doublons : proposer de soutenir plutôt que de republier le même problème -->
            <div v-if="similaires.length && !doublonsIgnores" class="doublons mb-3">
              <p class="doublons-titre">
                {{ similaires.length > 1 ? 'Des problèmes similaires ont' : 'Un problème similaire a' }}
                déjà été signalé ici
              </p>
              <p class="doublons-intro">
                Soutenez-le plutôt que d'en créer un nouveau : un signalement soutenu par
                plusieurs habitants est traité en priorité.
              </p>

              <ul class="doublons-liste">
                <li v-for="s in similaires" :key="s.id" class="doublons-item">
                  <div class="doublons-item-texte">
                    <strong>{{ s.categorie }} — {{ s.commune }}</strong>
                    <span class="doublons-item-description">{{ s.description }}</span>
                    <span class="doublons-item-meta">
                      {{ dateRelative(s.dateSignalement) }} · {{ s.nbSoutiens }} soutien{{ s.nbSoutiens > 1 ? 's' : '' }}
                    </span>
                  </div>
                  <div class="doublons-item-actions">
                    <button type="button" class="btn btn-success btn-sm" @click="soutenirExistant(s)">
                      Je soutiens
                    </button>
                    <RouterLink :to="`/signalements/${s.id}`" class="btn btn-outline-secondary btn-sm">
                      Voir
                    </RouterLink>
                  </div>
                </li>
              </ul>

              <button type="button" class="btn btn-link btn-sm p-0" @click="doublonsIgnores = true">
                Ce n'est pas le même problème, je continue
              </button>
            </div>

            <div v-if="erreurEnvoi" class="alert alert-danger py-2">
              {{ erreurEnvoi }}
              <template v-if="emailNonVerifie">
                <RouterLink to="/verifier-email" class="btn btn-link btn-sm p-0 ms-1 align-baseline">
                  J'ai reçu mon code
                </RouterLink>
                ·
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 ms-1 align-baseline"
                  :disabled="renvoiEnCours"
                  @click="renvoyerEmail"
                >
                  Renvoyer le code
                </button>
              </template>
              <div v-if="renvoiMessage" class="small mt-1">{{ renvoiMessage }}</div>
            </div>

            <button type="submit" class="btn btn-success btn-lg" :disabled="envoiEnCours">
              {{ envoiEnCours ? 'Envoi en cours...' : 'Envoyer le signalement' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
