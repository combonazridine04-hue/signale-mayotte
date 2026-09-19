<script setup>
import { RouterLink } from 'vue-router'
import { CATEGORIES } from '../models/signalement.js'
import logo from '../assets/img/logo.svg'

const annee = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer mt-auto">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <!-- Le logo ramène à l'accueil : c'est le réflexe attendu sur tout site. -->
          <RouterLink to="/" class="footer-brand-title" aria-label="Signale Mayotte — retour à l'accueil">
            <img :src="logo" alt="" class="footer-logo" />
            <span class="footer-brand-nom">Signale Mayotte</span>
          </RouterLink>
          <p class="footer-brand-texte">
            La plateforme citoyenne pour signaler les problèmes du quotidien
            dans toutes les communes de Mayotte.
          </p>
        </div>

        <nav class="footer-colonne" aria-label="Navigation du pied de page">
          <h2>Le site</h2>
          <RouterLink to="/">Accueil</RouterLink>
          <RouterLink to="/signaler">Signaler un problème</RouterLink>
          <RouterLink to="/carte">Carte des signalements</RouterLink>
          <RouterLink to="/transparence">Transparence</RouterLink>
        </nav>

        <nav class="footer-colonne" aria-label="Signalements par catégorie">
          <h2>Par catégorie</h2>
          <!-- Cliquables : la liste de l'accueil s'ouvre filtrée sur la catégorie.
               Avant, c'était du texte mort qui n'amenait nulle part. -->
          <RouterLink
            v-for="categorie in CATEGORIES"
            :key="categorie"
            :to="{ path: '/', query: { categorie } }"
          >
            {{ categorie }}
          </RouterLink>
        </nav>

        <div class="footer-colonne">
          <h2>Nous joindre</h2>
          <RouterLink to="/contact">Écrire à la mairie</RouterLink>
          <RouterLink to="/confidentialite">Confidentialité</RouterLink>
          <p class="footer-lieu">Mayotte, 976</p>
        </div>
      </div>

      <!-- Un site de signalement n'est pas une ligne de secours : le rappeler là où
           l'œil finit sa course coûte peu et peut éviter une perte de temps grave. -->
      <p class="footer-urgence">
        <span class="footer-urgence-icone" aria-hidden="true">⚠</span>
        <span>
          En cas d'urgence vitale, n'utilisez pas ce site : appelez le
          <a href="tel:15">15</a> (SAMU), le <a href="tel:18">18</a> (pompiers)
          ou le <a href="tel:17">17</a> (police).
        </span>
      </p>

      <div class="footer-bottom">
        <p>© {{ annee }} Signale Mayotte</p>
        <p>Projet fil rouge — données publiques, identités privées.</p>
      </div>
    </div>
  </footer>
</template>
