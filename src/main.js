import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/css/style.css'
import './assets/css/navbar.css'
import './assets/css/hero.css'
import './assets/css/footer.css'
import './assets/css/signalement.css'
import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
