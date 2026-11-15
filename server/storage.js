import path from 'node:path'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Stockage des photos (signalements, résolutions, avatars) sur le disque du serveur :
// server/data/uploads/<espace>/<fichier>, servi par Express sous /uploads/<espace>/<fichier>
// (voir server/index.js). Le dossier server/data est ignoré par git.
//
// Hébergement : le disque doit être PERMANENT (c'est le cas chez alwaysdata). Un
// hébergeur dont le disque est effacé à chaque mise à jour ferait disparaître les photos.

// Espace des photos. Les tests utilisent le leur (voir server/tests/environnementTest.js),
// pour ne jamais toucher aux vraies photos.
const ESPACE = process.env.ESPACE_PHOTOS || 'signalement-photos'

// Dossier racine des photos, servi par Express.
export const DOSSIER_UPLOADS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'uploads')
const dossierEspace = path.join(DOSSIER_UPLOADS, ESPACE)

await mkdir(dossierEspace, { recursive: true })

// Nom de fichier extrait d'une URL. Le nom est toujours généré par le serveur
// (photoUpload.js) ; on n'accepte quand même qu'un nom simple, sans dossier : une URL
// trafiquée en base ne doit jamais faire supprimer un fichier hors de l'espace photos.
function nomDepuisUrl(photoUrl) {
  const nom = String(photoUrl || '')
    .split(`/${ESPACE}/`)
    .pop()
  return /^[\w.-]+$/.test(nom) && !nom.startsWith('.') ? nom : null
}

export async function uploaderPhoto(buffer, nomFichier) {
  // flag 'wx' : jamais d'écrasement d'un fichier existant.
  await writeFile(path.join(dossierEspace, nomFichier), buffer, { flag: 'wx' })
  return `/uploads/${ESPACE}/${nomFichier}`
}

export async function supprimerPhoto(photoUrl) {
  const nomFichier = nomDepuisUrl(photoUrl)
  if (!nomFichier) return
  await rm(path.join(dossierEspace, nomFichier), { force: true }).catch(() => {})
}

// Vide les photos des signalements (réservé aux tests). Les photos de profil sont rangées
// dans le même espace : sans la liste à préserver, cette fonction les détruirait aussi.
export async function viderPhotos(urlsAPreserver = []) {
  const aGarder = new Set(urlsAPreserver.map(nomDepuisUrl).filter(Boolean))
  const noms = await readdir(dossierEspace).catch(() => [])
  await Promise.all(
    noms.filter((nom) => !aGarder.has(nom)).map((nom) => rm(path.join(dossierEspace, nom), { force: true }))
  )
}
