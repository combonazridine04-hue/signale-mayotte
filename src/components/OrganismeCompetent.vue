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
      <a :href="organisme.site" target="_blank" rel="noopener noreferrer">{{
        organisme.site.replace('https://', '')
      }}</a>
    </p>
    <p v-if="organisme.note" class="organisme-competent-note mb-0">{{ organisme.note }}</p>
  </div>
</template>
