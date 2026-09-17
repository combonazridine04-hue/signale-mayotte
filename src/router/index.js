import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SignalerView from '../views/SignalerView.vue'
import SignalementDetailView from '../views/SignalementDetailView.vue'
import ContactView from '../views/ContactView.vue'
import CarteView from '../views/CarteView.vue'
import TransparenceView from '../views/TransparenceView.vue'
import AdminLoginView from '../views/admin/AdminLoginView.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import InscriptionView from '../views/InscriptionView.vue'
import ConnexionView from '../views/ConnexionView.vue'
import VerifierEmailView from '../views/VerifierEmailView.vue'
import MotDePasseOublieView from '../views/MotDePasseOublieView.vue'
import ReinitialiserMotDePasseView from '../views/ReinitialiserMotDePasseView.vue'
import ConfidentialiteView from '../views/ConfidentialiteView.vue'
import MesSignalementsView from '../views/MesSignalementsView.vue'
import ProfilView from '../views/ProfilView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'

const routes = [
  {
    path: '/',
    name: 'accueil',
    component: HomeView
  },
  {
    path: '/signaler',
    name: 'signaler',
    component: SignalerView,
    meta: { requiresAuthCitoyen: true }
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
    path: '/inscription',
    name: 'inscription',
    component: InscriptionView
  },
  {
    path: '/connexion',
    name: 'connexion',
    component: ConnexionView
  },
  {
    path: '/verifier-email',
    name: 'verifier-email',
    component: VerifierEmailView,
    meta: { requiresAuthCitoyen: true }
  },
  {
    path: '/mot-de-passe-oublie',
    name: 'mot-de-passe-oublie',
    component: MotDePasseOublieView
  },
  {
    path: '/reinitialiser-mot-de-passe',
    name: 'reinitialiser-mot-de-passe',
    component: ReinitialiserMotDePasseView
  },
  {
    path: '/confidentialite',
    name: 'confidentialite',
    component: ConfidentialiteView
  },
  {
    path: '/mes-signalements',
    name: 'mes-signalements',
    component: MesSignalementsView,
    meta: { requiresAuthCitoyen: true }
  },
  {
    path: '/profil',
    name: 'profil',
    component: ProfilView,
    meta: { requiresAuthCitoyen: true }
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
  const citoyenStore = useCitoyenStore()

  if (to.meta.requiresAuth && !authStore.estConnecte) {
    return { name: 'admin-login' }
  }
  if (to.name === 'admin-login' && authStore.estConnecte) {
    return { name: 'admin-dashboard' }
  }
  if (to.meta.requiresAuthCitoyen && !authStore.estConnecte && !citoyenStore.estConnecte) {
    return { name: 'connexion', query: { retour: to.fullPath } }
  }
  if ((to.name === 'connexion' || to.name === 'inscription') && (authStore.estConnecte || citoyenStore.estConnecte)) {
    return { name: 'accueil' }
  }
  return true
})

export default router
