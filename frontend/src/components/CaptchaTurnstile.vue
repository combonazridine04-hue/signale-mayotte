<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { apiFetch } from '../utils/api.js'

// Widget anti-robot Cloudflare Turnstile. Il remet au formulaire un jeton à usage unique
// (v-model), que le serveur fait valider par Cloudflare avant de traiter la demande.
// Si le serveur n'a pas de clés configurées, le composant n'affiche rien.

defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Partagés entre tous les formulaires : la configuration est demandée une fois, le script
// n'est chargé qu'une fois par page.
let configPromesse = null
let scriptPromesse = null

function chargerConfiguration() {
  configPromesse ||= apiFetch('/api/captcha')
    .then((r) => (r.ok ? r.json() : { actif: false }))
    .catch(() => {
      // Serveur injoignable : on retentera au prochain affichage d'un formulaire.
      configPromesse = null
      return { actif: false }
    })
  return configPromesse
}

function chargerScript() {
  scriptPromesse ||= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = URL_SCRIPT
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => {
      script.remove()
      scriptPromesse = null
      reject(new Error('Script anti-robot non chargé'))
    }
    document.head.appendChild(script)
  })
  return scriptPromesse
}

const conteneur = ref(null)
const actif = ref(false)
const erreur = ref('')
let idWidget = null
let demonte = false

const transmettre = (jeton) => emit('update:modelValue', jeton)

onMounted(async () => {
  const config = await chargerConfiguration()
  if (!config.actif || demonte) return
  actif.value = true

  try {
    const turnstile = await chargerScript()
    if (demonte) return
    idWidget = turnstile.render(conteneur.value, {
      sitekey: config.cleSite,
      language: 'fr',
      theme: 'dark',
      callback: (jeton) => {
        erreur.value = ''
        transmettre(jeton)
      },
      // Un jeton expire au bout de 5 minutes : le widget en redemande un tout seul.
      'expired-callback': () => transmettre(''),
      'timeout-callback': () => transmettre(''),
      'error-callback': () => {
        transmettre('')
        erreur.value = 'La vérification anti-robot a échoué. Rechargez la page si le problème persiste.'
      }
    })
  } catch {
    erreur.value = 'La vérification anti-robot ne se charge pas. Vérifiez votre connexion, puis rechargez la page.'
  }
})

onBeforeUnmount(() => {
  demonte = true
  if (idWidget !== null) window.turnstile?.remove(idWidget)
})

// Un jeton ne sert qu'une fois : après chaque envoi, réussi ou non, il en faut un nouveau.
function reinitialiser() {
  transmettre('')
  if (idWidget !== null) window.turnstile?.reset(idWidget)
}

defineExpose({ requis: actif, reinitialiser })
</script>

<template>
  <div class="captcha" :class="{ 'my-3': actif }">
    <div ref="conteneur"></div>
    <p v-if="erreur" class="text-danger small mt-1 mb-0" role="alert">{{ erreur }}</p>
  </div>
</template>
