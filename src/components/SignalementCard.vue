<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { dateRelative, dateComplete } from '../utils/dates.js'

const props = defineProps({
  signalement: {
    type: Object,
    required: true
  }
})

const badgeClasses = {
  'Signalé': 'text-bg-danger',
  'En cours': 'text-bg-warning',
  'Résolu': 'text-bg-success'
}

const imageEnErreur = ref(false)
</script>

<template>
  <RouterLink :to="`/signalements/${signalement.id}`" class="text-decoration-none">
    <div class="signalement-card card h-100">
      <img
        v-if="signalement.photoUrls?.[0] && !imageEnErreur"
        :src="signalement.photoUrls[0]"
        class="card-img-top"
        :alt="`${signalement.categorie} — ${signalement.commune}`"
        @error="imageEnErreur = true"
      />
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span class="badge text-bg-secondary">{{ signalement.categorie }}</span>
          <span class="badge" :class="badgeClasses[signalement.statut]">{{ signalement.statut }}</span>
        </div>
        <h3 class="h6 card-title mb-1">{{ signalement.commune }}</h3>
        <p class="card-text card-text-clamp text-secondary small mb-0">{{ signalement.description }}</p>

        <div class="d-flex align-items-center gap-2 mt-2 text-secondary small">
          <time :datetime="signalement.dateSignalement" :title="dateComplete(signalement.dateSignalement)">
            {{ dateRelative(signalement.dateSignalement) }}
          </time>
          <span v-if="signalement.nbSoutiens">· 👍 {{ signalement.nbSoutiens }}</span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
