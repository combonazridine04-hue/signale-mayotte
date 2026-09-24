<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import ClocheNotifications from './ClocheNotifications.vue'

const citoyenStore = useCitoyenStore()

const nomAffiche = computed(() => citoyenStore.pseudo || citoyenStore.nom || 'Mon profil')
const initiale = computed(() => (citoyenStore.pseudo || citoyenStore.nom || '?').charAt(0).toUpperCase())

// La barre flotte au-dessus du contenu, ce qui est pratique en cours de lecture mais
// recouvrait le pied de page une fois tout en bas. On réservait donc une centaine de
// pixels vides en bas de CHAQUE page pour l'éviter. Ici elle vient plutôt se poser
// juste au-dessus du pied de page quand celui-ci arrive : plus de recouvrement, et
// plus de réserve perdue.
const pilule = ref(null)
const MARGE = 14
let decalage = 0
let enAttente = false
let observateur = null

function ajuster() {
  enAttente = false
  if (!pilule.value) return

  const pied = document.querySelector('.site-footer')
  // En dessous de 992 px, le pied de page est plus haut que l'écran : il n'y a jamais
  // de place au-dessus de lui, et la barre finissait collée en haut de l'écran à
  // recouvrir le nom du site. Là, elle reste flottante et c'est la réserve prévue dans
  // la feuille de style à cette largeur qui évite qu'elle masque la dernière ligne.
  if (!pied || !window.matchMedia('(min-width: 992px)').matches) {
    if (decalage) {
      decalage = 0
      pilule.value.style.transform = ''
    }
    return
  }

  // On repart de la position SANS décalage, sinon chaque calcul s'ajouterait au précédent.
  const rect = pilule.value.getBoundingClientRect()
  const basNaturel = rect.bottom + decalage
  const hautNaturel = rect.top + decalage
  const hautPied = pied.getBoundingClientRect().top

  // Filet de sécurité : la barre doit rester entièrement visible quoi qu'il arrive.
  const maximum = Math.round(hautNaturel - MARGE)
  decalage = Math.max(0, Math.min(Math.round(basNaturel + MARGE - hautPied), maximum))
  pilule.value.style.transform = decalage ? `translateY(${-decalage}px)` : ''
}

function planifier() {
  if (enAttente) return
  enAttente = true
  requestAnimationFrame(ajuster)
}

onMounted(() => {
  window.addEventListener('scroll', planifier, { passive: true })
  window.addEventListener('resize', planifier)
  // La hauteur de la page change aussi sans défilement : chargement des signalements,
  // ouverture d'un formulaire, images qui arrivent. Sans ça la barre resterait décalée.
  if (window.ResizeObserver) {
    observateur = new ResizeObserver(planifier)
    observateur.observe(document.body)
  }
  planifier()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', planifier)
  window.removeEventListener('resize', planifier)
  observateur?.disconnect()
})
</script>

<template>
  <header class="site-header">
    <nav ref="pilule" class="icon-pill" aria-label="Navigation principale">
      <RouterLink to="/" class="icon-pill-link" exact-active-class="active" aria-label="Accueil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
          <path d="M9.5 20v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20" />
        </svg>
        <span class="nav-infobulle">Accueil</span>
      </RouterLink>

      <RouterLink
        to="/signaler"
        class="icon-pill-link"
        exact-active-class="active"
        aria-label="Signaler un problème"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 16.5h.01" />
        </svg>
        <span class="nav-infobulle">Signaler un problème</span>
      </RouterLink>

      <RouterLink to="/carte" class="icon-pill-link" exact-active-class="active" aria-label="Carte">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.3" />
        </svg>
        <span class="nav-infobulle">Carte</span>
      </RouterLink>

      <RouterLink to="/contact" class="icon-pill-link" exact-active-class="active" aria-label="Contact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4a8.4 8.4 0 0 1-1-4A8.38 8.38 0 0 1 11.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
        </svg>
        <span class="nav-infobulle">Contact</span>
      </RouterLink>

      <RouterLink to="/transparence" class="icon-pill-link" exact-active-class="active" aria-label="Transparence">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
          <img v-if="citoyenStore.avatarUrl" :src="citoyenStore.avatarUrl" alt="" @error="citoyenStore.avatarIllisible()" />
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
