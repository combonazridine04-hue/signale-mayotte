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

const inputAvatar = ref(null)
const avatarEnCours = ref(false)
const erreurAvatar = ref('')

onMounted(async () => {
  const resultat = await citoyenStore.chargerProfil()
  if (resultat.succes) pseudo.value = citoyenStore.pseudo
  chargement.value = false
})

const choisirAvatar = () => inputAvatar.value?.click()

const changerAvatar = async (event) => {
  const fichier = event.target.files?.[0]
  event.target.value = ''
  if (!fichier) return

  avatarEnCours.value = true
  erreurAvatar.value = ''
  const resultat = await citoyenStore.televerserAvatar(fichier)
  avatarEnCours.value = false

  if (!resultat.succes) erreurAvatar.value = resultat.erreur
}

const retirerAvatar = async () => {
  avatarEnCours.value = true
  erreurAvatar.value = ''
  const resultat = await citoyenStore.supprimerAvatar()
  avatarEnCours.value = false

  if (!resultat.succes) erreurAvatar.value = resultat.erreur
}

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
            <div class="card-glass rounded p-4 shadow-sm mb-3 d-flex align-items-center gap-3 flex-wrap">
              <div class="profil-avatar">
                <img v-if="citoyenStore.avatarUrl" :src="citoyenStore.avatarUrl" alt="" />
                <span v-else class="profil-avatar-vide">{{ (citoyenStore.pseudo || citoyenStore.nom || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <input ref="inputAvatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="changerAvatar" />
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="avatarEnCours" @click="choisirAvatar">
                    {{ avatarEnCours ? 'Envoi...' : (citoyenStore.avatarUrl ? 'Changer la photo' : 'Ajouter une photo') }}
                  </button>
                  <button
                    v-if="citoyenStore.avatarUrl"
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    :disabled="avatarEnCours"
                    @click="retirerAvatar"
                  >
                    Retirer
                  </button>
                </div>
                <div v-if="erreurAvatar" class="text-danger small mt-1">{{ erreurAvatar }}</div>
                <div v-if="avatarEnCours" class="text-secondary small mt-1">Vérification automatique en cours, ça peut prendre quelques secondes...</div>
                <div v-else class="text-secondary small mt-1">JPG, PNG, WEBP ou GIF, 3 Mo max.</div>
              </div>
            </div>

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

<style scoped>
.profil-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bs-secondary-bg, #e9ecef);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profil-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profil-avatar-vide {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--bs-secondary-color, #6c757d);
}
</style>
