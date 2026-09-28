<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { useSignalementStore } from '../../stores/signalementStore.js'
import { useContactStore } from '../../stores/contactStore.js'
import { useAdminStore } from '../../stores/adminStore.js'
import { usePartenairesAdminStore } from '../../stores/partenairesAdminStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { STATUTS, COMMUNES, CATEGORIES } from '../../models/signalement.js'
import { apiFetch } from '../../utils/api.js'
import FilterBar from '../../components/FilterBar.vue'
import ChampMotDePasse from '../../components/ChampMotDePasse.vue'

const router = useRouter()
const authStore = useAuthStore()
const signalementStore = useSignalementStore()
const contactStore = useContactStore()
const adminStore = useAdminStore()
const partenairesAdminStore = usePartenairesAdminStore()
const uiStore = useUiStore()

const seDeconnecter = () => {
  authStore.deconnecter()
  router.push('/admin/login')
}

const section = ref('apercu')
const menuMobileOuvert = ref(false)

function choisirSection(nomSection) {
  section.value = nomSection
  menuMobileOuvert.value = false
}

const signalementsAbus = ref([])
const chargementModeration = ref(false)

async function chargerModeration() {
  chargementModeration.value = true
  try {
    const reponse = await apiFetch('/api/moderation/signalements-abus')
    const donnees = await reponse.json()
    signalementsAbus.value = donnees.signalementsAbus || []
  } catch {
    signalementsAbus.value = []
  } finally {
    chargementModeration.value = false
  }
}

