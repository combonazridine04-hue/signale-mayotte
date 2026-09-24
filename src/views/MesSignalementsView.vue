<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSignalementStore } from '../stores/signalementStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import SignalementCard from '../components/SignalementCard.vue'
import { dateRelative } from '../utils/dates.js'

const signalementStore = useSignalementStore()
const citoyenStore = useCitoyenStore()

onMounted(() => {
  signalementStore.chargerMesSignalements()
  citoyenStore.chargerNotifications()
})

const salutation = computed(() => {
  const nom = citoyenStore.pseudo || citoyenStore.nom || ''
  const prenom = nom.split(' ')[0]
  return prenom ? `Bonjour ${prenom}` : 'Bonjour'
})

// Compté ici plutôt que sur le serveur : la liste des signalements de l'utilisateur est
// déjà chargée, une requête de plus n'apporterait rien.
const enCours = computed(() => signalementStore.signalements.filter((s) => s.statut !== 'Résolu').length)

const notificationsRecentes = computed(() => citoyenStore.notifications.slice(0, 3))
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p class="section-kicker">Mon espace</p>
          <h1 class="fw-bold mb-0">{{ salutation }}</h1>
        </div>
        <!-- Retour vers la page publique : le tableau de bord ne doit pas être un cul-de-sac. -->
        <RouterLink to="/" class="btn btn-outline-secondary btn-sm"> ← Retour au site </RouterLink>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="tuile-tdb">
            <span class="tuile-tdb-chiffre">{{ citoyenStore.stats.signalements }}</span>
            <span class="tuile-tdb-libelle"
              >Signalement{{ citoyenStore.stats.signalements > 1 ? 's' : '' }} envoyé{{
                citoyenStore.stats.signalements > 1 ? 's' : ''
              }}</span
            >
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="tuile-tdb">
            <span class="tuile-tdb-chiffre">{{ enCours }}</span>
            <span class="tuile-tdb-libelle">En attente de traitement</span>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="tuile-tdb">
            <span class="tuile-tdb-chiffre">{{ citoyenStore.stats.resolus }}</span>
            <span class="tuile-tdb-libelle">Résolu{{ citoyenStore.stats.resolus > 1 ? 's' : '' }}</span>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="tuile-tdb">
            <span class="tuile-tdb-chiffre">{{ citoyenStore.stats.soutiens }}</span>
            <span class="tuile-tdb-libelle"
              >Soutien{{ citoyenStore.stats.soutiens > 1 ? 's' : '' }} reçu{{
                citoyenStore.stats.soutiens > 1 ? 's' : ''
              }}</span
            >
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-4">
        <RouterLink to="/signaler" class="btn btn-primary">Faire un signalement</RouterLink>
        <RouterLink to="/carte" class="btn btn-outline-secondary">Voir la carte</RouterLink>
        <RouterLink to="/profil" class="btn btn-outline-secondary">Mon profil</RouterLink>
      </div>

      <div v-if="notificationsRecentes.length" class="card-glass rounded p-3 p-md-4 mb-4">
        <h2 class="h6 fw-bold mb-3">Dernières nouvelles</h2>
        <ul class="liste-nouvelles">
          <li v-for="n in notificationsRecentes" :key="n.id" :class="{ 'non-lue': !n.lue }">
            <RouterLink v-if="n.signalementId" :to="`/signalements/${n.signalementId}`">{{ n.texte }}</RouterLink>
            <span v-else>{{ n.texte }}</span>
            <time class="liste-nouvelles-date" :datetime="n.dateCreation">{{ dateRelative(n.dateCreation) }}</time>
          </li>
        </ul>
      </div>

      <h2 class="h5 fw-bold mb-3">Mes signalements</h2>

      <p v-if="signalementStore.chargement" class="text-secondary">Chargement...</p>

      <div v-else-if="!signalementStore.signalements.length" class="empty-state text-center py-5">
        <p class="text-secondary mb-3">Vous n'avez encore envoyé aucun signalement.</p>
        <RouterLink to="/signaler" class="btn btn-primary">Faire un signalement</RouterLink>
      </div>

      <div v-else class="row g-4">
        <div v-for="s in signalementStore.signalements" :key="s.id" class="col-12 col-sm-6 col-lg-4">
          <SignalementCard :signalement="s" />
        </div>
      </div>
    </div>
  </main>
</template>
