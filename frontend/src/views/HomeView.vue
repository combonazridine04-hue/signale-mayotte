<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Hero from '../components/Hero.vue'
import CommentCaMarche from '../components/CommentCaMarche.vue'
import FilterBar from '../components/FilterBar.vue'
import SignalementCard from '../components/SignalementCard.vue'
import SignalementCardSkeleton from '../components/SignalementCardSkeleton.vue'
import { useSignalementStore } from '../stores/signalementStore.js'

const signalementStore = useSignalementStore()
const route = useRoute()
const router = useRouter()

// Les filtres viennent de l'URL : un lien du pied de page ou un lien partagé
// (« tous les problèmes de voirie à Koungou ») ouvre la liste déjà filtrée.
const filtres = ref({
  commune: route.query.commune || '',
  categorie: route.query.categorie || '',
  statut: route.query.statut || '',
  recherche: route.query.recherche || '',
  tri: route.query.tri || 'recent',
  urgent: route.query.urgent === '1'
})

let delaiRecherche = null

function rafraichir(page = 1) {
  signalementStore.charger(filtres.value, page)
}

// L'URL reflète les filtres, et inversement. Les deux sens comparent avant d'écrire :
// sans ça, chacun relancerait l'autre indéfiniment.
function queryDepuisFiltres() {
  const q = {}
  for (const cle of ['commune', 'categorie', 'statut', 'recherche', 'tri']) {
    if (filtres.value[cle] && !(cle === 'tri' && filtres.value[cle] === 'recent')) q[cle] = filtres.value[cle]
  }
  if (filtres.value.urgent) q.urgent = '1'
  return q
}

function memeQuery(a, b) {
  const cles = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...cles].every((c) => (a[c] || '') === (b[c] || ''))
}

function synchroniserUrl() {
  const q = queryDepuisFiltres()
  if (!memeQuery(q, route.query)) router.replace({ path: '/', query: q })
}

// Cliquer une catégorie du pied de page alors qu'on est DÉJÀ sur l'accueil ne
// remonte pas le composant : sans cette écoute, le lien ne ferait rien.
watch(
  () => route.query,
  (q) => {
    if (memeQuery(queryDepuisFiltres(), q)) return
    filtres.value = {
      commune: q.commune || '',
      categorie: q.categorie || '',
      statut: q.statut || '',
      recherche: q.recherche || '',
      tri: q.tri || 'recent',
      urgent: q.urgent === '1'
    }
    rafraichir(1)
    document.querySelector('.signalements-section')?.scrollIntoView({ behavior: 'smooth' })
  }
)

watch(
  () => [filtres.value.commune, filtres.value.categorie, filtres.value.statut, filtres.value.tri, filtres.value.urgent],
  () => {
    synchroniserUrl()
    rafraichir(1)
  }
)

watch(
  () => filtres.value.recherche,
  () => {
    clearTimeout(delaiRecherche)
    delaiRecherche = setTimeout(() => {
      synchroniserUrl()
      rafraichir(1)
    }, 300)
  }
)

const nbPages = () => Math.max(1, Math.ceil(signalementStore.totalFiltre / signalementStore.parPage))

function pagePrecedente() {
  if (signalementStore.page > 1) rafraichir(signalementStore.page - 1)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function pageSuivante() {
  if (signalementStore.page < nbPages()) rafraichir(signalementStore.page + 1)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => rafraichir(1))
</script>

<template>
  <main>
    <Hero />

    <CommentCaMarche />

    <section class="signalements-section">
      <div class="container">
        <div class="mb-4">
          <p class="section-kicker">Signalements</p>
          <h2 class="mb-0">Derniers signalements de Mayotte</h2>
        </div>

        <FilterBar v-model="filtres" class="mb-4" />

        <!-- Une erreur sans moyen d'action laisse l'habitant devant une page morte :
             il doit pouvoir relancer sans recharger toute la page. -->
        <div v-if="signalementStore.erreur" class="alert alert-danger d-flex flex-wrap align-items-center gap-3">
          <span>{{ signalementStore.erreur }}</span>
          <button type="button" class="btn btn-sm btn-outline-light" @click="rafraichir(1)">Réessayer</button>
        </div>

        <template v-else>
          <p class="text-secondary small mb-3">
            <span v-if="signalementStore.chargement">Chargement...</span>
            <span v-else>
              {{ signalementStore.totalFiltre }} signalement{{ signalementStore.totalFiltre > 1 ? 's' : '' }}
            </span>
          </p>

          <div v-if="signalementStore.chargement" class="row g-4">
            <div v-for="n in 6" :key="n" class="col-12 col-md-6 col-xl-4">
              <SignalementCardSkeleton />
            </div>
          </div>

          <template v-else>
            <div v-if="signalementStore.signalements.length" class="row g-4">
              <div
                v-for="signalement in signalementStore.signalements"
                :key="signalement.id"
                class="col-12 col-md-6 col-xl-4"
              >
                <SignalementCard :signalement="signalement" />
              </div>
            </div>

            <div v-else class="empty-state text-center py-5">
              <p class="text-secondary mb-0">Aucun signalement ne correspond à ces filtres.</p>
            </div>

            <div v-if="nbPages() > 1" class="d-flex justify-content-center align-items-center gap-3 mt-5">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="signalementStore.page <= 1"
                @click="pagePrecedente"
              >
                ← Précédent
              </button>
              <span class="text-secondary small">Page {{ signalementStore.page }} / {{ nbPages() }}</span>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="signalementStore.page >= nbPages()"
                @click="pageSuivante"
              >
                Suivant →
              </button>
            </div>
          </template>
        </template>
      </div>
    </section>
  </main>
</template>
