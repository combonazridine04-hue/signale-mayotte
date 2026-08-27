<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSignalementStore } from '../stores/signalementStore.js'

const MAYOTTE = [-12.8275, 45.1662]

const CLASSES_STATUT = {
  Signalé: 'carte-marker-signale',
  'En cours': 'carte-marker-en-cours',
  Résolu: 'carte-marker-resolu'
}

const router = useRouter()
const signalementStore = useSignalementStore()

const conteneur = ref(null)
let carte = null
let couche = null

const signalementsLocalises = computed(() =>
  signalementStore.signalements.filter((s) => s.latitude && s.longitude)
)

function icone(statut) {
  const classe = CLASSES_STATUT[statut] || 'carte-marker-accent'
  return L.divIcon({
    className: 'carte-marker',
    html: `<span class="carte-marker-point ${classe}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  })
}

function dessinerMarqueurs() {
  if (!carte) return
  couche.clearLayers()

  signalementsLocalises.value.forEach((s) => {
    const contenu = document.createElement('div')
    contenu.className = 'carte-popup'
    contenu.innerHTML = `<strong>${s.categorie}</strong><br>${s.commune}<br>`

    const lien = document.createElement('a')
    lien.href = '#'
    lien.textContent = 'Voir le détail'
    lien.addEventListener('click', (event) => {
      event.preventDefault()
      router.push(`/signalements/${s.id}`)
    })
    contenu.appendChild(lien)

    L.marker([s.latitude, s.longitude], { icon: icone(s.statut) }).bindPopup(contenu).addTo(couche)
  })
}

onMounted(async () => {
  // 50 = plafond max accepté par l'API : la carte doit montrer le plus de signalements
  // possible, pas la page réduite utilisée par les listes paginées.
  await signalementStore.charger({}, 1, 50)
  await nextTick()

  carte = L.map(conteneur.value, { attributionControl: false }).setView(MAYOTTE, 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(carte)
  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(carte)
  couche = L.layerGroup().addTo(carte)

  dessinerMarqueurs()
})

watch(signalementsLocalises, dessinerMarqueurs)

onBeforeUnmount(() => {
  carte?.remove()
})
</script>

<template>
  <main class="carte-page">
    <div ref="conteneur" class="carte-plein-ecran"></div>

    <div class="carte-panneau card-glass">
      <p class="section-kicker mb-1">Carte des signalements</p>
      <p class="mb-2">
        <strong>{{ signalementsLocalises.length }}</strong> / {{ signalementStore.signalements.length }} signalement{{ signalementStore.signalements.length > 1 ? 's' : '' }} localisé{{ signalementsLocalises.length > 1 ? 's' : '' }}
      </p>
      <p v-if="!signalementsLocalises.length" class="text-secondary small mb-2">
        Aucun signalement localisé pour le moment. Indiquez un lieu en signalant un problème pour qu'il apparaisse ici.
      </p>
      <ul class="carte-legende">
        <li><span class="carte-marker-point carte-marker-signale"></span> Signalé</li>
        <li><span class="carte-marker-point carte-marker-en-cours"></span> En cours</li>
        <li><span class="carte-marker-point carte-marker-resolu"></span> Résolu</li>
      </ul>
    </div>
  </main>
</template>
