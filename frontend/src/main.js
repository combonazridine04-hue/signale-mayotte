import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Bootstrap est servi depuis le site et non plus depuis un CDN : une requête bloquante
// de moins vers un tiers au premier affichage, et rien à autoriser dans la politique de
// sécurité. Il vient AVANT nos feuilles, pour que les styles du site puissent le surcharger.
import 'bootstrap/dist/css/bootstrap.min.css'
// Police Inter servie par le site lui-même, et non par Google Fonts : chaque visite
// transmettait sinon l'adresse IP du visiteur à Google, sans information ni accord
// (transfert jugé contraire au RGPD, tribunal de Munich, 20 janvier 2022).
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import './assets/css/style.css'
import './assets/css/navbar.css'
import './assets/css/hero.css'
import './assets/css/footer.css'
import './assets/css/signalement.css'
import './assets/css/dialogue-global.css'
import './assets/css/globe-background.css'
import './assets/css/location-picker.css'
import './assets/css/organisme-competent.css'
import './assets/css/theme-toggle.css'
import './assets/css/carte.css'
import './assets/css/transparence.css'
import './assets/css/profil.css'
import './assets/css/tableau-de-bord.css'
import './assets/css/panneau-aide.css'
import './assets/css/statut-suivi.css'
import './assets/css/champ-mot-de-passe.css'
import './assets/css/cloche-notifications.css'
import './assets/css/fonctionnement.css'
import './assets/css/admin-login.css'
import './assets/css/admin-dashboard.css'
import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
