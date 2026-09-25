import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'))
} catch {
  // Pas de fichier .env (ex: notifications email non configurées) — on continue sans.
}

const express = (await import('express')).default
const helmet = (await import('helmet')).default
const { rateLimit } = await import('express-rate-limit')
const signalementsRouter = (await import('./routes/signalements.js')).default
const commentairesRouter = (await import('./routes/commentaires.js')).default
const misesAJourRouter = (await import('./routes/misesAJour.js')).default
const authRouter = (await import('./routes/auth.js')).default
const contactRouter = (await import('./routes/contact.js')).default
const adminsRouter = (await import('./routes/admins.js')).default
const moderationRouter = (await import('./routes/moderation.js')).default
const notificationsRouter = (await import('./routes/notifications.js')).default
const { precharger: prechargerModerationPhotos } = await import('./moderation.js')
prechargerModerationPhotos()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const app = express()

// Nécessaire pour que express-rate-limit identifie les IP réelles derrière un proxy/hébergeur.
app.set('trust proxy', 1)

app.use(
  helmet({
    // Par défaut Helmet envoie "no-referrer", ce qui empêche MapTiler de vérifier
    // l'origine des requêtes de tuiles (clé API restreinte par domaine).
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Bootstrap est désormais servi par le site : plus aucun script tiers autorisé.
        scriptSrc: ["'self'"],
        // Plus aucune police chargée chez Google : tout vient du site.
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://api.maptiler.com',
          'https://*.tile.openstreetmap.fr',
          'https://*.supabase.co'
        ],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    }
  })
)

const limiteurLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

app.use(express.json())
app.use('/api/auth/login', limiteurLogin)
app.use('/api/auth', authRouter)
app.use('/api', signalementsRouter)
app.use('/api', commentairesRouter)
app.use('/api', misesAJourRouter)
app.use('/api', contactRouter)
app.use('/api', moderationRouter)
app.use('/api', notificationsRouter)
app.use('/api', adminsRouter)
// Route d'API inconnue : une réponse JSON explicite, plutôt que la page d'accueil du
// site renvoyée par le filet ci-dessous avec un statut 200 trompeur.
app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue.' }))

const distDir = path.join(__dirname, '..', 'dist')

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/*splat', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

// Gestionnaire d'erreurs global. Express le reconnaît au nombre de ses paramètres :
// il en faut exactement quatre, d'où `_next`, inutilisé mais indispensable. Sans lui,
// Express traiterait cette fonction comme un middleware ordinaire et afficherait ses
// propres pages d'erreur, avec la trace d'exécution.
app.use((err, req, res, _next) => {
  // Fichier trop lourd ou trop nombreux : la faute est côté client, et elle est explicable.
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Trop de fichiers envoyés.'
          : 'Fichier refusé.'
    return res.status(400).json({ erreur: message })
  }

  // JSON mal formé, corps trop gros, image illisible… : l'origine renseigne un statut 4xx.
  // Seul un message explicitement prévu pour l'utilisateur (messagePublic) est renvoyé ;
  // un message interne pourrait trahir le fonctionnement du serveur.
  const statut = err.status || err.statusCode
  if (statut >= 400 && statut < 500) {
    return res.status(statut).json({ erreur: err.messagePublic || 'Requête invalide.' })
  }

  // Tout le reste est une panne du serveur, pas une erreur du client : 500, et non 400
  // comme auparavant. Le détail part dans les journaux, jamais dans la réponse.
  console.error(err)
  res.status(500).json({ erreur: 'Erreur interne du serveur. Réessayez dans un instant.' })
})

export { app }

const estLanceDirectement = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (estLanceDirectement) {
  // Pas pendant les tests : ils importent l'app sans la lancer.
  const { planifierPurge } = await import('./retention.js')
  planifierPurge()

  app.listen(PORT, () => {
    console.log(`API Signale Mayotte disponible sur http://localhost:${PORT}`)
  })
}
