<script setup>
import { ref } from 'vue'

// Les attributs (id, class, autocomplete, maxlength...) doivent atterrir sur l'input,
// pas sur le conteneur, sinon les états de validation Bootstrap ne s'appliquent plus.
defineOptions({ inheritAttrs: false })

// L'espace admin a son propre thème : on doit pouvoir ne pas lui imposer Bootstrap.
defineProps({ classeInput: { type: String, default: 'form-control' } })

const modele = defineModel({ type: String, default: '' })
const visible = ref(false)
</script>

<template>
  <div class="champ-mdp">
    <input
      v-bind="$attrs"
      v-model="modele"
      :type="visible ? 'text' : 'password'"
      :class="classeInput"
    />

    <button
      type="button"
      class="champ-mdp-oeil"
      :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
      :title="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
      tabindex="-1"
      @click="visible = !visible"
    >
      <svg v-if="!visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.6-7 10-7c1.9 0 3.6.6 5 1.5" />
        <path d="M22 12s-3.6 7-10 7c-1.9 0-3.6-.6-5-1.5" />
        <path d="M4 4l16 16" />
      </svg>
    </button>

    <!-- Le message d'erreur reste un frère de l'input : Bootstrap l'affiche via `.is-invalid ~ .invalid-feedback`. -->
    <slot />
  </div>
</template>
