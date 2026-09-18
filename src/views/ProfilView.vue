<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import { useSignalementStore } from '../stores/signalementStore.js'
import SignalementCard from '../components/SignalementCard.vue'

const router = useRouter()
const citoyenStore = useCitoyenStore()
const signalementStore = useSignalementStore()

const chargement = ref(true)
const pseudo = ref('')
const enregistrementEnCours = ref(false)
const messageErreur = ref('')
const messageSucces = ref('')

const inputAvatar = ref(null)
const avatarEnCours = ref(false)
const erreurAvatar = ref('')

const renvoiEnCours = ref(false)
const renvoiMessage = ref('')

const nomAffiche = computed(() => citoyenStore.pseudo || citoyenStore.nom)
const initiale = computed(() => (nomAffiche.value || '?').charAt(0).toUpperCase())

const membreDepuis = computed(() => {
  if (!citoyenStore.creeLe) return ''
  return new Date(citoyenStore.creeLe).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const derniersSignalements = computed(() => signalementStore.signalements.slice(0, 3))

// Petit repère de contribution, pour valoriser les citoyens qui signalent régulièrement.
const niveau = computed(() => {
  const nb = citoyenStore.stats.signalements
  if (nb >= 15) return { libelle: 'Ambassadeur', classe: 'profil-badge--or' }
  if (nb >= 5) return { libelle: 'Contributeur actif', classe: 'profil-badge--or' }
  if (nb >= 1) return { libelle: 'Contributeur', classe: '' }
  return { libelle: 'Nouveau membre', classe: '' }
})

onMounted(async () => {
  const resultat = await citoyenStore.chargerProfil()
  if (resultat.succes) pseudo.value = citoyenStore.pseudo
  chargement.value = false
  signalementStore.chargerMesSignalements()
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

const renvoyerVerification = async () => {
  renvoiEnCours.value = true
  renvoiMessage.value = ''
  const resultat = await citoyenStore.renvoyerVerificationEmail()
  renvoiMessage.value = resultat.succes ? 'Code renvoyé, vérifiez votre boîte mail.' : resultat.erreur
  renvoiEnCours.value = false
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
        <div class="col-12 col-xl-9">
          <p class="section-kicker">Espace citoyen</p>
          <h1 class="fw-bold mb-4">Mon profil</h1>

          <div v-if="chargement" class="card-glass rounded p-4 shadow-sm">
            <p class="mb-0 text-secondary">Chargement...</p>
          </div>

          <template v-else>
            <!-- En-tête profil -->
            <section class="card-glass rounded profil-entete mb-4">
              <input
                ref="inputAvatar"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                @change="changerAvatar"
              />

              <button
                type="button"
                class="profil-avatar"
                :disabled="avatarEnCours"
                :title="citoyenStore.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'"
                @click="choisirAvatar"
              >
                <img v-if="citoyenStore.avatarUrl" :src="citoyenStore.avatarUrl" alt="" />
                <span v-else class="profil-avatar-initiale">{{ initiale }}</span>
                <span class="profil-avatar-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </span>
              </button>

              <div class="profil-entete-infos">
                <h2 class="profil-nom">{{ nomAffiche }}</h2>
                <p class="profil-sous-titre">
                  <span v-if="citoyenStore.pseudo">{{ citoyenStore.nom }} · </span>
                  <span v-if="membreDepuis">Membre depuis {{ membreDepuis }}</span>
                </p>

                <div class="profil-badges">
                  <span class="profil-badge" :class="niveau.classe">{{ niveau.libelle }}</span>
                  <span v-if="citoyenStore.email && citoyenStore.emailVerifie" class="profil-badge profil-badge--ok">
                    ✓ Email vérifié
                  </span>
                  <span v-else-if="citoyenStore.email" class="profil-badge profil-badge--attente">
                    Email non vérifié
                  </span>
                  <span v-if="!citoyenStore.pseudo" class="profil-badge">Anonyme sur les commentaires</span>
                </div>

                <div v-if="avatarEnCours" class="profil-note">Vérification de l'image en cours...</div>
                <div v-else-if="erreurAvatar" class="profil-note profil-note--erreur">{{ erreurAvatar }}</div>
                <button
                  v-else-if="citoyenStore.avatarUrl"
                  type="button"
                  class="btn btn-link btn-sm p-0 profil-note"
                  @click="retirerAvatar"
                >
                  Retirer ma photo
                </button>
              </div>
            </section>

            <!-- Statistiques de contribution -->
            <section class="profil-stats mb-4">
              <div class="card-glass rounded profil-stat">
                <p class="profil-stat-valeur">{{ citoyenStore.stats.signalements }}</p>
                <p class="profil-stat-label">Signalement{{ citoyenStore.stats.signalements > 1 ? 's' : '' }} envoyé{{ citoyenStore.stats.signalements > 1 ? 's' : '' }}</p>
              </div>
              <div class="card-glass rounded profil-stat">
                <p class="profil-stat-valeur profil-stat-valeur--resolu">{{ citoyenStore.stats.resolus }}</p>
                <p class="profil-stat-label">Résolu{{ citoyenStore.stats.resolus > 1 ? 's' : '' }}</p>
              </div>
              <div class="card-glass rounded profil-stat">
                <p class="profil-stat-valeur profil-stat-valeur--soutien">{{ citoyenStore.stats.soutiens }}</p>
                <p class="profil-stat-label">Soutien{{ citoyenStore.stats.soutiens > 1 ? 's' : '' }} reçu{{ citoyenStore.stats.soutiens > 1 ? 's' : '' }}</p>
              </div>
            </section>

            <div class="row g-4 mb-4">
              <!-- Pseudo -->
              <div class="col-12 col-lg-6">
                <div class="card-glass rounded p-4 h-100">
                  <h2 class="h6 fw-bold mb-2">Pseudo public</h2>
                  <p class="text-secondary small mb-3">
                    Affiché à la place de votre nom complet sur vos commentaires. Laissez vide pour rester anonyme.
                  </p>

                  <form novalidate @submit.prevent="enregistrer">
                    <input
                      id="pseudo"
                      v-model="pseudo"
                      type="text"
                      maxlength="24"
                      placeholder="ex. Citoyen76"
                      class="form-control mb-2"
                    />
                    <div class="form-text mb-3">2 à 24 caractères : lettres, chiffres, espaces, - ou _.</div>

                    <div v-if="messageErreur" class="alert alert-danger py-2 mb-3">{{ messageErreur }}</div>
                    <div v-if="messageSucces" class="alert alert-success py-2 mb-3">{{ messageSucces }}</div>

                    <button type="submit" class="btn btn-primary" :disabled="enregistrementEnCours">
                      {{ enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer' }}
                    </button>
                  </form>
                </div>
              </div>

              <!-- Informations -->
              <div class="col-12 col-lg-6">
                <div class="card-glass rounded p-4 h-100">
                  <h2 class="h6 fw-bold mb-3">Mes informations</h2>

                  <dl class="profil-infos mb-0">
                    <dt>Nom</dt>
                    <dd>{{ citoyenStore.nom }}</dd>

                    <template v-if="citoyenStore.email">
                      <dt>Email</dt>
                      <dd>{{ citoyenStore.email }}</dd>
                    </template>

                    <template v-if="citoyenStore.telephone">
                      <dt>Téléphone</dt>
                      <dd>{{ citoyenStore.telephone }}</dd>
                    </template>
                  </dl>

                  <div v-if="citoyenStore.email && !citoyenStore.emailVerifie" class="mt-3">
                    <p class="text-secondary small mb-1">
                      Confirmez votre email pour pouvoir envoyer des signalements.
                    </p>
                    <RouterLink to="/verifier-email" class="btn btn-outline-primary btn-sm me-2">Saisir mon code</RouterLink>
                    <button type="button" class="btn btn-link btn-sm p-0" :disabled="renvoiEnCours" @click="renvoyerVerification">
                      Renvoyer le code
                    </button>
                    <div v-if="renvoiMessage" class="small text-secondary mt-1">{{ renvoiMessage }}</div>
                  </div>

                  <RouterLink v-if="citoyenStore.email" to="/mot-de-passe-oublie" class="d-inline-block mt-3 small">
                    Changer mon mot de passe
                  </RouterLink>
                </div>
              </div>
            </div>

            <!-- Derniers signalements -->
            <section class="card-glass rounded p-4 mb-4">
              <div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <h2 class="h6 fw-bold mb-0">Mes derniers signalements</h2>
                <RouterLink v-if="signalementStore.signalements.length" to="/mes-signalements" class="small">
                  Tout voir →
                </RouterLink>
              </div>

              <div v-if="signalementStore.chargement" class="text-secondary small">Chargement...</div>

              <div v-else-if="!derniersSignalements.length" class="text-center py-3">
                <p class="text-secondary mb-3">Vous n'avez encore envoyé aucun signalement.</p>
                <RouterLink to="/signaler" class="btn btn-primary btn-sm">Faire mon premier signalement</RouterLink>
              </div>

              <div v-else class="row g-3">
                <div v-for="s in derniersSignalements" :key="s.id" class="col-12 col-md-4">
                  <SignalementCard :signalement="s" />
                </div>
              </div>
            </section>

            <div class="card-glass rounded p-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
              <RouterLink to="/signaler" class="btn btn-primary btn-sm">Signaler un problème</RouterLink>
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
