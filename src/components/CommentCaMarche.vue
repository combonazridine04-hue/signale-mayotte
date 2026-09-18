<script setup>
import { RouterLink } from 'vue-router'
import { CATEGORIES } from '../models/signalement.js'

// Les étapes décrivent ce que la plateforme fait vraiment : organisme compétent affiché
// selon la catégorie, statut public qui évolue, notifications à chaque étape.
const etapes = [
  {
    numero: '1',
    titre: 'Vous signalez',
    texte:
      "Une photo, une commune, deux lignes de description : moins de deux minutes. Vous pouvez placer le lieu exact sur la carte pour que l'intervention soit plus rapide."
  },
  {
    numero: '2',
    titre: 'Le bon service est identifié',
    texte:
      "Selon le type de problème, la plateforme indique qui est compétent — mairie, Conseil départemental, SMAE — avec ses coordonnées. Plus besoin de chercher à qui s'adresser."
  },
  {
    numero: '3',
    titre: 'Vous suivez la suite',
    texte:
      "Le signalement passe de « Signalé » à « En cours » puis « Résolu », visible par tous. Vous êtes prévenu à chaque étape et quand quelqu'un réagit."
  }
]
</script>

<template>
  <section class="fonctionnement">
    <div class="container">
      <p class="section-kicker">Comment ça marche</p>
      <h2 class="fonctionnement-titre">Signaler un problème ne doit pas être compliqué</h2>
      <p class="fonctionnement-intro">
        Un dépôt sauvage au bord de la route, un lampadaire éteint depuis des semaines, une
        coupure d'eau : ces problèmes du quotidien mettent du temps à remonter. Signale Mayotte
        les rend visibles, publics et suivis.
      </p>

      <ol class="fonctionnement-etapes">
        <li v-for="etape in etapes" :key="etape.numero" class="card-glass rounded fonctionnement-etape">
          <span class="fonctionnement-numero" aria-hidden="true">{{ etape.numero }}</span>
          <h3 class="fonctionnement-etape-titre">{{ etape.titre }}</h3>
          <p class="fonctionnement-etape-texte">{{ etape.texte }}</p>
        </li>
      </ol>

      <div class="fonctionnement-bas">
        <div>
          <p class="fonctionnement-label">Ce que vous pouvez signaler</p>
          <ul class="fonctionnement-categories">
            <li v-for="categorie in CATEGORIES" :key="categorie">{{ categorie }}</li>
          </ul>
        </div>

        <div class="fonctionnement-action">
          <RouterLink to="/signaler" class="btn btn-success">Signaler un problème</RouterLink>
          <p class="fonctionnement-note">
            Gratuit. Votre nom et vos coordonnées ne sont jamais affichés publiquement.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
