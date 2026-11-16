<script setup>
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { usePartenaireStore } from '../../stores/partenaireStore.js'
import { useSignalementStore } from '../../stores/signalementStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { STATUTS } from '../../models/signalement.js'
import FilterBar from '../../components/FilterBar.vue'
import { apiFetch } from '../../utils/api.js'
import { dansLePerimetre, libellePerimetre } from '../../../shared/perimetrePartenaire.js'

const router = useRouter()
const partenaireStore = usePartenaireStore()
const signalementStore = useSignalementStore()
const uiStore = useUiStore()

const seDeconnecter = () => {
  partenaireStore.deconnecter()
  router.push({ name: 'partenaire-login' })
}

// La liste s'ouvre déjà filtrée sur le périmètre du partenaire : sa commune, et son
// domaine s'il n'en a qu'un (ex. SIDEVAM976 → déchets). Les filtres restent modifiables ;
// hors de son périmètre, seul le changement de statut est bloqué (contrôlé côté serveur).
const filtres = ref({
  commune: partenaireStore.commune || '',
  categorie: partenaireStore.categories.length === 1 ? partenaireStore.categories[0] : '',
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

// Nombre de signalements de son périmètre arrivés depuis sa connexion précédente.
const nouveaux = ref(0)

async function chargerNouveaux() {
  try {
    const reponse = await apiFetch('/api/partenaires/moi/nouveaux')
    if (reponse.ok) nouveaux.value = (await reponse.json()).nombre
  } catch {
    // Compteur indicatif : son absence ne gêne pas le travail.
  }
}

onMounted(() => {
  rafraichir(1)
  chargerNouveaux()
})

function horsPerimetre(signalement) {
  return !dansLePerimetre(partenaireStore, signalement)
}

function estNouveau(signalement) {
  return (
    Boolean(partenaireStore.depuis) &&
    signalement.dateSignalement > partenaireStore.depuis &&
    !horsPerimetre(signalement)
  )
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

// Pas de rafraîchissement automatique : sur une connexion mobile limitée, c'est le
// partenaire qui décide quand recharger.
const actualisation = ref(false)
async function actualiser() {
  actualisation.value = true
  try {
    await Promise.all([signalementStore.charger(filtres.value, signalementStore.page), chargerNouveaux()])
  } finally {
    actualisation.value = false
  }
}
</script>

<template>
  <div class="admin-dashboard">
    <div class="admin-main">
      <header class="admin-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1>Espace partenaire</h1>
          <p class="admin-muted mb-0">{{ partenaireStore.nom }} — {{ libellePerimetre(partenaireStore) }}</p>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="admin-btn admin-btn--primary" :disabled="actualisation" @click="actualiser">
            {{ actualisation ? 'Actualisation…' : 'Actualiser' }}
          </button>
          <RouterLink to="/" class="admin-btn admin-btn--ghost">Voir le site public</RouterLink>
          <button type="button" class="admin-btn admin-btn--ghost" @click="seDeconnecter">Déconnexion</button>
        </div>
      </header>

      <div class="admin-content">
        <div class="admin-panel">
          <h2 class="admin-panel-title">Signalements</h2>
          <p class="admin-muted">
            Faites évoluer le statut d'un signalement au fil de son traitement : Signalé → En cours → Résolu. L'habitant
            qui l'a signalé est prévenu à chaque étape.
          </p>
          <p v-if="nouveaux" class="partenaire-nouveaux" role="status">
            {{ nouveaux }} nouveau{{ nouveaux > 1 ? 'x' : '' }} signalement{{ nouveaux > 1 ? 's' : '' }} dans votre
            périmètre depuis votre dernière connexion.
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
              <tr v-for="s in signalementStore.signalements" :key="s.id" :class="{ 'ligne-nouvelle': estNouveau(s) }">
                <td data-label="Catégorie">
                  {{ s.categorie }}
                  <span v-if="estNouveau(s)" class="admin-badge admin-badge--nouveau">Nouveau</span>
                  <span v-if="s.urgent" class="admin-badge admin-badge--signale">Urgent</span>
                </td>
                <td data-label="Commune">{{ s.commune }}</td>
                <td data-label="Description" class="text-truncate" style="max-width: 260px">{{ s.description }}</td>
                <td data-label="Statut">
                  <select
                    class="admin-select"
                    :value="s.statut"
                    :disabled="horsPerimetre(s)"
                    :title="horsPerimetre(s) ? 'Ce signalement ne relève pas de votre périmètre.' : ''"
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
