<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUiStore } from '../stores/uiStore.js'

const uiStore = useUiStore()

const boutonConfirmer = ref(null)
const boutonOk = ref(null)

watch(
  () => uiStore.confirmVisible,
  (visible) => {
    if (visible) nextTick(() => boutonConfirmer.value?.focus())
  }
)

watch(
  () => uiStore.alertVisible,
  (visible) => {
    if (visible) nextTick(() => boutonOk.value?.focus())
  }
)

function surEchap(event) {
  if (event.key !== 'Escape') return
  if (uiStore.confirmVisible) uiStore.repondreConfirmation(false)
  else if (uiStore.alertVisible) uiStore.fermerAlerte()
}

onMounted(() => document.addEventListener('keydown', surEchap))
onUnmounted(() => document.removeEventListener('keydown', surEchap))
</script>

<template>
  <Teleport to="body">
    <div v-if="uiStore.confirmVisible" class="dialogue-overlay" @click.self="uiStore.repondreConfirmation(false)">
      <div class="dialogue-card" role="alertdialog" aria-modal="true">
        <p class="dialogue-message">{{ uiStore.confirmMessage }}</p>
        <div class="dialogue-actions">
          <button type="button" class="dialogue-btn dialogue-btn--ghost" @click="uiStore.repondreConfirmation(false)">
            Annuler
          </button>
          <button
            ref="boutonConfirmer"
            type="button"
            class="dialogue-btn dialogue-btn--danger"
            @click="uiStore.repondreConfirmation(true)"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>

    <div v-if="uiStore.alertVisible" class="dialogue-overlay" @click.self="uiStore.fermerAlerte()">
      <div class="dialogue-card" role="alertdialog" aria-modal="true">
        <p class="dialogue-message">{{ uiStore.alertMessage }}</p>
        <div class="dialogue-actions">
          <button ref="boutonOk" type="button" class="dialogue-btn dialogue-btn--primary" @click="uiStore.fermerAlerte()">
            OK
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
