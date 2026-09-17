<script setup>
import { defineAsyncComponent, onMounted } from 'vue'
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

// Au chargement, on récupère le profil (pseudo, photo) pour la barre de navigation,
// et ça vérifie au passage que la session est toujours valide côté serveur.
onMounted(() => {
  if (citoyenStore.estConnecte) citoyenStore.chargerProfil()
})
</script>

<template>
  <RouterView v-if="route.meta.admin" />
  <template v-else>
    <GlobeBackground />
    <div class="app-shell">
      <NavBar />
      <RouterView />
      <Footer />
    </div>
    <ThemeToggle />
  </template>
  <DialogueGlobal />
</template>
