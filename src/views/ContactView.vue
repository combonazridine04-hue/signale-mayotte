<script setup>
import { computed, reactive, ref } from 'vue'
import { apiFetch } from '../utils/api.js'

const formulaire = reactive({
  nom: '',
  email: '',
  sujet: '',
  message: '',
  site_web: ''
})

const envoye = ref(false)
const envoiEnCours = ref(false)
const succes = ref(false)
const erreurEnvoi = ref('')
const erreurs = computed(() => ({
  nom: formulaire.nom.trim().length < 2,
  email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulaire.email),
  sujet: formulaire.sujet === '',
  message: formulaire.message.trim().length < 10
}))

const formulaireValide = computed(() => !Object.values(erreurs.value).some(Boolean))

const envoyer = async () => {
  envoye.value = true
  succes.value = false
  erreurEnvoi.value = ''
  if (!formulaireValide.value) return

  envoiEnCours.value = true
  try {
    const reponse = await apiFetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formulaire)
    })
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}))
      throw new Error(corps.erreur || `Erreur serveur (${reponse.status})`)
    }

    succes.value = true
    envoye.value = false
    formulaire.nom = ''
    formulaire.email = ''
    formulaire.sujet = ''
    formulaire.message = ''
  } catch (e) {
    erreurEnvoi.value = e.message
  } finally {
    envoiEnCours.value = false
  }
}
</script>

<template>
  <main class="py-5">
    <div class="container">
      <div class="row g-5">
        <div class="col-12 col-lg-5">
          <p class="section-kicker">Contact</p>
          <h1 class="fw-bold">Contacter la mairie</h1>
          <p class="text-secondary">
            Une question sur un signalement ou sur la plateforme ? Écrivez-nous.
          </p>
          <div class="contact-panel mt-4">
            <p class="mb-1"><strong>Email :</strong> contact@signale-mayotte.yt</p>
            <p class="mb-1"><strong>Téléphone :</strong> 02 69 00 00 00</p>
            <p class="mb-0"><strong>Adresse :</strong> Mamoudzou, Mayotte</p>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <form class="card-glass rounded p-4 shadow-sm" novalidate @submit.prevent="envoyer">
            <div class="mb-3">
              <label for="nom" class="form-label">Nom complet</label>
              <input id="nom" v-model="formulaire.nom" type="text" maxlength="100" class="form-control" :class="{ 'is-invalid': envoye && erreurs.nom }">
              <div class="invalid-feedback">Le nom doit contenir au moins 2 caractères.</div>
            </div>

            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <input id="email" v-model="formulaire.email" type="email" class="form-control" :class="{ 'is-invalid': envoye && erreurs.email }">
              <div class="invalid-feedback">Veuillez saisir une adresse email valide.</div>
            </div>

            <div class="mb-3">
              <label for="sujet" class="form-label">Sujet</label>
              <select id="sujet" v-model="formulaire.sujet" class="form-select" :class="{ 'is-invalid': envoye && erreurs.sujet }">
                <option value="">Choisir un sujet</option>
                <option>Question sur un signalement</option>
                <option>Problème technique</option>
                <option>Suggestion</option>
                <option>Autre demande</option>
              </select>
              <div class="invalid-feedback">Veuillez sélectionner un sujet.</div>
            </div>

            <div class="mb-3">
              <label for="message" class="form-label">Message</label>
              <textarea id="message" v-model="formulaire.message" rows="5" maxlength="3000" class="form-control" :class="{ 'is-invalid': envoye && erreurs.message }"></textarea>
              <div class="invalid-feedback">Le message doit contenir au moins 10 caractères.</div>
            </div>

            <div class="honeypot-field" aria-hidden="true">
              <label for="contact-site-web">Site web</label>
              <input id="contact-site-web" v-model="formulaire.site_web" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <div v-if="succes" class="alert alert-success">
              Votre message a bien été envoyé.
            </div>
            <div v-if="erreurEnvoi" class="alert alert-danger py-2">{{ erreurEnvoi }}</div>

            <button type="submit" class="btn btn-primary btn-lg" :disabled="envoiEnCours">
              {{ envoiEnCours ? 'Envoi en cours...' : 'Envoyer' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
