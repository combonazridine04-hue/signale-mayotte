<script setup>
import { computed } from 'vue'
import { forceMotDePasse } from '../../shared/motDePasse.js'

const props = defineProps({
  motDePasse: { type: String, default: '' }
})

const force = computed(() => forceMotDePasse(props.motDePasse))
</script>

<template>
  <!--
    La jauge est un CONSEIL, pas un blocage : seul un mot de passe trop court ou
    archi-connu est refusé. Sur un site destiné à tous les habitants, imposer
    « 1 majuscule + 1 chiffre + 1 symbole » pousse surtout à noter le mot de passe
    sur un papier.
  -->
  <div v-if="force.score" class="jauge-mdp" aria-live="polite">
    <div class="jauge-mdp-barres">
      <span
        v-for="niveau in 4"
        :key="niveau"
        class="jauge-mdp-barre"
        :class="{ [`niveau-${force.score}`]: niveau <= force.score }"
      ></span>
    </div>
    <p class="jauge-mdp-texte">
      <strong :class="`texte-niveau-${force.score}`">{{ force.libelle }}</strong>
      <span v-if="force.conseil"> — {{ force.conseil }}</span>
    </p>
  </div>
</template>
