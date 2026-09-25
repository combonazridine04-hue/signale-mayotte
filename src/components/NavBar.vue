<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import ClocheNotifications from './ClocheNotifications.vue'

const citoyenStore = useCitoyenStore()

const nomAffiche = computed(() => citoyenStore.pseudo || citoyenStore.nom || 'Mon profil')
const initiale = computed(() => (citoyenStore.pseudo || citoyenStore.nom || '?').charAt(0).toUpperCase())

// La barre reste fixée en bas de l'écran, comme un dock. Elle remontait auparavant se
// poser au-dessus du pied de page en fin de défilement, ce qui la laissait flotter au
// milieu de la page. Le pied de page réserve désormais sa hauteur en bas, pour qu'elle
// ne recouvre jamais son texte.
</script>

<template>
  <header class="site-header">
    <nav class="icon-pill" aria-label="Navigation principale">
      <RouterLink to="/" class="icon-pill-link" exact-active-class="active" aria-label="Accueil">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
          <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" />
        </svg>
        <span class="nav-infobulle">Accueil</span>
      </RouterLink>

      <RouterLink to="/signaler" class="icon-pill-link" exact-active-class="active" aria-label="Signaler un problème">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
          />
          <path d="M12 9v4" />
          <path d="M12 16.5h.01" />
        </svg>
        <span class="nav-infobulle">Signaler un problème</span>
      </RouterLink>

      <RouterLink to="/carte" class="icon-pill-link" exact-active-class="active" aria-label="Carte">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.3" />
        </svg>
        <span class="nav-infobulle">Carte</span>
      </RouterLink>

      <RouterLink to="/contact" class="icon-pill-link" exact-active-class="active" aria-label="Contact">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4a8.4 8.4 0 0 1-1-4A8.38 8.38 0 0 1 11.5 3a8.5 8.5 0 0 1 8.5 8.5Z"
          />
        </svg>
        <span class="nav-infobulle">Contact</span>
      </RouterLink>

      <RouterLink to="/transparence" class="icon-pill-link" exact-active-class="active" aria-label="Transparence">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 19V10M12 19V5M20 19v-6" />
        </svg>
        <span class="nav-infobulle">Transparence</span>
      </RouterLink>

      <RouterLink
        v-if="citoyenStore.estConnecte"
        to="/mes-signalements"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Mes signalements"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
        <span class="nav-infobulle">Mes signalements</span>
      </RouterLink>

      <RouterLink
        v-if="!citoyenStore.estConnecte"
        to="/connexion"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Connexion / Inscription"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
        <span class="nav-infobulle">Se connecter</span>
      </RouterLink>

      <ClocheNotifications v-if="citoyenStore.estConnecte" />

      <RouterLink
        v-if="citoyenStore.estConnecte"
        to="/profil"
        class="icon-pill-link icon-pill-profil"
        exact-active-class="active"
        :aria-label="`Mon profil — connecté en tant que ${nomAffiche}`"
      >
        <span class="nav-avatar">
          <img
            v-if="citoyenStore.avatarUrl"
            :src="citoyenStore.avatarUrl"
            alt=""
            @error="citoyenStore.avatarIllisible()"
          />
          <span v-else>{{ initiale }}</span>
        </span>
        <span class="nav-infobulle">
          <span class="nav-infobulle-nom">{{ nomAffiche }}</span>
          <span class="nav-infobulle-detail">Connecté · voir mon profil</span>
        </span>
      </RouterLink>
    </nav>
  </header>
</template>
