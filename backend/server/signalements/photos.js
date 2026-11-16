import { contientContenuExplicite } from '../moderation.js'
import { creerUpload, traiterPhoto } from '../photoUpload.js'

// Photos jointes à un signalement : réception, contrôle du contenu, traitement.

export const MAX_PHOTOS = 5

export const upload = creerUpload({ fileSize: 5 * 1024 * 1024, files: MAX_PHOTOS })

export async function traiterPhotos(fichiers) {
  const urls = []
  for (const fichier of fichiers) {
    urls.push(await traiterPhoto(fichier))
  }
  return urls
}

// Renvoie true si au moins une des photos envoyées est jugée à caractère explicite
// (analysée avant tout traitement/envoi, pour ne rien stocker si elle est rejetée).
export async function contientUnePhotoInterdite(fichiers) {
  for (const fichier of fichiers) {
    if (await contientContenuExplicite(fichier.buffer)) return true
  }
  return false
}

export { traiterPhoto }
