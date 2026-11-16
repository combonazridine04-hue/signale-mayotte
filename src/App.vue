<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DialogueGlobal from './components/DialogueGlobal.vue'
import { RouterView, useRoute } from 'vue-router'
import { etatReseau } from './utils/api.js'
import { synchroniserSession } from './utils/session.js'

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

// Le globe fait partie de l'identité du site : il s'affiche TOUJOURS, quelle que soit la
// connexion. Il était auparavant supprimé en mode économie de données ou quand le
// navigateur estimait le débit à « 2g » — estimation fréquente à Mayotte même sur une
// connexion utilisable, si bien que le globe disparaissait chez de vrais visiteurs.
// Ne pas réintroduire de condition qui le masque.
const afficherGlobe = ref(false)

function evaluerGlobe() {
  if (afficherGlobe.value) return
  // Il se charge seulement après le contenu utile, pour ne pas retarder l'affichage.
  const charger = () => {
    afficherGlobe.value = true
  }
  if (window.requestIdleCallback) window.requestIdleCallback(charger, { timeout: 3000 })
  else setTimeout(charger, 1200)
}

onMounted(() => {
  // Le serveur dit qui est connecté (le cookie de session est illisible pour la page) ;
  // pour un citoyen, ça charge aussi pseudo et photo pour la barre de navigation.
  synchroniserSession()

  evaluerGlobe()
})
</script>

<template>
  <RouterView v-if="route.meta.admin || route.meta.partenaire" />
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
