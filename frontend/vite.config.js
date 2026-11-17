import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Politique de sécurité du contenu (CSP) du site compilé. Le front étant hébergé à part,
// ce n'est plus le back-end qui l'envoie : elle est inscrite dans index.html au build.
// Elle n'autorise que le site lui-même, l'API (VITE_API_URL), le widget anti-robot de
// Cloudflare et les fonds de carte.
function politiqueDeSecurite(adresseApi) {
  const api = adresseApi ? ` ${adresseApi}` : ''
  return [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    'frame-src https://challenges.cloudflare.com',
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' data: blob: https://api.maptiler.com https://*.tile.openstreetmap.fr${api}`,
    `connect-src 'self'${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const adresseApi = (env.VITE_API_URL || '').replace(/\/$/, '')

  return {
    plugins: [
      vue(),
      {
        // Seulement au build : en développement, Vite injecte des scripts que la CSP bloquerait.
        name: 'politique-de-securite',
        apply: 'build',
        transformIndexHtml: () => [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: politiqueDeSecurite(adresseApi) },
            injectTo: 'head-prepend'
          }
        ]
      },
      {
        // Le globe est un fichier à part (three.js, ≈ 630 Ko) : on demande au navigateur
        // de le télécharger dès la lecture de index.html, en même temps que le reste du
        // site, pour qu'il apparaisse avec la page et non quelques secondes après.
        name: 'prechargement-globe',
        apply: 'build',
        transformIndexHtml: (html, contexte) => {
          const globe = Object.keys(contexte.bundle || {}).find((nom) => /GlobeBackground-.*\.js$/.test(nom))
          return globe
            ? [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${globe}` }, injectTo: 'head' }]
            : []
        }
      }
    ],
    server: {
      // En développement, le front parle au back-end lancé sur le port 3001, comme s'ils
      // étaient à la même adresse : pas de CORS ni de cookie tiers à gérer en local.
      proxy: {
        '/api': 'http://localhost:3001',
        '/uploads': 'http://localhost:3001'
      }
    }
  }
})
