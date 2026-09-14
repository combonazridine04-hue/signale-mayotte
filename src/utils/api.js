import { useAuthStore } from '../stores/authStore.js'
import { useCitoyenStore } from '../stores/citoyenStore.js'

export async function apiFetch(url, options = {}) {
  const authStore = useAuthStore()
  const citoyenStore = useCitoyenStore()

  // Un admin connecté agit toujours avec ses droits admin ; sinon, on utilise
  // la session citoyenne si elle existe.
  const utiliseAdmin = Boolean(authStore.token)
  const token = utiliseAdmin ? authStore.token : citoyenStore.token

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const reponse = await fetch(url, { ...options, headers })

  if (reponse.status === 401 && token) {
    if (utiliseAdmin) {
      authStore.deconnecter()
    } else {
      citoyenStore.deconnecter()
    }
  }

  return reponse
}
