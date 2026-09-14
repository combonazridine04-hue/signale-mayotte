<script setup>
import { RouterLink } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const citoyenStore = useCitoyenStore()
</script>

<template>
  <header class="site-header">
    <nav class="icon-pill" aria-label="Navigation principale">
      <RouterLink to="/" class="icon-pill-link" exact-active-class="active" aria-label="Accueil" title="Accueil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
          <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" />
        </svg>
      </RouterLink>

      <RouterLink
        to="/signaler"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Signaler un problème"
        title="Signaler un problème"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 16.5h.01" />
        </svg>
      </RouterLink>

      <RouterLink to="/carte" class="icon-pill-link" exact-active-class="active" aria-label="Carte" title="Carte">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.3" />
        </svg>
      </RouterLink>

      <RouterLink to="/contact" class="icon-pill-link" exact-active-class="active" aria-label="Contact" title="Contact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4a8.4 8.4 0 0 1-1-4A8.38 8.38 0 0 1 11.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
        </svg>
      </RouterLink>

      <RouterLink to="/transparence" class="icon-pill-link" exact-active-class="active" aria-label="Transparence" title="Transparence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19V10M12 19V5M20 19v-6" />
        </svg>
      </RouterLink>

      <RouterLink
        v-if="citoyenStore.estConnecte"
        to="/mes-signalements"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Mes signalements"
        title="Mes signalements"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      </RouterLink>

      <RouterLink
        v-if="!citoyenStore.estConnecte"
        to="/connexion"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Connexion"
        title="Connexion / Inscription"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </RouterLink>
      <button
        v-else
        type="button"
        class="icon-pill-link"
        :aria-label="`Déconnexion (${citoyenStore.nom})`"
        :title="`Connecté : ${citoyenStore.nom} — cliquer pour se déconnecter`"
        @click="citoyenStore.deconnecter()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>

    </nav>
  </header>
</template>
