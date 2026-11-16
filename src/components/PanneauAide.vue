<script setup>
// Panneau de la colonne de gauche sur les pages à formulaire. Ces colonnes ne
// contenaient qu'un titre et deux lignes : tout le reste de la hauteur était vide
// pendant que le formulaire s'étirait à droite. On y met ce dont la personne a
// besoin AU MOMENT où elle remplit le formulaire, pas du remplissage décoratif.
defineProps({
  titre: { type: String, required: true },
  points: { type: Array, required: true },
  note: { type: String, default: '' }
})
</script>

<template>
  <aside class="panneau-aide">
    <p class="panneau-aide-titre">{{ titre }}</p>
    <ul class="panneau-aide-liste">
      <li v-for="point in points" :key="point.titre">
        <span class="panneau-aide-puce" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </span>
        <span>
          <strong>{{ point.titre }}</strong>
          <span class="panneau-aide-texte">{{ point.texte }}</span>
        </span>
      </li>
    </ul>
    <p v-if="note" class="panneau-aide-note">{{ note }}</p>
  </aside>
</template>
