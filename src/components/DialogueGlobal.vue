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

<style scoped>
.dialogue-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(10, 6, 5, 0.6);
  backdrop-filter: blur(2px);
}

.dialogue-card {
  width: 100%;
  max-width: 380px;
  padding: 1.5rem;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.dialogue-message {
  margin: 0 0 1.25rem;
  color: #0f172a;
  font-size: 0.95rem;
  line-height: 1.5;
}

.dialogue-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.dialogue-btn {
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
}

.dialogue-btn--ghost {
  background: #f1f5f9;
  color: #334155;
}

.dialogue-btn--ghost:hover {
  background: #e2e8f0;
}

.dialogue-btn--danger {
  background: #dc3545;
  color: #ffffff;
}

.dialogue-btn--danger:hover {
  background: #c1121f;
}

.dialogue-btn--primary {
  background: #16a34a;
  color: #ffffff;
}

.dialogue-btn--primary:hover {
  background: #15803d;
}
</style>
