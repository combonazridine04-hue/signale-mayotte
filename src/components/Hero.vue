<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSignalementStore } from '../stores/signalementStore.js'

const signalementStore = useSignalementStore()

onMounted(() => signalementStore.chargerCompteur())
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

          <div class="hero-stat">
            <strong>{{ signalementStore.total }}</strong>
            <span>signalements enregistrés</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
