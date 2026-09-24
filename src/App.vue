<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DialogueGlobal from './components/DialogueGlobal.vue'
import { RouterView, useRoute } from 'vue-router'
import { useCitoyenStore } from './stores/citoyenStore.js'
import { useAuthStore } from './stores/authStore.js'
import { etatReseau } from './utils/api.js'

const GlobeBackground = defineAsyncComponent({
  loader: () => import('./components/GlobeBackground.vue'),
  // Le chunk du globe (three.js) est lourd : sur une connexion mobile lente ou
  // instable (fréquent à Mayotte), le premier essai peut échouer ou expirer.
  // On retente avant d'abandonner, plutôt que de laisser le fond uni sans jamais réessayer.
  timeout: 15000,
  onError(error, retry, fail, attempts) {
    if (attempts <= 2) retry()
    else fail()
  }
})

const route = useRoute()
const citoyenStore = useCitoyenStore()
const authStore = useAuthStore()

// Le globe est purement décoratif et pèse ~170 ko compressés (three.js). Signaler un
// problème ne doit jamais coûter ça à quelqu'un en forfait limité : fréquent à Mayotte,
// et c'est précisément le public de la plateforme.
const afficherGlobe = ref(false)

function globeAbordable() {
  const connexion = navigator.connection
  if (!connexion) return true
  // saveData est un choix explicite de l'utilisateur : on le respecte toujours.
  if (connexion.saveData) return false
  // `effectiveType` n'est PAS le type de réseau : c'est une estimation glissante du
  // débit, qui retombe souvent à « 3g » sur une connexion tout à fait correcte (wifi
  // partagé, 4G avec de la latence, premiers instants du chargement). S'en servir pour
  // supprimer le globe le faisait disparaître au hasard d'un rechargement. On ne coupe
  // donc plus que sur les deux niveaux où le téléchargement serait vraiment pénible.
  return !['slow-2g', '2g'].includes(connexion.effectiveType)
}

function evaluerGlobe() {
  if (afficherGlobe.value || !globeAbordable()) return
  // Même sur bonne connexion, la décoration attend que le contenu utile soit affiché.
  const charger = () => {
    afficherGlobe.value = true
  }
  if (window.requestIdleCallback) window.requestIdleCallback(charger, { timeout: 3000 })
  else setTimeout(charger, 1200)
}

onMounted(() => {
  // Au chargement, on récupère le profil (pseudo, photo) pour la barre de navigation,
  // et ça vérifie au passage que la session est toujours valide côté serveur.
  if (citoyenStore.estConnecte) citoyenStore.chargerProfil()
  if (authStore.estConnecte) authStore.verifierSession()

  evaluerGlobe()

  // L'estimation de débit se précise après quelques secondes de navigation : si elle
  // était pessimiste au chargement, le globe apparaît au lieu de manquer toute la visite.
  navigator.connection?.addEventListener?.('change', evaluerGlobe)
})

onUnmounted(() => {
  navigator.connection?.removeEventListener?.('change', evaluerGlobe)
})
</script>

<template>
  <RouterView v-if="route.meta.admin" />
  <template v-else>
    <!-- Le serveur gratuit s'éteint après un quart d'heure sans visite. Pendant qu'il
         redémarre, le site réessaie tout seul : on le dit, sinon la personne croit à
         une panne et s'en va. -->
    <p v-if="etatReseau.reveilEnCours" class="bandeau-reveil" role="status">
      Le serveur redémarre, merci de patienter quelques secondes...
    </p>
    <GlobeBackground v-if="afficherGlobe" />
    <div class="app-shell">
      <NavBar />
      <RouterView />
      <Footer />
    </div>
    <ThemeToggle />
  </template>
  <DialogueGlobal />
</template>
