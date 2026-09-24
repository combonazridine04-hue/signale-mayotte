<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSignalementStore } from '../stores/signalementStore.js'
import { ajouterCoucheTuiles } from '../utils/tuiles.js'
import { CATEGORIES, COMMUNES, STATUTS } from '../models/signalement.js'

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

const filtres = ref({ commune: '', categorie: '', statut: '' })
const filtresActifs = computed(() => Boolean(filtres.value.commune || filtres.value.categorie || filtres.value.statut))

function reinitialiserFiltres() {
  filtres.value = { commune: '', categorie: '', statut: '' }
}

const signalementsLocalises = computed(() => signalementStore.signalements.filter((s) => s.latitude && s.longitude))

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

    L.marker([s.latitude, s.longitude], { icon: icone(s.statut) })
      .bindPopup(contenu)
      .addTo(couche)
  })
}

function rafraichir() {
  // 50 = plafond max accepté par l'API : la carte doit montrer le plus de signalements
  // possible, pas la page réduite utilisée par les listes paginées.
  return signalementStore.charger(filtres.value, 1, 50)
}

// Le chargement des signalements passe par le réseau. Sur l'hébergement gratuit le
// serveur peut mettre plusieurs secondes à se réveiller : on a largement le temps de
// quitter la page entre-temps. Sans ce drapeau, la suite s'exécutait quand même et
// Leaflet plantait sur « Map container not found », le conteneur ayant disparu.
let demonte = false

onMounted(async () => {
  await rafraichir()
  await nextTick()
  if (demonte || !conteneur.value) return

  carte = L.map(conteneur.value, { attributionControl: false }).setView(MAYOTTE, 11)
  ajouterCoucheTuiles(carte)
  couche = L.layerGroup().addTo(carte)

  dessinerMarqueurs()
})

watch(signalementsLocalises, dessinerMarqueurs)
watch(() => [filtres.value.commune, filtres.value.categorie, filtres.value.statut], rafraichir)

onBeforeUnmount(() => {
  demonte = true
  carte?.remove()
  carte = null
})
</script>

<template>
  <main class="carte-page">
    <div ref="conteneur" class="carte-plein-ecran"></div>

    <div class="carte-panneau card-glass">
      <p class="section-kicker mb-1">Carte des signalements</p>
      <p class="mb-2">
        <strong>{{ signalementsLocalises.length }}</strong> signalement{{
          signalementsLocalises.length > 1 ? 's' : ''
        }}
        localisé{{ signalementsLocalises.length > 1 ? 's' : '' }}
        <span v-if="signalementStore.totalFiltre > 50" class="text-secondary small d-block">
          (sur {{ signalementStore.totalFiltre }} correspondants au total, seuls les 50 premiers sont pris en compte)
        </span>
      </p>

      <div class="carte-filtres mb-2">
        <select v-model="filtres.commune" class="form-select form-select-sm mb-1" aria-label="Filtrer par commune">
          <option value="">Toutes les communes</option>
          <option v-for="commune in COMMUNES" :key="commune" :value="commune">{{ commune }}</option>
        </select>
        <select v-model="filtres.categorie" class="form-select form-select-sm mb-1" aria-label="Filtrer par catégorie">
          <option value="">Toutes les catégories</option>
          <option v-for="categorie in CATEGORIES" :key="categorie" :value="categorie">{{ categorie }}</option>
        </select>
        <select v-model="filtres.statut" class="form-select form-select-sm" aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
        </select>
        <button v-if="filtresActifs" type="button" class="btn btn-link btn-sm p-0 mt-1" @click="reinitialiserFiltres">
          Réinitialiser les filtres
        </button>
      </div>

      <p v-if="!signalementsLocalises.length" class="text-secondary small mb-2">
        Aucun signalement localisé {{ filtresActifs ? 'pour ces filtres' : 'pour le moment' }}.
      </p>
      <ul class="carte-legende">
        <li><span class="carte-marker-point carte-marker-signale"></span> Signalé</li>
        <li><span class="carte-marker-point carte-marker-en-cours"></span> En cours</li>
        <li><span class="carte-marker-point carte-marker-resolu"></span> Résolu</li>
      </ul>
    </div>
  </main>
</template>
