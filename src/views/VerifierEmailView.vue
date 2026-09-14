<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const chargement = ref(true)
const succes = ref(false)
const erreur = ref('')

onMounted(async () => {
  try {
    const reponse = await fetch(`/api/auth/verifier-email?token=${encodeURIComponent(route.query.token || '')}`)
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}))
      erreur.value = corps.erreur || 'Lien invalide.'
    } else {
      succes.value = true
    }
  } catch {
    erreur.value = "Impossible de contacter le serveur."
  } finally {
    chargement.value = false
  }
})
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-6 text-center">
          <div class="card-glass rounded p-4 shadow-sm">
            <p v-if="chargement" class="mb-0">Vérification en cours...</p>
            <template v-else-if="succes">
              <h1 class="h4 fw-bold text-success mb-2">Email confirmé !</h1>
              <p class="text-secondary mb-3">Vous pouvez maintenant envoyer des signalements.</p>
              <RouterLink to="/signaler" class="btn btn-primary">Faire un signalement</RouterLink>
            </template>
            <template v-else>
              <h1 class="h4 fw-bold text-danger mb-2">Lien invalide</h1>
              <p class="text-secondary mb-3">{{ erreur }}</p>
              <RouterLink to="/" class="btn btn-outline-secondary">Retour à l'accueil</RouterLink>
            </template>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
