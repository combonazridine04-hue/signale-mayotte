<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSignalementStore } from '../stores/signalementStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const signalementStore = useSignalementStore()
const citoyenStore = useCitoyenStore()

onMounted(() => {
  signalementStore.chargerCompteur()
  // Les résolus sont la vraie preuve que signaler sert à quelque chose : c'est ce qui
  // donne envie de contribuer, bien plus que le volume brut de signalements.
  signalementStore.chargerStatsPubliques()
})
</script>

<template>
  <section class="hero-section">
    <div class="container">
      <div class="col-12 col-lg-7">
        <p class="section-kicker">Signale Mayotte</p>
        <h1 class="hero-title">Signalez les problèmes de votre commune</h1>
        <p class="hero-text">
          Dépôts sauvages, routes abîmées, éclairage en panne, coupures d'eau...
          Aidez votre commune à intervenir plus vite en signalant ce que vous voyez.
        </p>

        <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
          <RouterLink to="/signaler" class="btn btn-success btn-lg">
            Faire un signalement
          </RouterLink>

          <!-- L'accueil reste public (il explique la plateforme aux nouveaux venus) ;
               une personne connectée y trouve simplement l'entrée de son espace. -->
          <RouterLink v-if="citoyenStore.estConnecte" to="/dashboard" class="btn btn-outline-light btn-lg">
            Mon espace
          </RouterLink>

          <!-- Tant que le compteur n'est pas chargé, on n'affiche rien : sur connexion
               lente, un "0 signalements" s'affichait plusieurs secondes et donnait
               l'impression d'une plateforme vide. -->
          <div v-if="signalementStore.total" class="hero-stat">
            <strong>{{ signalementStore.total }}</strong>
            <span>signalements enregistrés</span>
          </div>

          <div v-if="signalementStore.stats.resolu" class="hero-stat hero-stat--resolu">
            <strong>{{ signalementStore.stats.resolu }}</strong>
            <span>déjà résolu{{ signalementStore.stats.resolu > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
