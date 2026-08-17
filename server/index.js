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
const authRouter = (await import('./routes/auth.js')).default
const contactRouter = (await import('./routes/contact.js')).default
const adminsRouter = (await import('./routes/admins.js')).default

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

const app = express()

// Nécessaire pour que express-rate-limit identifie les IP réelles derrière un proxy/hébergeur.
app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://*.supabase.co'],
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
app.use('/api', contactRouter)
app.use('/api', adminsRouter)

const distDir = path.join(__dirname, '..', 'dist')

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/*splat', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(400).json({ erreur: 'Requête invalide.' })
})

export { app }

const estLanceDirectement = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (estLanceDirectement) {
  app.listen(PORT, () => {
    console.log(`API Signale Mayotte disponible sur http://localhost:${PORT}`)
  })
}
