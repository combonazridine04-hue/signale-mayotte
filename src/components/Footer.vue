<script setup>
import logo from '../assets/img/logo.svg'
</script>

<template>
  <footer class="site-footer mt-auto">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="footer-brand-title">
            <img :src="logo" alt="" class="footer-logo" />
            <h2>Signale Mayotte</h2>
          </div>
          <p>
            La plateforme citoyenne pour signaler les problèmes du quotidien
            (déchets, voirie, éclairage, eau) dans toutes les communes de Mayotte.
          </p>
        </div>

        <div class="footer-links">
          <h3>Navigation</h3>
          <RouterLink to="/">Accueil</RouterLink>
          <RouterLink to="/signaler">Signaler un problème</RouterLink>
          <RouterLink to="/contact">Contact</RouterLink>
        </div>

        <div class="footer-links">
          <h3>Catégories</h3>
          <span>Dépôt sauvage / déchets</span>
          <span>Voirie</span>
          <span>Éclairage public</span>
          <span>Eau</span>
        </div>

        <div class="footer-social">
          <h3>Contact</h3>
          <p class="mb-0">contact@signale-mayotte.yt</p>
          <p class="mb-0">Mayotte, 976</p>
        </div>
      </div>

      <div class="footer-bottom">
        <p>© 2026 Signale Mayotte — Projet fil rouge</p>
      </div>
    </div>
  </footer>
</template>
