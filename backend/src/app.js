import path from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'))
} catch {
  // Pas de fichier .env (ex: notifications email non configurées) — on continue sans.
}

const express = (await import('express')).default
const helmet = (await import('helmet')).default
const { rateLimit } = await import('express-rate-limit')
const signalementsRouter = (await import('./routes/signalements.routes.js')).default
const commentairesRouter = (await import('./routes/commentaires.routes.js')).default
const misesAJourRouter = (await import('./routes/misesAJour.routes.js')).default
const authRouter = (await import('./routes/auth.routes.js')).default
const contactRouter = (await import('./routes/contact.routes.js')).default
const adminsRouter = (await import('./routes/admins.routes.js')).default
const partenairesRouter = (await import('./routes/partenaires.routes.js')).default
const moderationRouter = (await import('./routes/moderation.routes.js')).default
const notificationsRouter = (await import('./routes/notifications.routes.js')).default
const journalRouter = (await import('./routes/journal.routes.js')).default
const { configurationPublique: configurationCaptcha } = await import('./services/captchaService.js')
const { verifierOrigine } = await import('./middlewares/verifierOrigine.js')
const { cors } = await import('./middlewares/cors.js')
const { DOSSIER_UPLOADS } = await import('./config/storage.js')
const { db } = await import('./config/db.js')
const { precharger: prechargerModerationPhotos } = await import('./services/moderationService.js')
prechargerModerationPhotos()

const app = express()

// Nécessaire pour que express-rate-limit identifie les IP réelles derrière un proxy/hébergeur.
app.set('trust proxy', 1)

// Ce serveur est une API : il ne sert ni pages ni scripts, seulement du JSON et des photos.
// Sa politique de sécurité peut donc tout interdire. Celle des pages du site est inscrite
// par le front-end dans son index.html (voir son vite.config.js).
app.use(
  helmet({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Le navigateur refusera d'être contacté en HTTP pendant un an (au lieu de 180 jours).
    strictTransportSecurity: { maxAge: 365 * 24 * 60 * 60, includeSubDomains: true },
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }
    }
  })
)

// Le front-end est à une autre adresse : il n'a le droit d'appeler l'API que si elle
// l'autorise (CORS), et seulement pour l'adresse déclarée dans FRONTEND_URL.
app.use('/api', cors)

const limiteurLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion, réessayez plus tard.' }
})

app.use(express.json())
app.use('/api', verifierOrigine)
// Les réponses de l'API contiennent des données de compte : rien ne doit en rester dans
// le cache du navigateur, surtout sur un ordinateur partagé (cybercafé, médiathèque).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api/auth/login', limiteurLogin)
app.use('/api/auth', authRouter)
app.use('/api', signalementsRouter)
app.use('/api', commentairesRouter)
app.use('/api', misesAJourRouter)
app.use('/api', contactRouter)
app.use('/api', moderationRouter)
app.use('/api', notificationsRouter)
app.use('/api', adminsRouter)
app.use('/api', partenairesRouter)
app.use('/api', journalRouter)
// Publique : le formulaire doit savoir s'il affiche le widget anti-robot, et avec quelle clé.
app.get('/api/captcha', (req, res) => res.json(configurationCaptcha()))

// État de santé : l'API répond ET la base de données aussi. Sert à l'hébergeur ou à un
// outil de surveillance, qui l'appelle régulièrement pour détecter une panne. 503 si la
// base ne répond pas. Aucun détail technique n'est renvoyé (pas de message d'erreur).
app.get('/api/sante', async (req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ statut: 'ok', baseDeDonnees: 'ok', date: new Date().toISOString() })
  } catch (e) {
    console.error('[sante] Base de données injoignable :', e.message)
    res.status(503).json({ statut: 'erreur', baseDeDonnees: 'indisponible', date: new Date().toISOString() })
  }
})

// Route d'API inconnue : une réponse JSON explicite.
app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue.' }))

// Accueil de l'API : quelqu'un qui ouvre son adresse dans un navigateur voit à quoi elle
// sert, au lieu d'une page d'erreur d'Express. Le site lui-même est servi par le front-end.
app.get('/', (req, res) => {
  res.json({
    nom: 'API Signale Mayotte',
    description: 'API de la plateforme citoyenne de signalement des problèmes du quotidien à Mayotte.',
    statut: 'en ligne',
    sante: '/api/sante'
  })
})

// Photos rangées sur le disque du serveur (voir storage.js). Ce sont
// des images réencodées par sharp, aux noms générés par le serveur. Par précaution, le
// navigateur ne doit jamais les traiter comme une page : aucun script, aucun contenu actif.
app.use(
  '/uploads',
  express.static(DOSSIER_UPLOADS, {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
    setHeaders: (res) => {
      res.set('Content-Security-Policy', "default-src 'none'; sandbox")
      // Le front, hébergé à une autre adresse, doit pouvoir afficher ces images.
      res.set('Cross-Origin-Resource-Policy', 'cross-origin')
    }
  })
)

// Toute autre adresse : une réponse JSON claire, plutôt que la page « Cannot GET » d'Express.
app.use((req, res) => res.status(404).json({ erreur: 'Adresse inconnue.' }))

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
