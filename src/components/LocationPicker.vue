<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MAYOTTE = [-12.8275, 45.1662]

const props = defineProps({
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null }
})
const emit = defineEmits(['update:latitude', 'update:longitude'])

const conteneur = ref(null)
const localisationEnCours = ref(false)
const erreurLocalisation = ref('')
let carte = null
let marqueur = null

function icone() {
  return L.divIcon({
    className: 'carte-marker',
    html: '<span class="carte-marker-point carte-marker-accent"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  })
}

function placerMarqueur(lat, lon) {
  if (!marqueur) {
    marqueur = L.marker([lat, lon], { icon: icone(), draggable: true }).addTo(carte)
    marqueur.on('dragend', () => {
      const position = marqueur.getLatLng()
      emit('update:latitude', Number(position.lat.toFixed(6)))
      emit('update:longitude', Number(position.lng.toFixed(6)))
    })
  } else {
    marqueur.setLatLng([lat, lon])
  }
}

function definirPosition(lat, lon) {
  placerMarqueur(lat, lon)
  emit('update:latitude', Number(lat.toFixed(6)))
  emit('update:longitude', Number(lon.toFixed(6)))
}

const utiliserPositionActuelle = () => {
  if (!navigator.geolocation) {
    erreurLocalisation.value = "La géolocalisation n'est pas disponible sur cet appareil."
    return
  }

  localisationEnCours.value = true
  erreurLocalisation.value = ''

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords
      definirPosition(latitude, longitude)
      carte.setView([latitude, longitude], 15)
      localisationEnCours.value = false
    },
    () => {
      erreurLocalisation.value = 'Position indisponible. Cliquez directement sur la carte.'
      localisationEnCours.value = false
    }
  )
}

onMounted(() => {
  const centre = props.latitude && props.longitude ? [props.latitude, props.longitude] : MAYOTTE
  carte = L.map(conteneur.value, { attributionControl: false }).setView(centre, props.latitude ? 15 : 11)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(carte)

  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(carte)

  if (props.latitude && props.longitude) {
    placerMarqueur(props.latitude, props.longitude)
  }

  carte.on('click', (event) => {
    definirPosition(event.latlng.lat, event.latlng.lng)
  })
})

watch(
  () => [props.latitude, props.longitude],
  ([lat, lon]) => {
    if (lat && lon && carte) {
      placerMarqueur(lat, lon)
    }
  }
)

onBeforeUnmount(() => {
  carte?.remove()
})
</script>

<template>
  <div>
    <div ref="conteneur" class="location-picker-map"></div>
    <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
      <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="localisationEnCours" @click="utiliserPositionActuelle">
        {{ localisationEnCours ? 'Localisation...' : 'Utiliser ma position actuelle' }}
      </button>
      <span v-if="latitude && longitude" class="text-secondary small">
        {{ latitude.toFixed(5) }}, {{ longitude.toFixed(5) }}
      </span>
      <span v-else class="text-secondary small">Cliquez sur la carte pour indiquer un lieu (facultatif)</span>
    </div>
    <p v-if="erreurLocalisation" class="text-secondary small mb-0 mt-1">{{ erreurLocalisation }}</p>
  </div>
</template>

<style scoped>
.location-picker-map {
  height: 220px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}
</style>
