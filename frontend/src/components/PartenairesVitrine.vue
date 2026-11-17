<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '../services/api.js'
import { urlMedia } from '../services/adresseApi.js'
import { PARTENAIRES } from '../data/partenaires.js'

// Deux sources, réunies sans doublon : la liste écrite dans data/partenaires.js (EDM,
// SOGEA…) et les comptes partenaires créés dans l'espace admin, avec leur logo.
const depuisAdmin = ref([])

onMounted(async () => {
  try {
    const reponse = await apiFetch('/api/partenaires-publics')
    if (reponse.ok) depuisAdmin.value = await reponse.json()
  } catch {
    // Section secondaire : sans l'API, la liste écrite dans le site s'affiche quand même.
  }
})

const memeNom = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

const partenaires = computed(() => {
  const liste = PARTENAIRES.map((p) => {
    const compte = depuisAdmin.value.find((c) => memeNom(c.nom, p.nom))
    return { ...p, logo: p.logo || (compte?.logoUrl ? urlMedia(compte.logoUrl) : '') }
  })
  for (const compte of depuisAdmin.value) {
    if (!liste.some((p) => memeNom(p.nom, compte.nom))) {
      liste.push({ nom: compte.nom, description: '', domaine: '', site: '', logo: urlMedia(compte.logoUrl) })
    }
  }
  return liste
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
        <li v-for="partenaire in partenaires" :key="partenaire.nom">
          <component
            :is="partenaire.site ? 'a' : 'div'"
            :href="partenaire.site || undefined"
            :target="partenaire.site ? '_blank' : undefined"
            :rel="partenaire.site ? 'noopener' : undefined"
            class="partenaires-carte"
            :style="{ '--couleur': partenaire.couleur || '#16a34a' }"
          >
            <span class="partenaires-logo-zone">
              <img v-if="partenaire.logo" :src="partenaire.logo" alt="" class="partenaires-logo" loading="lazy" />
              <span v-else class="partenaires-initiales" aria-hidden="true">{{ partenaire.nom.slice(0, 3) }}</span>
            </span>
            <span class="partenaires-texte">
              <span class="partenaires-nom">{{ partenaire.nom }}</span>
              <span v-if="partenaire.description" class="partenaires-description">{{ partenaire.description }}</span>
              <span v-if="partenaire.domaine" class="partenaires-domaine">{{ partenaire.domaine }}</span>
            </span>
          </component>
        </li>
      </ul>
    </div>
  </section>
</template>
