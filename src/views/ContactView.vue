<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiFetch } from '../utils/api.js'
import PanneauAide from '../components/PanneauAide.vue'
import { SUJETS_CONTACT } from '../../shared/sujetsContact.js'

// L'adresse contact@signale-mayotte.yt est affichée parce qu'elle va être créée.
// Le téléphone 02 69 00 00 00 et l'adresse postale, eux, restent retirés : c'étaient
// des valeurs d'exemple, et un numéro qui ne sonne nulle part fait perdre son temps
// à celui qui appelle.
const motifs = [
  { titre: 'Une erreur sur un signalement', texte: 'Contenu déplacé, doublon, information fausse à corriger.' },
  { titre: 'Un souci avec votre compte', texte: 'Email de confirmation jamais reçu, connexion impossible.' },
  { titre: 'Une question sur la plateforme', texte: "Comment elle fonctionne, ce qu'elle fait de vos données." },
  { titre: 'Une proposition', texte: 'Une idée, un manque, un partenariat avec une commune ou une association.' }
]

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
          <h1 class="fw-bold">Nous écrire</h1>
          <p class="text-secondary">
            Ce message arrive à l'équipe qui gère la plateforme. Pour signaler un problème sur le terrain, passez plutôt
            par le formulaire de signalement : il est suivi, public, et transmis au bon service.
          </p>

          <PanneauAide titre="Écrivez-nous plutôt pour" :points="motifs" />

          <!-- Adresse cliquable : un email affiché en texte brut oblige à le recopier
               à la main, et se recopie mal sur téléphone. -->
          <div class="contact-panel mt-4">
            <!-- Sur une seule ligne : Vue supprime les blancs entre deux balises, et
                 l'espace après « Email : » disparaissait. -->
            <p class="mb-1">
              <strong>Email :</strong> <a href="mailto:contact@signale-mayotte.yt">contact@signale-mayotte.yt</a>
            </p>
            <p class="mb-0 text-secondary small">
              Le formulaire ci-contre fait la même chose, sans avoir à ouvrir sa messagerie.
            </p>
          </div>

          <div class="contact-panel mt-4">
            <p class="mb-2 fw-semibold">Un problème à signaler&nbsp;?</p>
            <p class="mb-3 text-secondary small">
              Un dépôt sauvage, un nid-de-poule, un lampadaire éteint, une fuite d'eau ne se traitent pas par email :
              ils se signalent, pour être suivis.
            </p>
            <RouterLink to="/signaler" class="btn btn-success btn-sm">Signaler un problème</RouterLink>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <form class="card-glass rounded p-4 shadow-sm" novalidate @submit.prevent="envoyer">
            <div class="mb-3">
              <label for="nom" class="form-label">Nom complet</label>
              <input
                id="nom"
                v-model="formulaire.nom"
                type="text"
                maxlength="100"
                class="form-control"
                :class="{ 'is-invalid': envoye && erreurs.nom }"
              />
              <div class="invalid-feedback">Le nom doit contenir au moins 2 caractères.</div>
            </div>

            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <input
                id="email"
                v-model="formulaire.email"
                type="email"
                class="form-control"
                :class="{ 'is-invalid': envoye && erreurs.email }"
              />
              <div class="invalid-feedback">Veuillez saisir une adresse email valide.</div>
            </div>

            <div class="mb-3">
              <label for="sujet" class="form-label">Sujet</label>
              <select
                id="sujet"
                v-model="formulaire.sujet"
                class="form-select"
                :class="{ 'is-invalid': envoye && erreurs.sujet }"
              >
                <option value="">Choisir un sujet</option>
                <option v-for="sujet in SUJETS_CONTACT" :key="sujet">{{ sujet }}</option>
              </select>
              <div class="invalid-feedback">Veuillez sélectionner un sujet.</div>
            </div>

            <div class="mb-3">
              <label for="message" class="form-label">Message</label>
              <textarea
                id="message"
                v-model="formulaire.message"
                rows="5"
                maxlength="3000"
                class="form-control"
                :class="{ 'is-invalid': envoye && erreurs.message }"
              ></textarea>
              <div class="invalid-feedback">Le message doit contenir au moins 10 caractères.</div>
            </div>

            <div class="honeypot-field" aria-hidden="true">
              <label for="contact-site-web">Site web</label>
              <input id="contact-site-web" v-model="formulaire.site_web" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <div v-if="succes" class="alert alert-success">Votre message a bien été envoyé.</div>
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
