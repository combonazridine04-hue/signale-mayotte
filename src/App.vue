<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DialogueGlobal from './components/DialogueGlobal.vue'
import { RouterView, useRoute } from 'vue-router'
import { useCitoyenStore } from './stores/citoyenStore.js'

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

// Le globe est purement décoratif et pèse ~170 ko compressés (three.js). Signaler un
// problème ne doit jamais coûter ça à quelqu'un en 3G ou en forfait limité : fréquent
// à Mayotte, et c'est précisément le public de la plateforme.
const afficherGlobe = ref(false)

function globeAbordable() {
  const connexion = navigator.connection
  if (!connexion) return true
  if (connexion.saveData) return false
  return !['slow-2g', '2g', '3g'].includes(connexion.effectiveType)
}

onMounted(() => {
  // Au chargement, on récupère le profil (pseudo, photo) pour la barre de navigation,
  // et ça vérifie au passage que la session est toujours valide côté serveur.
  if (citoyenStore.estConnecte) citoyenStore.chargerProfil()

  if (!globeAbordable()) return

  // Même sur bonne connexion, la décoration attend que le contenu utile soit affiché.
  const charger = () => { afficherGlobe.value = true }
  if (window.requestIdleCallback) window.requestIdleCallback(charger, { timeout: 3000 })
  else setTimeout(charger, 1200)
})
</script>

<template>
  <RouterView v-if="route.meta.admin" />
  <template v-else>
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
