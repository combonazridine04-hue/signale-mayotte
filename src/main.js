import { createApp } from 'vue'
import { createPinia } from 'pinia'
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
import './assets/css/admin-login.css'
import './assets/css/admin-dashboard.css'
import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
