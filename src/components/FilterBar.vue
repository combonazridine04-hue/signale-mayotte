<script setup>
import { computed } from 'vue'
import { CATEGORIES, COMMUNES, STATUTS } from '../models/signalement.js'

const filtres = defineModel({
  default: () => ({ commune: '', categorie: '', statut: '', recherche: '', tri: 'recent' })
})

const filtresActifs = computed(() => {
  return Boolean(
    filtres.value.commune || filtres.value.categorie || filtres.value.statut || filtres.value.recherche || filtres.value.tri !== 'recent'
  )
})

const reinitialiser = () => {
  filtres.value.commune = ''
  filtres.value.categorie = ''
  filtres.value.statut = ''
  filtres.value.recherche = ''
  filtres.value.tri = 'recent'
}
</script>

<template>
  <div class="filter-bar row g-3 align-items-end">
    <div class="col-12 col-md-6">
      <label class="form-label" for="filtre-recherche">Recherche</label>
      <input
        id="filtre-recherche"
        v-model="filtres.recherche"
        type="search"
        class="form-control"
        placeholder="Rechercher par mot-clé, commune, catégorie..."
      />
    </div>

    <div class="col-6 col-md-3">
      <label class="form-label" for="filtre-commune">Commune</label>
      <select id="filtre-commune" v-model="filtres.commune" class="form-select">
        <option value="">Toutes les communes</option>
        <option v-for="commune in COMMUNES" :key="commune" :value="commune">{{ commune }}</option>
      </select>
    </div>

    <div class="col-6 col-md-3">
      <label class="form-label" for="filtre-categorie">Catégorie</label>
      <select id="filtre-categorie" v-model="filtres.categorie" class="form-select">
        <option value="">Toutes les catégories</option>
        <option v-for="categorie in CATEGORIES" :key="categorie" :value="categorie">{{ categorie }}</option>
      </select>
    </div>

    <div class="col-6 col-md-4">
      <label class="form-label" for="filtre-statut">Statut</label>
      <select id="filtre-statut" v-model="filtres.statut" class="form-select">
        <option value="">Tous les statuts</option>
        <option v-for="statut in STATUTS" :key="statut" :value="statut">{{ statut }}</option>
      </select>
    </div>

    <div class="col-6 col-md-4">
      <label class="form-label" for="filtre-tri">Trier par</label>
      <select id="filtre-tri" v-model="filtres.tri" class="form-select">
        <option value="recent">Plus récents</option>
        <option value="ancien">Plus anciens</option>
        <option value="populaire">Plus soutenus</option>
      </select>
    </div>

    <div class="col-12 col-md-4">
      <button
        type="button"
        class="btn btn-outline-secondary w-100"
        :disabled="!filtresActifs"
        @click="reinitialiser"
      >
        Réinitialiser les filtres
      </button>
    </div>
  </div>
</template>