const supprimerContenuSignale = async (item) => {
  if (!(await uiStore.confirmer('Supprimer définitivement ce contenu ?'))) return
  try {
    const url =
      item.type === 'signalement'
        ? `/api/signalements/${item.cibleId}`
        : `/api/signalements/${item.apercu.signalement_id}/commentaires/${item.cibleId}`
    await apiFetch(url, { method: 'DELETE' })
    await chargerModeration()
    signalementStore.charger()
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const ignorerSignalementAbus = async (item) => {
  try {
    await apiFetch(`/api/moderation/signalements-abus/${item.type}/${item.cibleId}`, { method: 'DELETE' })
    await chargerModeration()
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

onMounted(() => {
  signalementStore.charger()
  signalementStore.chargerStats()
  contactStore.charger()
  adminStore.charger()
  adminStore
    .statutDeuxFacteurs()
    .then((actif) => (deuxFacteurs.actif = actif))
    .catch(() => {})
  partenairesAdminStore.charger()
  partenairesAdminStore.chargerModeAlertes()
  chargerModeration()
})

const nouveauCompte = reactive({ identifiant: '', motDePasse: '' })
const erreurNouveauCompte = ref('')
const creationEnCours = ref(false)

const creerCompte = async () => {
  erreurNouveauCompte.value = ''
  creationEnCours.value = true
  try {
    await adminStore.creer(nouveauCompte.identifiant.trim(), nouveauCompte.motDePasse)
    nouveauCompte.identifiant = ''
    nouveauCompte.motDePasse = ''
  } catch (e) {
    erreurNouveauCompte.value = e.message
  } finally {
    creationEnCours.value = false
  }
}

const supprimerCompte = async (compte) => {
  if (!(await uiStore.confirmer(`Supprimer définitivement le compte "${compte.identifiant}" ?`))) return
  try {
    await adminStore.supprimer(compte.id)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const partenaireVide = () => ({ nom: '', identifiant: '', motDePasse: '', commune: '', categories: [], email: '' })
const nouveauPartenaire = reactive(partenaireVide())
const erreurNouveauPartenaire = ref('')
const creationPartenaireEnCours = ref(false)

const creerPartenaire = async () => {
  erreurNouveauPartenaire.value = ''
  creationPartenaireEnCours.value = true
  try {
    await partenairesAdminStore.creer({
      ...nouveauPartenaire,
      nom: nouveauPartenaire.nom.trim(),
      identifiant: nouveauPartenaire.identifiant.trim(),
      email: nouveauPartenaire.email.trim()
    })
    Object.assign(nouveauPartenaire, partenaireVide())
  } catch (e) {
    erreurNouveauPartenaire.value = e.message
  } finally {
    creationPartenaireEnCours.value = false
  }
}

const supprimerPartenaire = async (compte) => {
  if (!(await uiStore.confirmer(`Supprimer définitivement le compte partenaire "${compte.identifiant}" ?`))) return
  try {
    await partenairesAdminStore.supprimer(compte.id)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const deuxFacteurs = reactive({
  actif: false,
  qr: '',
  secret: '',
  code: '',
  motDePasse: '',
  erreur: '',
  enCours: false
})

async function actionDeuxFacteurs(action) {
  deuxFacteurs.erreur = ''
  deuxFacteurs.enCours = true
  try {
    await action()
  } catch (e) {
    deuxFacteurs.erreur = e.message
  } finally {
    deuxFacteurs.enCours = false
  }
}

const preparerDeuxFacteurs = () =>
  actionDeuxFacteurs(async () => {
    const { qr, secret } = await adminStore.preparerDeuxFacteurs()
    deuxFacteurs.qr = qr
    deuxFacteurs.secret = secret
    deuxFacteurs.code = ''
  })

const activerDeuxFacteurs = () =>
  actionDeuxFacteurs(async () => {
    await adminStore.activerDeuxFacteurs(deuxFacteurs.code.trim())
    Object.assign(deuxFacteurs, { actif: true, qr: '', secret: '', code: '' })
    adminStore.charger()
    uiStore.alerter('Double authentification activée. Elle vous sera demandée à chaque connexion.')
  })

const desactiverDeuxFacteurs = () =>
  actionDeuxFacteurs(async () => {
    await adminStore.desactiverDeuxFacteurs(deuxFacteurs.motDePasse, deuxFacteurs.code.trim())
    Object.assign(deuxFacteurs, { actif: false, code: '', motDePasse: '' })
    adminStore.charger()
  })

const reinitialiserDeuxFacteurs = async (compte) => {
  const message = `Réinitialiser la double authentification de "${compte.identifiant}" ? Ses sessions seront fermées et il devra la reconfigurer.`
  if (!(await uiStore.confirmer(message))) return
  try {
    await adminStore.reinitialiserDeuxFacteurs(compte.id)
  } catch (e) {
    uiStore.alerter(e.message)
  }
}

const motDePasseForm = reactive({ actuel: '', nouveau: '', confirmation: '' })
const erreurMotDePasse = ref('')
const succesMotDePasse = ref(false)
const changementEnCours = ref(false)

const changerMotDePasse = async () => {
  erreurMotDePasse.value = ''
  succesMotDePasse.value = false

  if (motDePasseForm.nouveau !== motDePasseForm.confirmation) {
    erreurMotDePasse.value = 'La confirmation ne correspond pas au nouveau mot de passe.'
    return
  }

  changementEnCours.value = true
  try {
    await adminStore.changerMotDePasse(motDePasseForm.actuel, motDePasseForm.nouveau)
    succesMotDePasse.value = true
    motDePasseForm.actuel = ''
    motDePasseForm.nouveau = ''
    motDePasseForm.confirmation = ''
  } catch (e) {
    erreurMotDePasse.value = e.message
  } finally {
    changementEnCours.value = false
  }
}

const compteurs = computed(() => signalementStore.stats)

const nbPages = computed(() => Math.max(1, Math.ceil(signalementStore.totalFiltre / signalementStore.parPage)))

const filtresSignalements = ref({ commune: '', categorie: '', statut: '', recherche: '', tri: 'recent' })
let delaiRechercheAdmin = null

function rafraichirSignalements(page = 1) {
  signalementStore.charger(filtresSignalements.value, page)
}

watch(
  () => [
    filtresSignalements.value.commune,
    filtresSignalements.value.categorie,
    filtresSignalements.value.statut,
    filtresSignalements.value.tri
  ],
  () => rafraichirSignalements(1)
)

watch(
  () => filtresSignalements.value.recherche,
  () => {
    clearTimeout(delaiRechercheAdmin)
    delaiRechercheAdmin = setTimeout(() => rafraichirSignalements(1), 300)
  }
)

function pagePrecedente() {
  if (signalementStore.page > 1) rafraichirSignalements(signalementStore.page - 1)
}

function pageSuivante() {
  if (signalementStore.page < nbPages.value) rafraichirSignalements(signalementStore.page + 1)
}

const exportEnCours = ref(false)

const exporterCsv = async () => {
  exportEnCours.value = true
  try {
    const reponse = await apiFetch('/api/signalements/export.csv')
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}))
      throw new Error(corps.erreur || `Erreur serveur (${reponse.status})`)
    }
    const blob = await reponse.blob()
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = 'signalements.csv'
    lien.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    uiStore.alerter(e.message)
  } finally {
    exportEnCours.value = false
  }
}

const messagesNonLus = computed(() => contactStore.messages.filter((m) => !m.lu).length)

const suppressionSignalementEnCours = ref(null)

const supprimerSignalement = async (id) => {
  if (!(await uiStore.confirmer('Supprimer définitivement ce signalement ?'))) return
  suppressionSignalementEnCours.value = id
  try {
    await signalementStore.supprimer(id)
    signalementStore.chargerStats()
    // Si on vient de vider la page courante (et qu'il en existe une précédente), on y retourne.
    if (!signalementStore.signalements.length && signalementStore.page > 1) {
      await rafraichirSignalements(signalementStore.page - 1)
    }
  } catch (e) {
    uiStore.alerter(e.message)
  } finally {
    suppressionSignalementEnCours.value = null
  }
}

const suppressionMessageEnCours = ref(null)

const supprimerMessage = async (id) => {
  if (!(await uiStore.confirmer('Supprimer définitivement ce message ?'))) return
  suppressionMessageEnCours.value = id
  try {
    await contactStore.supprimer(id)
  } catch (e) {
    uiStore.alerter(e.message)
  } finally {
    suppressionMessageEnCours.value = null
  }
}

const changerStatut = async (id, statut) => {
  try {
    await signalementStore.changerStatut(id, statut)
    signalementStore.chargerStats()
  } catch (e) {
    uiStore.alerter(e.message)
  }
}
</script>

<template>
  <div class="admin-dashboard">
    <aside class="admin-sidebar" :class="{ 'admin-sidebar--ouvert': menuMobileOuvert }">
      <div class="admin-sidebar-header">
        <div class="admin-brand">
          <div class="admin-brand-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3l7 3v5c0 4.8-3 8.5-7 10-4-1.5-7-5.2-7-10V6l7-3Z" />
            </svg>
          </div>
          <div>
            <p class="admin-brand-title">Signale Mayotte</p>
            <p class="admin-brand-subtitle">Espace admin</p>
          </div>
        </div>

        <button
          type="button"
          class="admin-menu-toggle"
          :aria-expanded="menuMobileOuvert"
          aria-label="Ouvrir le menu"
          @click="menuMobileOuvert = !menuMobileOuvert"
        >
          <svg
            v-if="!menuMobileOuvert"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <nav class="admin-nav">
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'apercu' }"
          @click="choisirSection('apercu')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          Aperçu
        </button>
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'signalements' }"
          @click="choisirSection('signalements')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
            />
            <path d="M12 9v4" />
            <path d="M12 16.5h.01" />
          </svg>
          Signalements
          <span v-if="compteurs.signale" class="admin-nav-badge">{{ compteurs.signale }}</span>
        </button>
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'messages' }"
          @click="choisirSection('messages')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4a8.4 8.4 0 0 1-1-4A8.38 8.38 0 0 1 11.5 3a8.5 8.5 0 0 1 8.5 8.5Z"
            />
          </svg>
          Messages
          <span v-if="messagesNonLus" class="admin-nav-badge">{{ messagesNonLus }}</span>
        </button>
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'comptes' }"
          @click="choisirSection('comptes')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4.5 20c1.2-3.5 4-5.5 7.5-5.5s6.3 2 7.5 5.5" />
          </svg>
          Comptes
        </button>
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'partenaires' }"
          @click="choisirSection('partenaires')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 21h18" />
            <path d="M5 21V9l7-5 7 5v12" />
            <path d="M9 21v-6h6v6" />
          </svg>
          Partenaires
        </button>
        <button
          type="button"
          class="admin-nav-item"
          :class="{ active: section === 'moderation' }"
          @click="choisirSection('moderation')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 21V4a1 1 0 0 1 1-1h9l6 6v2H9" />
            <path d="M4 21l5-5" />
          </svg>
          Modération
          <span v-if="signalementsAbus.length" class="admin-nav-badge">{{ signalementsAbus.length }}</span>
        </button>
      </nav>

      <div class="admin-sidebar-footer">
        <p class="admin-sidebar-user">Connecté : {{ authStore.identifiant }}</p>
        <RouterLink to="/" class="admin-sidebar-link">Voir le site public</RouterLink>
        <button type="button" class="admin-sidebar-link admin-logout" @click="seDeconnecter">Déconnexion</button>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h1>
          {{
            {
              apercu: 'Aperçu',
              signalements: 'Signalements',
              messages: 'Messages',
              comptes: 'Comptes',
              partenaires: 'Partenaires',
              moderation: 'Modération'
            }[section]
          }}
        </h1>
        <button
          v-if="section === 'signalements'"
          type="button"
          class="admin-btn admin-btn--ghost"
          :disabled="exportEnCours"
          @click="exporterCsv"
        >
          {{ exportEnCours ? 'Export en cours...' : 'Exporter en CSV' }}
        </button>
      </header>

      <main class="admin-content">
        <div v-if="section === 'apercu'">
          <div class="admin-stats">
            <div class="admin-stat-tile">
              <span class="admin-stat-dot admin-stat-dot--neutre" aria-hidden="true"></span>
              <p class="admin-stat-value">{{ compteurs.total }}</p>
              <p class="admin-stat-label">Total signalements</p>
            </div>
            <div class="admin-stat-tile">
              <span class="admin-stat-dot admin-stat-dot--signale" aria-hidden="true"></span>
              <p class="admin-stat-value">{{ compteurs.signale }}</p>
              <p class="admin-stat-label">Signalés</p>
            </div>
            <div class="admin-stat-tile">
              <span class="admin-stat-dot admin-stat-dot--en-cours" aria-hidden="true"></span>
              <p class="admin-stat-value">{{ compteurs.enCours }}</p>
              <p class="admin-stat-label">En cours</p>
            </div>
            <div class="admin-stat-tile">
              <span class="admin-stat-dot admin-stat-dot--resolu" aria-hidden="true"></span>
              <p class="admin-stat-value">{{ compteurs.resolu }}</p>
              <p class="admin-stat-label">Résolus</p>
            </div>
          </div>

          <div class="admin-panel">
            <div class="admin-panel-header">
              <h2>Derniers signalements</h2>
              <button type="button" class="admin-link-button" @click="section = 'signalements'">Voir tout →</button>
            </div>
            <p v-if="signalementStore.chargement" class="admin-muted">Chargement...</p>
            <table v-else class="admin-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Commune</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in signalementStore.signalements.slice(0, 5)" :key="s.id">
                  <td data-label="Catégorie">{{ s.categorie }}</td>
                  <td data-label="Commune">{{ s.commune }}</td>
                  <td data-label="Statut">
                    <span
                      class="admin-badge"
                      :class="`admin-badge--${s.statut === 'Signalé' ? 'signale' : s.statut === 'En cours' ? 'en-cours' : 'resolu'}`"
                      >{{ s.statut }}</span
                    >
                  </td>
                  <td data-label="Date">{{ new Date(s.dateSignalement).toLocaleDateString('fr-FR') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="section === 'signalements'" class="admin-panel">
          <FilterBar v-model="filtresSignalements" class="mb-3" />

          <p v-if="signalementStore.chargement" class="admin-muted">Chargement...</p>
          <p v-else-if="!signalementStore.signalements.length" class="admin-muted">Aucun signalement.</p>
          <table v-else class="admin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Commune</th>
                <th>Auteur</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in signalementStore.signalements" :key="s.id">
                <td data-label="Catégorie">{{ s.categorie }}</td>
                <td data-label="Commune">{{ s.commune }}</td>
                <td data-label="Auteur">
                  <span v-if="s.auteurNom">{{ s.auteurNom }}</span>
                  <span v-else class="admin-muted">Anonyme (historique)</span>
                </td>
                <td data-label="Statut">
                  <select class="admin-select" :value="s.statut" @change="changerStatut(s.id, $event.target.value)">
                    <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
                  </select>
                </td>
                <td data-label="Date">{{ new Date(s.dateSignalement).toLocaleDateString('fr-FR') }}</td>
                <td data-label="Actions">
                  <div class="admin-actions">
                    <RouterLink :to="`/signalements/${s.id}`" class="admin-btn admin-btn--ghost">Voir</RouterLink>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      :disabled="suppressionSignalementEnCours === s.id"
                      @click="supprimerSignalement(s.id)"
                    >
                      {{ suppressionSignalementEnCours === s.id ? 'Suppression...' : 'Supprimer' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="nbPages > 1" class="d-flex justify-content-center align-items-center gap-3 mt-3">
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="signalementStore.page <= 1"
              @click="pagePrecedente"
            >
              ← Précédent
            </button>
            <span class="admin-muted small">Page {{ signalementStore.page }} / {{ nbPages }}</span>
            <button
              type="button"
              class="admin-btn admin-btn--ghost"
              :disabled="signalementStore.page >= nbPages"
              @click="pageSuivante"
            >
              Suivant →
            </button>
          </div>
        </div>

        <div v-else-if="section === 'messages'" class="admin-panel">
          <p v-if="contactStore.chargement" class="admin-muted">Chargement...</p>
          <p v-else-if="!contactStore.messages.length" class="admin-muted">Aucun message reçu.</p>
          <div v-else class="admin-messages">
            <div
              v-for="m in contactStore.messages"
              :key="m.id"
              class="admin-message"
              :class="{ 'admin-message--lu': m.lu }"
            >
              <div class="admin-message-header">
                <div>
                  <strong>{{ m.nom }}</strong> <span class="admin-muted">— {{ m.email }}</span>
                  <p class="admin-message-meta">{{ m.sujet }} · {{ new Date(m.dateEnvoi).toLocaleString('fr-FR') }}</p>
                </div>
                <div class="admin-actions">
                  <button type="button" class="admin-btn admin-btn--ghost" @click="contactStore.marquerLu(m.id, !m.lu)">
                    {{ m.lu ? 'Marquer non lu' : 'Marquer lu' }}
                  </button>
                  <button
                    type="button"
                    class="admin-btn admin-btn--danger"
                    :disabled="suppressionMessageEnCours === m.id"
                    @click="supprimerMessage(m.id)"
                  >
                    {{ suppressionMessageEnCours === m.id ? 'Suppression...' : 'Supprimer' }}
                  </button>
                </div>
              </div>
              <p class="admin-message-body">{{ m.message }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="section === 'partenaires'" class="admin-panel">
          <h2 class="admin-panel-title">Comptes partenaires</h2>
          <p class="admin-muted">
            Un partenaire (SIDEVAM976, SMAE, EDM, une mairie…) se connecte à un espace dédié pour faire évoluer le
            statut des signalements de son périmètre : ses domaines, sur sa commune ou sur toute l'île. S'il a une
            adresse e-mail, il est prévenu à chaque nouveau signalement qui le concerne.
          </p>
          <div
            v-if="partenairesAdminStore.modeAlertes && !partenairesAdminStore.modeAlertes.reelles"
            class="admin-alerte-test"
            role="status"
          >
            <strong>Mode test :</strong> les alertes ne partent pas aux adresses des partenaires, mais toutes vers la
            boîte de test ({{ partenairesAdminStore.modeAlertes.boiteTest }}), avec « [TEST] » dans l'objet.
          </div>
          <p v-if="partenairesAdminStore.chargement" class="admin-muted">Chargement...</p>
          <table v-else class="admin-table mb-4">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Domaines</th>
                <th>Commune</th>
                <th>Alertes</th>
                <th>Créé le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in partenairesAdminStore.comptes" :key="c.id">
                <td data-label="Nom">{{ c.nom }}</td>
                <td data-label="Identifiant">{{ c.identifiant }}</td>
                <td data-label="Domaines">{{ c.categories.length ? c.categories.join(', ') : 'Tous' }}</td>
                <td data-label="Commune">{{ c.commune || 'Toutes les communes' }}</td>
                <td data-label="Alertes">
                  <span v-if="c.email">{{ c.email }}</span>
                  <span v-else class="admin-muted">Pas d'e-mail</span>
                </td>
                <td data-label="Créé le">{{ new Date(c.creeLe).toLocaleDateString('fr-FR') }}</td>
                <td data-label="Actions">
                  <button type="button" class="admin-btn admin-btn--danger" @click="supprimerPartenaire(c)">
                    Supprimer
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 class="admin-panel-subtitle">Ajouter un compte partenaire</h3>
          <form class="admin-form" @submit.prevent="creerPartenaire">
            <div class="admin-form-field">
              <label for="partenaire-nom">Nom</label>
              <input id="partenaire-nom" v-model="nouveauPartenaire.nom" type="text" required minlength="2" />
            </div>
            <div class="admin-form-field">
              <label for="partenaire-identifiant">Identifiant</label>
              <input
                id="partenaire-identifiant"
                v-model="nouveauPartenaire.identifiant"
                type="text"
                required
                minlength="3"
              />
            </div>
            <div class="admin-form-field">
              <label for="partenaire-mdp">Mot de passe</label>
              <ChampMotDePasse
                id="partenaire-mdp"
                v-model="nouveauPartenaire.motDePasse"
                required
                minlength="8"
                autocomplete="new-password"
                classe-input=""
              />
            </div>
            <div class="admin-form-field">
              <label for="partenaire-commune">Commune</label>
              <select id="partenaire-commune" v-model="nouveauPartenaire.commune" class="admin-select">
                <option value="">Toutes les communes</option>
                <option v-for="commune in COMMUNES" :key="commune" :value="commune">{{ commune }}</option>
              </select>
            </div>
            <fieldset class="admin-form-field">
              <legend class="admin-legende">Domaines (aucun coché = tous)</legend>
              <label v-for="categorie in CATEGORIES" :key="categorie" class="admin-case">
                <input v-model="nouveauPartenaire.categories" type="checkbox" :value="categorie" />
                {{ categorie }}
              </label>
            </fieldset>
            <div class="admin-form-field">
              <label for="partenaire-email">E-mail pour les alertes (facultatif)</label>
              <input id="partenaire-email" v-model="nouveauPartenaire.email" type="email" autocomplete="off" />
            </div>
            <div v-if="erreurNouveauPartenaire" class="admin-form-erreur">{{ erreurNouveauPartenaire }}</div>
            <button type="submit" class="admin-btn admin-btn--primary" :disabled="creationPartenaireEnCours">
              {{ creationPartenaireEnCours ? 'Création...' : 'Créer le compte' }}
            </button>
          </form>
        </div>

        <div v-else-if="section === 'moderation'" class="admin-panel">
          <p v-if="chargementModeration" class="admin-muted">Chargement...</p>
          <p v-else-if="!signalementsAbus.length" class="admin-muted">Aucun contenu signalé.</p>
          <div v-else class="admin-messages">
            <div v-for="item in signalementsAbus" :key="`${item.type}-${item.cibleId}`" class="admin-message">
              <div class="admin-message-header">
                <div>
                  <strong>{{ item.type === 'signalement' ? 'Signalement' : 'Commentaire' }} #{{ item.cibleId }}</strong>
                  <span class="admin-muted">
                    — {{ item.nbSignalements }} signalement{{ item.nbSignalements > 1 ? 's' : '' }}</span
                  >
                  <p class="admin-message-meta">
                    Dernier signalement le {{ new Date(item.dernierSignalement).toLocaleString('fr-FR') }}
                  </p>
                </div>
                <div class="admin-actions">
                  <RouterLink
                    v-if="item.existeEncore"
                    :to="`/signalements/${item.type === 'signalement' ? item.cibleId : item.apercu.signalement_id}`"
                    class="admin-btn admin-btn--ghost"
                  >
                    Voir
                  </RouterLink>
                  <button
                    v-if="item.existeEncore"
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="supprimerContenuSignale(item)"
                  >
                    Supprimer le contenu
                  </button>
                  <button type="button" class="admin-btn admin-btn--ghost" @click="ignorerSignalementAbus(item)">
                    Ignorer
                  </button>
                </div>
              </div>
              <p v-if="!item.existeEncore" class="admin-message-body admin-muted">Ce contenu a déjà été supprimé.</p>
              <p v-else-if="item.type === 'signalement'" class="admin-message-body">
                {{ item.apercu.categorie }} — {{ item.apercu.commune }} : {{ item.apercu.description }}
              </p>
              <p v-else class="admin-message-body">
                <strong>{{ item.apercu.auteur }}</strong> : {{ item.apercu.texte }}
              </p>
              <p v-if="item.motifs?.length" class="admin-message-meta">Motifs : {{ item.motifs.join(', ') }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="section === 'comptes'" class="d-flex flex-column gap-4">
          <div class="admin-panel">
            <h2 class="admin-panel-title">
              Double authentification
              <span v-if="deuxFacteurs.actif" class="admin-badge admin-badge--resolu">Activée</span>
              <span v-else class="admin-badge admin-badge--signale">Désactivée</span>
            </h2>

            <template v-if="deuxFacteurs.actif">
              <p class="admin-muted">
                Votre compte demande, en plus du mot de passe, le code à 6 chiffres de votre application
                d'authentification. Un mot de passe volé ne suffit plus pour entrer.
              </p>
              <form class="admin-form" @submit.prevent="desactiverDeuxFacteurs">
                <div class="admin-form-field">
                  <label for="dfa-mdp">Mot de passe</label>
                  <ChampMotDePasse
                    id="dfa-mdp"
                    v-model="deuxFacteurs.motDePasse"
                    required
                    autocomplete="current-password"
                    classe-input=""
                  />
                </div>
                <div class="admin-form-field">
                  <label for="dfa-code-off">Code actuel de l'application</label>
                  <input
                    id="dfa-code-off"
                    v-model="deuxFacteurs.code"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    required
                  />
                </div>
                <div v-if="deuxFacteurs.erreur" class="admin-form-erreur">{{ deuxFacteurs.erreur }}</div>
                <button type="submit" class="admin-btn admin-btn--danger" :disabled="deuxFacteurs.enCours">
                  Désactiver la double authentification
                </button>
              </form>
            </template>

            <template v-else-if="deuxFacteurs.qr">
              <ol class="admin-etapes">
                <li>Installez une application d'authentification (Google Authenticator, Microsoft Authenticator…).</li>
                <li>Scannez ce QR code avec l'application.</li>
              </ol>
              <img :src="deuxFacteurs.qr" alt="QR code de configuration" class="admin-qr" width="220" height="220" />
              <p class="admin-muted small">
                Impossible de scanner ? Saisissez cette clé dans l'application :
                <code class="admin-cle">{{ deuxFacteurs.secret }}</code>
              </p>
              <form class="admin-form" @submit.prevent="activerDeuxFacteurs">
                <div class="admin-form-field">
                  <label for="dfa-code">3. Code affiché par l'application</label>
                  <input
                    id="dfa-code"
                    v-model="deuxFacteurs.code"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    maxlength="6"
                    required
                  />
                </div>
                <div v-if="deuxFacteurs.erreur" class="admin-form-erreur">{{ deuxFacteurs.erreur }}</div>
                <button type="submit" class="admin-btn admin-btn--primary" :disabled="deuxFacteurs.enCours">
                  Activer
                </button>
              </form>
            </template>

            <template v-else>
              <p class="admin-muted">
                Recommandé : sans elle, quiconque obtient votre mot de passe peut modérer, exporter les données
                personnelles et gérer les comptes. Il faut une application d'authentification sur votre téléphone.
              </p>
              <div v-if="deuxFacteurs.erreur" class="admin-form-erreur">{{ deuxFacteurs.erreur }}</div>
              <button
                type="button"
                class="admin-btn admin-btn--primary"
                :disabled="deuxFacteurs.enCours"
                @click="preparerDeuxFacteurs"
              >
                Configurer la double authentification
              </button>
            </template>
          </div>

          <div class="admin-panel">
            <h2 class="admin-panel-title">Changer mon mot de passe</h2>
            <form class="admin-form" @submit.prevent="changerMotDePasse">
              <div class="admin-form-field">
                <label for="mdp-actuel">Mot de passe actuel</label>
                <ChampMotDePasse
                  id="mdp-actuel"
                  v-model="motDePasseForm.actuel"
                  required
                  autocomplete="current-password"
                  classe-input=""
                />
              </div>
              <div class="admin-form-field">
                <label for="mdp-nouveau">Nouveau mot de passe</label>
                <ChampMotDePasse
                  id="mdp-nouveau"
                  v-model="motDePasseForm.nouveau"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  classe-input=""
                />
              </div>
              <div class="admin-form-field">
                <label for="mdp-confirmation">Confirmer le nouveau mot de passe</label>
                <ChampMotDePasse
                  id="mdp-confirmation"
                  v-model="motDePasseForm.confirmation"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  classe-input=""
                />
              </div>
              <div v-if="erreurMotDePasse" class="admin-form-erreur">{{ erreurMotDePasse }}</div>
              <div v-if="succesMotDePasse" class="admin-form-succes">Mot de passe modifié avec succès.</div>
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="changementEnCours">
                {{ changementEnCours ? 'Enregistrement...' : 'Changer le mot de passe' }}
              </button>
            </form>
          </div>

          <div class="admin-panel">
            <h2 class="admin-panel-title">Comptes admin</h2>
            <p v-if="adminStore.chargement" class="admin-muted">Chargement...</p>
            <table v-else class="admin-table mb-4">
              <thead>
                <tr>
                  <th>Identifiant</th>
                  <th>Double authentification</th>
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in adminStore.comptes" :key="c.id">
                  <td data-label="Identifiant">
                    {{ c.identifiant }}
                    <span v-if="c.identifiant === authStore.identifiant" class="admin-muted">(vous)</span>
                  </td>
                  <td data-label="Double authentification">
                    <span v-if="c.deuxFacteurs" class="admin-badge admin-badge--resolu">Activée</span>
                    <span v-else class="admin-badge admin-badge--signale">Non</span>
                  </td>
                  <td data-label="Créé le">{{ new Date(c.creeLe).toLocaleDateString('fr-FR') }}</td>
                  <td data-label="Actions" class="admin-actions">
                    <button
                      v-if="c.deuxFacteurs && c.identifiant !== authStore.identifiant"
                      type="button"
                      class="admin-btn admin-btn--ghost"
                      title="Si ce collègue a perdu son téléphone"
                      @click="reinitialiserDeuxFacteurs(c)"
                    >
                      Réinitialiser la 2FA
                    </button>
                    <button
                      v-if="c.identifiant !== authStore.identifiant"
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click="supprimerCompte(c)"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 class="admin-panel-subtitle">Ajouter un compte</h3>
            <form class="admin-form" @submit.prevent="creerCompte">
              <div class="admin-form-field">
                <label for="nouvel-identifiant">Identifiant</label>
                <input id="nouvel-identifiant" v-model="nouveauCompte.identifiant" type="text" required minlength="3" />
              </div>
              <div class="admin-form-field">
                <label for="nouveau-mdp">Mot de passe</label>
                <ChampMotDePasse
                  id="nouveau-mdp"
                  v-model="nouveauCompte.motDePasse"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  classe-input=""
                />
              </div>
              <div v-if="erreurNouveauCompte" class="admin-form-erreur">{{ erreurNouveauCompte }}</div>
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="creationEnCours">
                {{ creationEnCours ? 'Création...' : 'Créer le compte' }}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
