<script setup>
import { onMounted, ref } from 'vue'
import { apiFetch } from '../services/api.js'
import { urlMedia } from '../services/adresseApi.js'

// Partenaires déclarés dans l'espace admin (EDM, SOGEA, une mairie…). Le logo s'affiche
// dès qu'il est ajouté ; sans logo, le nom le remplace. Aucun partenaire : la section
// ne s'affiche pas du tout, plutôt qu'un bloc vide.
const partenaires = ref([])

onMounted(async () => {
  try {
    const reponse = await apiFetch('/api/partenaires-publics')
    if (reponse.ok) partenaires.value = await reponse.json()
  } catch {
    // Section secondaire : en cas d'échec, la page d'accueil reste utilisable sans elle.
  }
})
</script>

<template>
  <section v-if="partenaires.length" class="partenaires" aria-labelledby="partenaires-titre">
    <div class="container">
      <p class="section-kicker">Nos partenaires</p>
      <h2 id="partenaires-titre" class="partenaires-titre">Ils agissent avec nous</h2>
      <p class="partenaires-intro">
        Ces organismes reçoivent les signalements qui les concernent et les font avancer jusqu'à leur résolution.
      </p>

      <ul class="partenaires-liste">
        <li v-for="partenaire in partenaires" :key="partenaire.nom" class="partenaires-carte">
          <img
            v-if="partenaire.logoUrl"
            :src="urlMedia(partenaire.logoUrl)"
            :alt="partenaire.nom"
            :title="partenaire.nom"
            class="partenaires-logo"
            loading="lazy"
          />
          <span v-else class="partenaires-nom">{{ partenaire.nom }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
