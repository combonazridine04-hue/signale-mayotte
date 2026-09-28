<script setup>
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { usePartenaireStore } from '../../stores/partenaireStore.js'
import { useSignalementStore } from '../../stores/signalementStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { STATUTS } from '../../models/signalement.js'
import FilterBar from '../../components/FilterBar.vue'

const router = useRouter()
const partenaireStore = usePartenaireStore()
const signalementStore = useSignalementStore()
const uiStore = useUiStore()

const seDeconnecter = () => {
  partenaireStore.deconnecter()
  router.push({ name: 'partenaire-login' })
}

// La liste s'ouvre déjà filtrée sur la commune du partenaire : c'est celle sur laquelle
// il agit. Un partenaire sans commune assignée (ex. un service départemental) voit tout.
// Le filtre reste modifiable — parcourir une autre commune est possible, seul le
// changement de statut y est bloqué côté serveur (RG : contrôlé côté serveur).
const filtres = ref({
  commune: partenaireStore.commune || '',
  categorie: '',
  statut: '',
  recherche: '',
  tri: 'recent',
  urgent: false
})
let delaiRecherche = null

function rafraichir(page = 1) {
  signalementStore.charger(filtres.value, page)
}

watch(
  () => [filtres.value.commune, filtres.value.categorie, filtres.value.statut, filtres.value.tri, filtres.value.urgent],
  () => rafraichir(1)
)
watch(
  () => filtres.value.recherche,
  () => {
    clearTimeout(delaiRecherche)
    delaiRecherche = setTimeout(() => rafraichir(1), 300)
  }
)

onMounted(() => rafraichir(1))

function horsDeMaCommune(signalement) {
  return Boolean(partenaireStore.commune) && signalement.commune !== partenaireStore.commune
}

const changerStatut = async (id, statut) => {
  try {
    await signalementStore.changerStatut(id, statut)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

function pagePrecedente() {
  if (signalementStore.page > 1) rafraichir(signalementStore.page - 1)
}
function pageSuivante() {
  rafraichir(signalementStore.page + 1)
}
</script>

<template>
  <div class="admin-dashboard">
    <div class="admin-main">
      <header class="admin-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1>Espace partenaire</h1>
          <p class="admin-muted mb-0">
            {{ partenaireStore.nom }}
            <span v-if="partenaireStore.commune"> — {{ partenaireStore.commune }}</span>
            <span v-else> — toutes communes</span>
          </p>
        </div>
        <div class="d-flex gap-2">
          <RouterLink to="/" class="admin-btn admin-btn--ghost">Voir le site public</RouterLink>
          <button type="button" class="admin-btn admin-btn--ghost" @click="seDeconnecter">Déconnexion</button>
        </div>
      </header>

      <div class="admin-content">
        <div class="admin-panel">
          <h2 class="admin-panel-title">Signalements</h2>
          <p class="admin-muted">
            Faites évoluer le statut d'un signalement au fil de son traitement : Signalé → En cours → Résolu.
          </p>

          <!-- FilterBar est une .row Bootstrap (marge haute négative) : sans mt-3 elle recouvre le texte au-dessus. -->
          <FilterBar v-model="filtres" class="mt-3 mb-3" />

          <p v-if="signalementStore.chargement" class="admin-muted">Chargement...</p>
          <p v-else-if="!signalementStore.signalements.length" class="admin-muted">Aucun signalement.</p>
          <table v-else class="admin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Commune</th>
                <th>Description</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in signalementStore.signalements" :key="s.id">
                <td data-label="Catégorie">
                  {{ s.categorie }}
                  <span v-if="s.urgent" class="admin-badge admin-badge--signale">Urgent</span>
                </td>
                <td data-label="Commune">{{ s.commune }}</td>
                <td data-label="Description" class="text-truncate" style="max-width: 260px">{{ s.description }}</td>
                <td data-label="Statut">
                  <select
                    class="admin-select"
                    :value="s.statut"
                    :disabled="horsDeMaCommune(s)"
                    :title="horsDeMaCommune(s) ? 'Ce signalement ne concerne pas votre commune.' : ''"
                    @change="changerStatut(s.id, $event.target.value)"
                  >
                    <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
                  </select>
                </td>
                <td data-label="Date">{{ new Date(s.dateSignalement).toLocaleDateString('fr-FR') }}</td>
                <td data-label="Actions">
                  <RouterLink :to="`/signalements/${s.id}`" class="admin-btn admin-btn--ghost">Voir</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="signalementStore.totalFiltre > signalementStore.parPage" class="d-flex gap-2 mt-3">
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="signalementStore.page <= 1"
              @click="pagePrecedente"
            >
              ← Précédent
            </button>
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="signalementStore.page * signalementStore.parPage >= signalementStore.totalFiltre"
              @click="pageSuivante"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
