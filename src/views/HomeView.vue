<script setup>
import { onMounted, ref, watch } from 'vue'
import Hero from '../components/Hero.vue'
import FilterBar from '../components/FilterBar.vue'
import SignalementCard from '../components/SignalementCard.vue'
import SignalementCardSkeleton from '../components/SignalementCardSkeleton.vue'
import { useSignalementStore } from '../stores/signalementStore.js'

const signalementStore = useSignalementStore()

const filtres = ref({ commune: '', categorie: '', statut: '', recherche: '', tri: 'recent' })

let delaiRecherche = null

function rafraichir(page = 1) {
  signalementStore.charger(filtres.value, page)
}

watch(() => [filtres.value.commune, filtres.value.categorie, filtres.value.statut, filtres.value.tri], () => rafraichir(1))

watch(
  () => filtres.value.recherche,
  () => {
    clearTimeout(delaiRecherche)
    delaiRecherche = setTimeout(() => rafraichir(1), 300)
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

    <section class="signalements-section">
      <div class="container">
        <div class="mb-4">
          <p class="section-kicker">Signalements</p>
          <h2 class="mb-0">Derniers signalements de Mayotte</h2>
        </div>

        <FilterBar v-model="filtres" class="mb-4" />

        <div v-if="signalementStore.erreur" class="alert alert-danger">
          {{ signalementStore.erreur }}
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
