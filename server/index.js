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
const signalementsRouter = (await import('./routes/signalements.js')).default
const commentairesRouter = (await import('./routes/commentaires.js')).default
const misesAJourRouter = (await import('./routes/misesAJour.js')).default
const authRouter = (await import('./routes/auth.js')).default
const contactRouter = (await import('./routes/contact.js')).default
const adminsRouter = (await import('./routes/admins.js')).default
const partenairesRouter = (await import('./routes/partenaires.js')).default
const moderationRouter = (await import('./routes/moderation.js')).default
const notificationsRouter = (await import('./routes/notifications.js')).default
const journalRouter = (await import('./routes/journal.js')).default
const { configurationPublique: configurationCaptcha } = await import('./captcha.js')
const { verifierOrigine } = await import('./middleware/verifierOrigine.js')
const { cors } = await import('./middleware/cors.js')
const { DOSSIER_UPLOADS } = await import('./storage.js')
const { precharger: prechargerModerationPhotos } = await import('./moderation.js')
prechargerModerationPhotos()

const PORT = process.env.PORT || 3001

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
// Route d'API inconnue : une réponse JSON explicite.
app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue.' }))

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

  // Chez alwaysdata, l'application DOIT écouter sur l'adresse et le port qu'il fournit
  // (variables IP ou HOST, et PORT). En local, aucune adresse : toutes les interfaces.
  const ADRESSE = process.env.IP || process.env.HOST || undefined
  app.listen(PORT, ADRESSE, () => {
    console.log(`API Signale Mayotte disponible sur ${ADRESSE ? `${ADRESSE}:${PORT}` : `http://localhost:${PORT}`}`)
  })
}
