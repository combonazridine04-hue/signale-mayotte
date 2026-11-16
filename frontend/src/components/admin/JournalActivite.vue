<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '../../services/api.js'

// Journal d'activité de l'espace admin. Les données viennent de la base NoSQL NeDB (voir
// server/journal.js) : connexions, actions sur les comptes, changements de statut…

const actif = ref(true)
const chargement = ref(false)
const erreur = ref('')

const types = ref([])
const evenements = ref([])
const total = ref(0)
const page = ref(1)
const parPage = 25

const filtreType = ref('')
const filtreResultat = ref('')

const stats = ref(null)
const JOURS_STATS = 30

const nbPages = computed(() => Math.max(1, Math.ceil(total.value / parPage)))

async function lireJson(url) {
  const reponse = await apiFetch(url)
  const corps = await reponse.json().catch(() => ({}))
  if (!reponse.ok) throw new Error(corps.erreur || `Erreur serveur (${reponse.status})`)
  return corps
}

async function chargerEvenements() {
  chargement.value = true
  erreur.value = ''
  const params = new URLSearchParams({ page: String(page.value), parPage: String(parPage) })
  if (filtreType.value) params.set('type', filtreType.value)
  if (filtreResultat.value) params.set('resultat', filtreResultat.value)
  try {
    const donnees = await lireJson(`/api/journal?${params}`)
    actif.value = donnees.actif
    types.value = donnees.types || []
    evenements.value = donnees.evenements || []
    total.value = donnees.total || 0
  } catch (e) {
    erreur.value = e.message
  } finally {
    chargement.value = false
  }
}

async function chargerStatistiques() {
  try {
    const donnees = await lireJson(`/api/journal/statistiques?jours=${JOURS_STATS}`)
    stats.value = donnees.actif ? donnees : null
  } catch {
    stats.value = null
  }
}

function filtrer() {
  page.value = 1
  chargerEvenements()
}

function allerA(nouvellePage) {
  page.value = Math.min(Math.max(1, nouvellePage), nbPages.value)
  chargerEvenements()
}

function actualiser() {
  chargerEvenements()
  chargerStatistiques()
}

onMounted(actualiser)

const LIBELLES_ACTEUR = { admin: 'Admin', partenaire: 'Partenaire', citoyen: 'Citoyen', anonyme: 'Anonyme' }

function decrireActeur(acteur) {
  if (!acteur) return '—'
  const libelle = LIBELLES_ACTEUR[acteur.type] || acteur.type
  if (acteur.nom) return `${libelle} · ${acteur.nom}`
  if (acteur.id) return `${libelle} n°${acteur.id}`
  return libelle
}

function decrireCible(cible) {
  if (!cible) return ''
  return cible.nom ? `${cible.type} « ${cible.nom} »` : `${cible.type} n°${cible.id}`
}

// Chaque type d'événement a ses propres détails : on les affiche tels quels, clé par clé.
const LIBELLES_DETAILS = {
  avant: 'Avant',
  apres: 'Après',
  motif: 'Motif',
  commune: 'Commune',
  categorie: 'Catégorie',
  categories: 'Domaines',
  statut: 'Statut',
  route: 'Formulaire',
  deuxFacteurs: 'Double authentification',
  signalementsAbusRetires: 'Signalements retirés'
}

function decrireDetails(details) {
  if (!details) return []
  return Object.entries(details).map(([cle, valeur]) => {
    let texte = valeur
    if (Array.isArray(valeur)) texte = valeur.length ? valeur.join(', ') : 'tous'
    else if (typeof valeur === 'boolean') texte = valeur ? 'oui' : 'non'
    return `${LIBELLES_DETAILS[cle] || cle} : ${texte}`
  })
}

const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
</script>

<template>
  <div class="d-flex flex-column gap-4">
    <div v-if="!actif" class="admin-panel">
      <h2 class="admin-panel-title">Journal indisponible</h2>
      <p class="admin-muted mb-0">
        Le journal d'activité n'a pas pu être ouvert. Le reste du site fonctionne normalement sans lui.
      </p>
    </div>

    <template v-else>
      <div v-if="stats" class="admin-stats mb-0">
        <div class="admin-stat-tile">
          <span class="admin-stat-dot admin-stat-dot--neutre" aria-hidden="true"></span>
          <p class="admin-stat-value">{{ stats.total }}</p>
          <p class="admin-stat-label">Événements ({{ JOURS_STATS }} jours)</p>
        </div>
        <div class="admin-stat-tile">
          <span class="admin-stat-dot admin-stat-dot--signale" aria-hidden="true"></span>
          <p class="admin-stat-value">{{ stats.echecs }}</p>
          <p class="admin-stat-label">Échecs (connexions, anti-robot…)</p>
        </div>
        <div v-for="ligne in stats.parType.slice(0, 2)" :key="ligne.type" class="admin-stat-tile">
          <span class="admin-stat-dot admin-stat-dot--resolu" aria-hidden="true"></span>
          <p class="admin-stat-value">{{ ligne.succes + ligne.echec }}</p>
          <p class="admin-stat-label">{{ ligne.libelle }}</p>
        </div>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-header">
          <h2>Événements</h2>
          <button type="button" class="admin-btn admin-btn--ghost" :disabled="chargement" @click="actualiser">
            Actualiser
          </button>
        </div>

        <div class="journal-filtres">
          <label>
            <span>Type</span>
            <select v-model="filtreType" class="admin-select" @change="filtrer">
              <option value="">Tous</option>
              <option v-for="t in types" :key="t.valeur" :value="t.valeur">{{ t.libelle }}</option>
            </select>
          </label>
          <label>
            <span>Résultat</span>
            <select v-model="filtreResultat" class="admin-select" @change="filtrer">
              <option value="">Tous</option>
              <option value="succes">Réussi</option>
              <option value="echec">Échec</option>
            </select>
          </label>
          <span class="admin-muted ms-auto">{{ total }} événement{{ total > 1 ? 's' : '' }}</span>
        </div>

        <p v-if="erreur" class="admin-form-erreur">{{ erreur }}</p>
        <p v-else-if="chargement && !evenements.length" class="admin-muted">Chargement...</p>
        <p v-else-if="!evenements.length" class="admin-muted">Aucun événement pour ces filtres.</p>

        <table v-else class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Événement</th>
              <th>Par</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in evenements" :key="e.id">
              <td data-label="Date" class="text-nowrap">{{ formatDate(e.date) }}</td>
              <td data-label="Événement">
                <span
                  class="admin-badge"
                  :class="e.resultat === 'echec' ? 'admin-badge--signale' : 'admin-badge--resolu'"
                >
                  {{ e.resultat === 'echec' ? 'Échec' : 'OK' }}
                </span>
                {{ e.libelle }}
                <div v-if="e.cible" class="admin-muted small">{{ decrireCible(e.cible) }}</div>
              </td>
              <td data-label="Par">{{ decrireActeur(e.acteur) }}</td>
              <td data-label="Détails">
                <div v-for="ligne in decrireDetails(e.details)" :key="ligne" class="small">{{ ligne }}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="nbPages > 1" class="journal-pagination">
          <button
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="page <= 1 || chargement"
            @click="allerA(page - 1)"
          >
            ← Précédent
          </button>
          <span class="admin-muted">Page {{ page }} / {{ nbPages }}</span>
          <button
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="page >= nbPages || chargement"
            @click="allerA(page + 1)"
          >
            Suivant →
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.journal-filtres {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.journal-filtres label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.journal-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
