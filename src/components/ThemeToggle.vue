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

<style scoped>
.theme-toggle {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1030;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--nav-border);
  border-radius: 50%;
  background: var(--nav-bg);
  color: var(--text-muted);
  cursor: pointer;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  transition: color 0.2s ease, background-color 0.2s ease;
}

.theme-toggle svg {
  width: 22px;
  height: 22px;
}

.theme-toggle:hover {
  color: var(--text-main);
}

.theme-toggle.active {
  color: var(--accent);
  background: rgba(34, 197, 94, 0.18);
}

@media (max-width: 575.98px) {
  .theme-toggle {
    right: 16px;
    bottom: 16px;
    width: 42px;
    height: 42px;
  }
}
</style>
