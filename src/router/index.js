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
    meta: { titre: 'Signaler un problème', requiresAuthCitoyen: true }
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
    component: ContactView,
    meta: { titre: 'Contact' }
  },
  {
    path: '/carte',
    name: 'carte',
    component: CarteView,
    meta: { titre: 'Carte des signalements' }
  },
  {
    path: '/transparence',
    name: 'transparence',
    component: TransparenceView,
    meta: { titre: 'Transparence' }
  },
  {
    path: '/inscription',
    name: 'inscription',
    component: InscriptionView,
    meta: { titre: 'Créer mon compte' }
  },
  {
    path: '/connexion',
    name: 'connexion',
    component: ConnexionView,
    meta: { titre: 'Connexion' }
  },
  {
    path: '/verifier-email',
    name: 'verifier-email',
    component: VerifierEmailView,
    meta: { titre: 'Confirmer mon email', requiresAuthCitoyen: true }
  },
  {
    path: '/mot-de-passe-oublie',
    name: 'mot-de-passe-oublie',
    component: MotDePasseOublieView,
    meta: { titre: 'Mot de passe oublié' }
  },
  {
    path: '/reinitialiser-mot-de-passe',
    name: 'reinitialiser-mot-de-passe',
    component: ReinitialiserMotDePasseView,
    meta: { titre: 'Nouveau mot de passe' }
  },
  {
    path: '/confidentialite',
    name: 'confidentialite',
    component: ConfidentialiteView,
    meta: { titre: 'Confidentialité' }
  },
  {
    path: '/mes-signalements',
    // `/dashboard` est l'adresse attendue par la plupart des gens pour « mon espace » :
    // l'alias évite de casser les liens déjà partagés vers /mes-signalements.
    alias: '/dashboard',
    name: 'mes-signalements',
    component: MesSignalementsView,
    meta: { titre: 'Mon espace', requiresAuthCitoyen: true }
  },
  {
    path: '/profil',
    name: 'profil',
    component: ProfilView,
    meta: { titre: 'Mon profil', requiresAuthCitoyen: true }
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { titre: 'Connexion admin', admin: true }
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: AdminDashboardView,
    meta: { titre: 'Espace admin', admin: true, requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'introuvable',
    component: NotFoundView,
    meta: { titre: 'Page introuvable' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Sans ça, on arrive au milieu d'une nouvelle page en gardant le défilement précédent.
  // Le retour arrière, lui, doit retrouver la position quittée.
  scrollBehavior(to, from, positionSauvegardee) {
    if (positionSauvegardee) return positionSauvegardee
    return { top: 0 }
  }
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

export const TITRE_SITE = 'Signale Mayotte'

// Le titre de l'onglet doit refléter la page : repères dans l'historique, les favoris
// et les onglets multiples. La page d'un signalement affine ce titre de son côté.
router.afterEach((to) => {
  document.title = to.meta.titre ? `${to.meta.titre} · ${TITRE_SITE}` : `${TITRE_SITE} — Signalement citoyen`
})

export default router
