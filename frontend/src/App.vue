<script setup>
import { defineAsyncComponent, onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DialogueGlobal from './components/DialogueGlobal.vue'
import { RouterView, useRoute } from 'vue-router'
import { synchroniserSession } from './utils/session.js'

// Le téléchargement du globe démarre DÈS le chargement du site, en parallèle de
// l'affichage de la page, pour qu'il apparaisse en même temps qu'elle (il attendait
// auparavant que le navigateur soit inoccupé, jusqu'à 3 secondes).
const chargerGlobe = () => import('./components/GlobeBackground.vue')
const globeEnCours = chargerGlobe()

const GlobeBackground = defineAsyncComponent({
  loader: () => globeEnCours.catch(chargerGlobe),
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

// Le globe fait partie de l'identité du site : il s'affiche TOUJOURS, quelle que soit la
// connexion. Il était auparavant supprimé en mode économie de données ou quand le
// navigateur estimait le débit à « 2g » — estimation fréquente à Mayotte même sur une
// connexion utilisable, si bien que le globe disparaissait chez de vrais visiteurs.
// Ne pas réintroduire de condition qui le masque.

onMounted(() => {
  // Le serveur dit qui est connecté (le cookie de session est illisible pour la page) ;
  // pour un citoyen, ça charge aussi pseudo et photo pour la barre de navigation.
  synchroniserSession()
})
</script>

<template>
  <RouterView v-if="route.meta.admin || route.meta.partenaire" />
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
