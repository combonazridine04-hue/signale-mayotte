<script setup>
import { computed, ref } from 'vue'

const MAX_PHOTOS = 5

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  existantes: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'update:existantes'])

const inputPhoto = ref(null)
const surGlisser = ref(false)
const apercus = ref([]) // { url, fichier } pour les nouveaux fichiers

const nbTotal = computed(() => props.existantes.length + apercus.value.length)
const complet = computed(() => nbTotal.value >= MAX_PHOTOS)

function ajouterFichiers(liste) {
  const disponibles = MAX_PHOTOS - nbTotal.value
  const fichiersImages = Array.from(liste)
    .filter((f) => f.type.startsWith('image/'))
    .slice(0, Math.max(0, disponibles))

  for (const fichier of fichiersImages) {
    apercus.value.push({ url: URL.createObjectURL(fichier), fichier })
  }
  emit('update:modelValue', apercus.value.map((a) => a.fichier))
}

const declencherSelection = () => {
  if (!complet.value) inputPhoto.value.click()
}

const choisirPhotos = (event) => {
  ajouterFichiers(event.target.files)
  event.target.value = ''
}

const deposerPhotos = (event) => {
  surGlisser.value = false
  ajouterFichiers(event.dataTransfer.files)
}

function retirerNouvelle(index) {
  apercus.value.splice(index, 1)
  emit('update:modelValue', apercus.value.map((a) => a.fichier))
}

function retirerExistante(url) {
  emit('update:existantes', props.existantes.filter((u) => u !== url))
}
</script>

<template>
  <div>
    <div
      class="photo-dropzone"
      :class="{ dragover: surGlisser, 'photo-dropzone--complet': complet }"
      role="button"
      tabindex="0"
      aria-label="Ajouter des photos"
      @click="declencherSelection"
      @keydown.enter="declencherSelection"
      @dragover.prevent="!complet && (surGlisser = true)"
      @dragleave.prevent="surGlisser = false"
      @drop.prevent="deposerPhotos"
    >
      <input ref="inputPhoto" type="file" accept="image/*" multiple class="d-none" @change="choisirPhotos" />

      <svg class="photo-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="M21 15l-5-5-4 4-3-3-6 6" />
      </svg>
      <p class="mb-0">{{ complet ? `Maximum ${MAX_PHOTOS} photos atteint` : 'Cliquez ou glissez des photos ici' }}</p>
      <p class="text-secondary small mb-0">JPG, PNG... 5 Mo par photo, {{ MAX_PHOTOS }} photos max ({{ nbTotal }}/{{ MAX_PHOTOS }})</p>
    </div>

    <div v-if="nbTotal" class="photo-dropzone-grille">
      <div v-for="url in existantes" :key="url" class="photo-dropzone-vignette">
        <img :src="url" alt="Photo existante" />
        <button type="button" class="photo-dropzone-retirer" aria-label="Retirer la photo" @click="retirerExistante(url)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div v-for="(apercu, index) in apercus" :key="apercu.url" class="photo-dropzone-vignette">
        <img :src="apercu.url" alt="Nouvelle photo" />
        <button type="button" class="photo-dropzone-retirer" aria-label="Retirer la photo" @click="retirerNouvelle(index)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
