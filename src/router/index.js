import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SignalerView from '../views/SignalerView.vue'
import SignalementDetailView from '../views/SignalementDetailView.vue'
import ContactView from '../views/ContactView.vue'
import CarteView from '../views/CarteView.vue'
import TransparenceView from '../views/TransparenceView.vue'
import AdminLoginView from '../views/admin/AdminLoginView.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { useAuthStore } from '../stores/authStore.js'

const routes = [
  {
    path: '/',
    name: 'accueil',
    component: HomeView
  },
  {
    path: '/signaler',
    name: 'signaler',
    component: SignalerView
  },
  {
    path: '/signalements/:id',
    name: 'signalement-detail',
    component: SignalementDetailView,
    props: true
  },
  {
    path: '/contact',
    name: 'contact',
    component: ContactView
  },
  {
    path: '/carte',
    name: 'carte',
    component: CarteView
  },
  {
    path: '/transparence',
    name: 'transparence',
    component: TransparenceView
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { admin: true }
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: AdminDashboardView,
    meta: { admin: true, requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'introuvable',
    component: NotFoundView
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.estConnecte) {
    return { name: 'admin-login' }
  }
  if (to.name === 'admin-login' && authStore.estConnecte) {
    return { name: 'admin-dashboard' }
  }
  return true
})

export default router
