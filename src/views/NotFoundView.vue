<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="empty-state text-center py-5">
        <p class="section-kicker">Erreur 404</p>
        <h1 class="fw-bold mb-3">Page introuvable</h1>
        <p class="text-secondary mb-4">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <RouterLink to="/" class="btn btn-success">Retour à l'accueil</RouterLink>
      </div>
    </div>
  </main>
</template>
