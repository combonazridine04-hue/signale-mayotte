<script setup>
import { computed, onMounted, ref } from 'vue'

const stats = ref(null)
const chargement = ref(true)
const erreur = ref('')

onMounted(async () => {
  try {
    const reponse = await fetch('/api/signalements/stats-publiques')
    if (!reponse.ok) throw new Error()
    stats.value = await reponse.json()
  } catch {
    erreur.value = "Impossible de charger les statistiques."
  } finally {
    chargement.value = false
  }
})

const maxCommune = computed(() => Math.max(1, ...(stats.value?.parCommune || []).map((c) => c.count)))

const tauxResolution = computed(() => {
  if (!stats.value || !stats.value.parStatut.total) return 0
  return Math.round((stats.value.parStatut.resolu / stats.value.parStatut.total) * 100)
})
</script>

<template>
  <main class="py-5">
    <div class="container">
      <p class="section-kicker">Transparence</p>
      <h1 class="fw-bold mb-2">Suivi des signalements</h1>
      <p class="text-secondary mb-5">
        Ces chiffres sont mis à jour en temps réel à partir des signalements reçus par la plateforme.
      </p>

      <p v-if="chargement" class="text-secondary">Chargement...</p>
      <div v-else-if="erreur" class="alert alert-danger">{{ erreur }}</div>

      <template v-else-if="stats">
        <div class="row g-4 mb-5">
          <div class="col-6 col-lg-3">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">Total</p>
              <p class="transparence-valeur">{{ stats.parStatut.total }}</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">Signalés</p>
              <p class="transparence-valeur transparence-valeur--signale">{{ stats.parStatut.signale }}</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">En cours</p>
              <p class="transparence-valeur transparence-valeur--en-cours">{{ stats.parStatut.enCours }}</p>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">Résolus</p>
              <p class="transparence-valeur transparence-valeur--resolu">{{ stats.parStatut.resolu }}</p>
            </div>
          </div>
        </div>

        <div class="row g-4 mb-5">
          <div class="col-12 col-lg-6">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">Taux de résolution</p>
              <p class="transparence-valeur transparence-valeur--resolu mb-0">{{ tauxResolution }}%</p>
            </div>
          </div>
          <div class="col-12 col-lg-6">
            <div class="card-glass rounded p-4 h-100">
              <p class="text-secondary small mb-1">Délai moyen de résolution</p>
              <p class="transparence-valeur mb-0">
                {{ stats.delaiMoyenResolutionJours !== null ? `${stats.delaiMoyenResolutionJours} j` : '—' }}
              </p>
            </div>
          </div>
        </div>

        <div class="card-glass rounded p-4">
          <h2 class="h5 fw-bold mb-4">Signalements par commune</h2>
          <div v-if="!stats.parCommune.length" class="text-secondary">Aucune donnée pour le moment.</div>
          <div v-else class="d-flex flex-column gap-3">
            <div v-for="c in stats.parCommune" :key="c.commune" class="transparence-barre-ligne">
              <div class="d-flex justify-content-between mb-1">
                <span>{{ c.commune }}</span>
                <span class="text-secondary">{{ c.count }}</span>
              </div>
              <div class="transparence-barre-piste">
                <div class="transparence-barre-remplissage" :style="{ width: `${(c.count / maxCommune) * 100}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.transparence-valeur {
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--app-text);
}

.transparence-valeur--signale {
  color: #f87171;
}

.transparence-valeur--en-cours {
  color: #fbbf24;
}

.transparence-valeur--resolu {
  color: #4ade80;
}

.transparence-barre-piste {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.transparence-barre-remplissage {
  height: 100%;
  min-width: 4px;
  border-radius: 999px;
  background: var(--app-primary);
}
</style>
