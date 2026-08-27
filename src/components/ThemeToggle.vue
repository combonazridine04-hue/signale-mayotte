<script setup>
import { onMounted, ref, watch } from 'vue'

const STORAGE_KEY = 'signale-mayotte-theme-couleur'
const actif = ref(true)

function appliquer() {
  document.body.classList.toggle('theme-noir', !actif.value)
}

onMounted(() => {
  const stocke = localStorage.getItem(STORAGE_KEY)
  actif.value = stocke === null ? true : stocke === '1'
  appliquer()
})

watch(actif, () => {
  appliquer()
  localStorage.setItem(STORAGE_KEY, actif.value ? '1' : '0')
})

const basculer = () => {
  actif.value = !actif.value
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ active: actif }"
    aria-label="Changer l'ambiance du fond"
    title="Changer l'ambiance du fond"
    @click="basculer"
  >
    <svg v-if="actif" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  </button>
</template>
