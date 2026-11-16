<script setup>
import { computed } from 'vue'
import { STATUTS } from '../models/signalement.js'
import { dateRelative } from '../utils/dates.js'

const props = defineProps({
  statut: { type: String, required: true },
  dateSignalement: { type: String, default: '' },
  dateResolution: { type: String, default: '' }
})

const etapes = computed(() => {
  const indexCourant = STATUTS.indexOf(props.statut)

  return STATUTS.map((libelle, index) => {
    let date = ''
    if (index === 0) date = props.dateSignalement
    else if (libelle === 'Résolu') date = props.dateResolution

    return {
      libelle,
      date: date ? dateRelative(date) : '',
      franchie: index <= indexCourant,
      courante: index === indexCourant
    }
  })
})
</script>

<template>
  <ol class="statut-suivi" :aria-label="`Statut : ${statut}`">
    <li
      v-for="etape in etapes"
      :key="etape.libelle"
      class="statut-suivi-etape"
      :class="{ franchie: etape.franchie, courante: etape.courante }"
    >
      <span class="statut-suivi-point" aria-hidden="true"></span>
      <span class="statut-suivi-libelle">{{ etape.libelle }}</span>
      <span v-if="etape.date" class="statut-suivi-date">{{ etape.date }}</span>
    </li>
  </ol>
</template>
