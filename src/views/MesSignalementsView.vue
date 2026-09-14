<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSignalementStore } from '../stores/signalementStore.js'
import SignalementCard from '../components/SignalementCard.vue'

const signalementStore = useSignalementStore()

onMounted(() => {
  signalementStore.chargerMesSignalements()
})
</script>

<template>
  <main class="py-5">
    <div class="container">
      <p class="section-kicker">Espace citoyen</p>
      <h1 class="fw-bold mb-4">Mes signalements</h1>

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
