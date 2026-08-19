<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { useSignalementStore } from '../../stores/signalementStore.js'
import { useContactStore } from '../../stores/contactStore.js'
import { useAdminStore } from '../../stores/adminStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { STATUTS } from '../../models/signalement.js'
import { apiFetch } from '../../utils/api.js'

const router = useRouter()
const authStore = useAuthStore()
const signalementStore = useSignalementStore()
const contactStore = useContactStore()
const adminStore = useAdminStore()
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

onMounted(() => {
  signalementStore.charger()
  signalementStore.chargerStats()
  contactStore.charger()
  adminStore.charger()
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

function pagePrecedente() {
  if (signalementStore.page > 1) signalementStore.charger({}, signalementStore.page - 1)
}

function pageSuivante() {
  if (signalementStore.page < nbPages.value) signalementStore.charger({}, signalementStore.page + 1)
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
      await signalementStore.charger({}, signalementStore.page - 1)
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
          <svg v-if="!menuMobileOuvert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <nav class="admin-nav">
        <button type="button" class="admin-nav-item" :class="{ active: section === 'apercu' }" @click="choisirSection('apercu')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 16.5h.01" />
          </svg>
          Signalements
          <span v-if="compteurs.signale" class="admin-nav-badge">{{ compteurs.signale }}</span>
        </button>
        <button type="button" class="admin-nav-item" :class="{ active: section === 'messages' }" @click="choisirSection('messages')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4a8.4 8.4 0 0 1-1-4A8.38 8.38 0 0 1 11.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
          </svg>
          Messages
          <span v-if="messagesNonLus" class="admin-nav-badge">{{ messagesNonLus }}</span>
        </button>
        <button type="button" class="admin-nav-item" :class="{ active: section === 'comptes' }" @click="choisirSection('comptes')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4.5 20c1.2-3.5 4-5.5 7.5-5.5s6.3 2 7.5 5.5" />
          </svg>
          Comptes
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
            { apercu: 'Aperçu', signalements: 'Signalements', messages: 'Messages', comptes: 'Comptes' }[section]
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
                  <td data-label="Statut"><span class="admin-badge" :class="`admin-badge--${s.statut === 'Signalé' ? 'signale' : s.statut === 'En cours' ? 'en-cours' : 'resolu'}`">{{ s.statut }}</span></td>
                  <td data-label="Date">{{ new Date(s.dateSignalement).toLocaleDateString('fr-FR') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="section === 'signalements'" class="admin-panel">
          <p v-if="signalementStore.chargement" class="admin-muted">Chargement...</p>
          <p v-else-if="!signalementStore.signalements.length" class="admin-muted">Aucun signalement.</p>
          <table v-else class="admin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Commune</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in signalementStore.signalements" :key="s.id">
                <td data-label="Catégorie">{{ s.categorie }}</td>
                <td data-label="Commune">{{ s.commune }}</td>
                <td data-label="Statut">
                  <select
                    class="admin-select"
                    :value="s.statut"
                    @change="changerStatut(s.id, $event.target.value)"
                  >
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
            <button type="button" class="admin-btn admin-btn--ghost" :disabled="signalementStore.page <= 1" @click="pagePrecedente">
              ← Précédent
            </button>
            <span class="admin-muted small">Page {{ signalementStore.page }} / {{ nbPages }}</span>
            <button type="button" class="admin-btn admin-btn--ghost" :disabled="signalementStore.page >= nbPages" @click="pageSuivante">
              Suivant →
            </button>
          </div>
        </div>

        <div v-else-if="section === 'messages'" class="admin-panel">
          <p v-if="contactStore.chargement" class="admin-muted">Chargement...</p>
          <p v-else-if="!contactStore.messages.length" class="admin-muted">Aucun message reçu.</p>
          <div v-else class="admin-messages">
            <div v-for="m in contactStore.messages" :key="m.id" class="admin-message" :class="{ 'admin-message--lu': m.lu }">
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

        <div v-else class="d-flex flex-column gap-4">
          <div class="admin-panel">
            <h2 class="admin-panel-title">Changer mon mot de passe</h2>
            <form class="admin-form" @submit.prevent="changerMotDePasse">
              <div class="admin-form-field">
                <label for="mdp-actuel">Mot de passe actuel</label>
                <input id="mdp-actuel" v-model="motDePasseForm.actuel" type="password" required autocomplete="current-password" />
              </div>
              <div class="admin-form-field">
                <label for="mdp-nouveau">Nouveau mot de passe</label>
                <input id="mdp-nouveau" v-model="motDePasseForm.nouveau" type="password" required minlength="8" autocomplete="new-password" />
              </div>
              <div class="admin-form-field">
                <label for="mdp-confirmation">Confirmer le nouveau mot de passe</label>
                <input id="mdp-confirmation" v-model="motDePasseForm.confirmation" type="password" required minlength="8" autocomplete="new-password" />
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
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in adminStore.comptes" :key="c.id">
                  <td data-label="Identifiant">{{ c.identifiant }} <span v-if="c.identifiant === authStore.identifiant" class="admin-muted">(vous)</span></td>
                  <td data-label="Créé le">{{ new Date(c.creeLe).toLocaleDateString('fr-FR') }}</td>
                  <td data-label="Actions">
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
                <input id="nouveau-mdp" v-model="nouveauCompte.motDePasse" type="password" required minlength="8" autocomplete="new-password" />
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

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  display: flex;
  background: #f4f5f7;
  color: #0f172a;
}

.admin-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111827;
  color: #e2e8f0;
  padding: 1.5rem 1rem;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.4rem 1.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-brand-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}

.admin-brand-icon svg {
  width: 18px;
  height: 18px;
}

.admin-brand-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #f8fafc;
}

.admin-brand-subtitle {
  margin: 0;
  font-size: 0.72rem;
  color: #94a3b8;
}

.admin-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-menu-toggle {
  display: none;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  cursor: pointer;
}

.admin-menu-toggle svg {
  width: 20px;
  height: 20px;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #cbd5e1;
  font-size: 0.88rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.admin-nav-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.admin-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

.admin-nav-item.active {
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
}

.admin-nav-badge {
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #dc3545;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  line-height: 20px;
}

.admin-sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-sidebar-user {
  margin: 0 0 0.25rem;
  padding: 0 0.75rem;
  font-size: 0.78rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-sidebar-link {
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.85rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.admin-sidebar-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
}

.admin-logout {
  color: #f87171;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.admin-header h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
}

.admin-content {
  flex: 1;
  padding: 2rem;
  overflow-x: auto;
}

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.admin-stat-tile {
  position: relative;
  padding: 1.1rem 1.25rem 1.25rem;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.admin-stat-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-bottom: 0.6rem;
}

.admin-stat-dot--neutre {
  background: #64748b;
}

.admin-stat-dot--signale {
  background: #dc3545;
}

.admin-stat-dot--en-cours {
  background: #f59e0b;
}

.admin-stat-dot--resolu {
  background: #22c55e;
}

.admin-stat-value {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
}

.admin-stat-label {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.admin-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.admin-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.admin-panel-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.admin-panel-title {
  margin: 0 0 1.25rem;
  font-size: 1rem;
  font-weight: 700;
}

.admin-panel-subtitle {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
}

.admin-form {
  max-width: 360px;
}

.admin-form-field {
  margin-bottom: 1rem;
}

.admin-form-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.admin-form-field input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid #d8dce3;
  border-radius: 8px;
  font-size: 0.9rem;
  background: #f9fafb;
  color: #0f172a;
}

.admin-form-field input:focus {
  outline: none;
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.16);
  background: #ffffff;
}

.admin-form-erreur {
  margin-bottom: 1rem;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: rgba(220, 53, 69, 0.1);
  color: #b91c1c;
  font-size: 0.82rem;
}

.admin-form-succes {
  margin-bottom: 1rem;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  font-size: 0.82rem;
}

.admin-btn--primary {
  background: #16a34a;
  color: #ffffff;
  border: none;
}

.admin-btn--primary:hover:not(:disabled) {
  background: #15803d;
}

.admin-btn--primary:disabled {
  opacity: 0.7;
  cursor: default;
}

.admin-link-button {
  border: none;
  background: none;
  color: #16a34a;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.admin-muted {
  color: #64748b;
  margin: 0;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.admin-table th {
  text-align: left;
  padding: 0.5rem 0.6rem;
  color: #64748b;
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-bottom: 1px solid #e2e8f0;
}

.admin-table td {
  padding: 0.65rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.admin-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.admin-badge--signale {
  background: rgba(220, 53, 69, 0.12);
  color: #dc3545;
}

.admin-badge--en-cours {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.admin-badge--resolu {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.admin-select {
  padding: 0.3rem 0.5rem;
  border: 1px solid #d8dce3;
  border-radius: 6px;
  font-size: 0.82rem;
  background: #f9fafb;
  color: #0f172a;
}

.admin-actions {
  display: flex;
  gap: 0.5rem;
}

.admin-btn {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
}

.admin-btn--ghost {
  background: #f1f5f9;
  color: #334155;
}

.admin-btn--ghost:hover {
  background: #e2e8f0;
}

.admin-btn--danger {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.admin-btn--danger:hover {
  background: rgba(220, 53, 69, 0.18);
}

.admin-messages {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.admin-message {
  padding: 1rem 1.1rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.admin-message--lu {
  opacity: 0.65;
}

.admin-message-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.admin-message-meta {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: #64748b;
}

.admin-message-body {
  margin: 0.6rem 0 0;
  font-size: 0.9rem;
  color: #1e293b;
  white-space: pre-wrap;
}

@media (max-width: 767.98px) {
  .admin-dashboard {
    flex-direction: column;
  }

  .admin-sidebar {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    padding: 0.65rem 0.85rem;
  }

  .admin-brand {
    padding: 0;
    margin: 0;
    border-bottom: none;
  }

  .admin-brand-subtitle {
    display: none;
  }

  .admin-menu-toggle {
    display: flex;
  }

  .admin-nav,
  .admin-sidebar-footer {
    display: none;
  }

  .admin-sidebar--ouvert .admin-nav {
    display: flex;
    flex-direction: column;
    flex: none;
    gap: 0.25rem;
    margin-top: 0.85rem;
  }

  .admin-nav-item {
    width: 100%;
  }

  .admin-sidebar--ouvert .admin-sidebar-footer {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    margin-top: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .admin-sidebar-link {
    padding: 0.55rem 0.6rem;
  }

  .admin-header {
    padding: 1rem 1.1rem;
  }

  .admin-header h1 {
    font-size: 1.1rem;
  }

  .admin-content {
    padding: 1.1rem;
  }

  .admin-panel {
    padding: 1.1rem;
  }

  .admin-form {
    max-width: none;
  }

  .admin-table thead {
    display: none;
  }

  .admin-table,
  .admin-table tbody,
  .admin-table tr,
  .admin-table td {
    display: block;
    width: 100%;
  }

  .admin-table tr {
    margin-bottom: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.3rem 0.85rem;
  }

  .admin-table tr:last-child {
    margin-bottom: 0;
  }

  .admin-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid #f1f5f9;
    text-align: right;
  }

  .admin-table td:last-child {
    border-bottom: none;
  }

  .admin-table td::before {
    content: attr(data-label);
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: #64748b;
    text-align: left;
  }

  .admin-table td .admin-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}
</style>
