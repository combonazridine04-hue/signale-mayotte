<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCitoyenStore } from '../stores/citoyenStore.js'
import { dateRelative } from '../utils/dates.js'

const route = useRoute()
const router = useRouter()
const citoyenStore = useCitoyenStore()

const ouvert = ref(false)
const conteneur = ref(null)

const basculer = () => {
  ouvert.value = !ouvert.value
  if (ouvert.value) {
    citoyenStore.chargerNotifications().then(() => citoyenStore.marquerNotificationsLues())
  }
}

const ouvrirNotification = (notification) => {
  ouvert.value = false
  if (notification.signalementId) router.push(`/signalements/${notification.signalementId}`)
}

// Fermeture au clic extérieur : sans ça le panneau reste ouvert par-dessus la page.
const surClicExterieur = (event) => {
  if (ouvert.value && conteneur.value && !conteneur.value.contains(event.target)) ouvert.value = false
}

onMounted(() => {
  document.addEventListener('click', surClicExterieur)
  citoyenStore.chargerNotifications()
})

// La barre de navigation ne se remonte jamais : sans ça, le compteur resterait figé
// pendant toute la session.
watch(() => route.fullPath, () => citoyenStore.chargerNotifications())

onUnmounted(() => document.removeEventListener('click', surClicExterieur))
</script>

<template>
  <div ref="conteneur" class="cloche">
    <button
      type="button"
      class="icon-pill-link"
      :aria-label="citoyenStore.notificationsNonLues
        ? `Notifications (${citoyenStore.notificationsNonLues} non lues)`
        : 'Notifications'"
      :aria-expanded="ouvert"
      @click="basculer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span v-if="citoyenStore.notificationsNonLues" class="cloche-pastille">
        {{ citoyenStore.notificationsNonLues > 9 ? '9+' : citoyenStore.notificationsNonLues }}
      </span>
      <span v-if="!ouvert" class="nav-infobulle">Notifications</span>
    </button>

    <div v-if="ouvert" class="cloche-panneau">
      <p class="cloche-titre">Notifications</p>

      <p v-if="!citoyenStore.notifications.length" class="cloche-vide">
        Aucune notification pour le moment.
      </p>

      <ul v-else class="cloche-liste">
        <li v-for="n in citoyenStore.notifications" :key="n.id">
          <button type="button" class="cloche-item" @click="ouvrirNotification(n)">
            <span class="cloche-item-texte">{{ n.texte }}</span>
            <span class="cloche-item-date">{{ dateRelative(n.dateCreation) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
