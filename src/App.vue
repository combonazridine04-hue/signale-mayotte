<script setup>
import { defineAsyncComponent } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DialogueGlobal from './components/DialogueGlobal.vue'
import { RouterView, useRoute } from 'vue-router'

const GlobeBackground = defineAsyncComponent(() => import('./components/GlobeBackground.vue'))

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.meta.admin" />
  <template v-else>
    <GlobeBackground />
    <div class="app-shell">
      <NavBar />
      <RouterView />
      <Footer />
    </div>
    <ThemeToggle />
  </template>
  <DialogueGlobal />
</template>
