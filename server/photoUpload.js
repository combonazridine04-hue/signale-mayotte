import multer from 'multer'
import sharp from 'sharp'
import { uploaderPhoto } from './storage.js'

export const EXTENSIONS_AUTORISEES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export function creerUpload(limits) {
  return multer({
    storage: multer.memoryStorage(),
    limits,
    fileFilter: (req, file, cb) => {
      // Liste blanche stricte : exclut notamment image/svg+xml, vecteur de XSS stocké.
      cb(null, Object.hasOwn(EXTENSIONS_AUTORISEES, file.mimetype))
    }
  })
}

export async function traiterPhoto(fichier, { largeurMax } = {}) {
  const format = EXTENSIONS_AUTORISEES[fichier.mimetype]
  // .rotate() sans argument applique l'orientation EXIF avant de la supprimer,
  // pour éviter les photos de travers ; toBuffer() par défaut retire déjà toutes
  // les métadonnées (dont la géolocalisation GPS embarquée par les smartphones).
  let buffer
  try {
    let image = sharp(fichier.buffer, { animated: format === 'gif' }).rotate()
    if (largeurMax) image = image.resize({ width: largeurMax, height: largeurMax, fit: 'cover' })
    buffer = await image.toFormat(format).toBuffer()
  } catch {
    // Type annoncé correct mais contenu illisible (fichier corrompu, renommé…) : c'est
    // une erreur du fichier envoyé, pas du serveur. Le gestionnaire global en fait une 400
    // avec ce message, au lieu d'une panne 500.
    const erreur = new Error("Une image n'a pas pu être lue. Essayez un autre fichier.")
    erreur.status = 400
    erreur.messagePublic = erreur.message
    throw erreur
  }

  const nomFichier = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${format}`
  return uploaderPhoto(buffer, nomFichier, fichier.mimetype)
}
