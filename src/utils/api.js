import { useAuthStore } from '../stores/authStore.js'

export async function apiFetch(url, options = {}) {
  const authStore = useAuthStore()

  const headers = new Headers(options.headers || {})
  if (authStore.token) {
    headers.set('Authorization', `Bearer ${authStore.token}`)
  }

  const reponse = await fetch(url, { ...options, headers })

  if (reponse.status === 401) {
    authStore.deconnecter()
  }

  return reponse
}
