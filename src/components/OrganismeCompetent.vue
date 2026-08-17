<script setup>
defineProps({
  organisme: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="organisme-competent">
    <p class="organisme-competent-titre">📞 {{ organisme.nom }}</p>
    <p v-if="organisme.telephone" class="mb-1">
      Standard : <a :href="`tel:${organisme.telephone.replace(/\s/g, '')}`">{{ organisme.telephone }}</a>
    </p>
    <p v-if="organisme.urgence" class="mb-1">
      Urgence : <a :href="`tel:${organisme.urgence.replace(/\s/g, '')}`">{{ organisme.urgence }}</a>
    </p>
    <p v-if="organisme.site" class="mb-1">
      <a :href="organisme.site" target="_blank" rel="noopener noreferrer">{{ organisme.site.replace('https://', '') }}</a>
    </p>
    <p v-if="organisme.note" class="organisme-competent-note mb-0">{{ organisme.note }}</p>
  </div>
</template>

<style scoped>
.organisme-competent {
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.25);
  font-size: 0.88rem;
}

.organisme-competent-titre {
  margin: 0 0 6px;
  font-weight: 700;
  color: var(--app-text);
}

.organisme-competent a {
  color: var(--app-primary);
}

.organisme-competent-note {
  margin-top: 6px;
  color: var(--app-muted);
  font-size: 0.82rem;
}
</style>
