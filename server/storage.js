import path from 'node:path'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Stockage des photos (signalements, résolutions, avatars), en deux modes :
//
// - LOCAL (sans SUPABASE_URL) : les fichiers sont rangés sur le disque, dans
//   server/data/uploads/<espace>/, et servis par Express sous /uploads/<espace>/<fichier>.
//   C'est le mode du poste de développement : tout tourne sur le PC, base PostgreSQL
//   locale (consultée avec DBeaver) et photos comprises.
// - SUPABASE (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY renseignées) : Supabase Storage,
//   comme en production sur Render. Le disque d'un hébergeur comme Render est effacé à
//   chaque redéploiement : les photos y disparaîtraient.
//
// Les deux modes exposent les mêmes fonctions et renvoient une URL qui contient
// /<espace>/<fichier> : le reste du code ne sait pas où vivent les photos.

const url = process.env.SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
// Configurable pour que les tests travaillent dans leur propre espace, jamais dans celui
// des vraies photos (voir server/tests/environnementTest.js).
const BUCKET = process.env.SUPABASE_BUCKET || 'signalement-photos'

export const stockageLocal = !url && !cle
if (!stockageLocal && (!url || !cle)) {
  throw new Error(
    'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY vont ensemble : renseignez les deux (photos sur Supabase) ou aucune (photos sur le disque).'
  )
}

// Dossier racine des photos locales, servi par Express (voir server/index.js).
export const DOSSIER_UPLOADS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'uploads')
const dossierEspace = path.join(DOSSIER_UPLOADS, BUCKET)

// Nom de fichier extrait d'une URL. Le nom est toujours généré par le serveur
// (photoUpload.js) ; on n'accepte quand même qu'un nom simple, sans dossier : une URL
// trafiquée en base ne doit jamais faire supprimer un fichier hors de l'espace photos.
function nomDepuisUrl(photoUrl) {
  const nom = String(photoUrl || '')
    .split(`/${BUCKET}/`)
    .pop()
  return /^[\w.-]+$/.test(nom) && !nom.startsWith('.') ? nom : null
}

let supabase = null
if (!stockageLocal) {
  const { createClient } = await import('@supabase/supabase-js')
  supabase = createClient(url, cle, { auth: { persistSession: false } })

  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '5MB'
    })
    if (error && !/already exists/i.test(error.message)) {
      throw error
    }
  }
} else {
  await mkdir(dossierEspace, { recursive: true })
}

export async function uploaderPhoto(buffer, nomFichier, contentType) {
  if (stockageLocal) {
    // flag 'wx' : jamais d'écrasement d'un fichier existant (équivalent de upsert: false).
    await writeFile(path.join(dossierEspace, nomFichier), buffer, { flag: 'wx' })
    return `/uploads/${BUCKET}/${nomFichier}`
  }

  const { error } = await supabase.storage.from(BUCKET).upload(nomFichier, buffer, {
    contentType,
    // Un jour, et non un an : une photo supprimée (visage, plaque d'immatriculation publiés
    // par erreur) restait servie par le cache du CDN jusqu'à un an après sa suppression.
    // Les noms de fichiers étant uniques à chaque envoi, un cache court ne fait jamais
    // afficher une ancienne version ; il coûte seulement un nouveau téléchargement par jour.
    cacheControl: '86400',
    upsert: false
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nomFichier)
  return data.publicUrl
}

export async function supprimerPhoto(photoUrl) {
  const nomFichier = nomDepuisUrl(photoUrl)
  if (!nomFichier) return

  if (stockageLocal) {
    await rm(path.join(dossierEspace, nomFichier), { force: true }).catch(() => {})
    return
  }
  await supabase.storage
    .from(BUCKET)
    .remove([nomFichier])
    .catch(() => {})
}

// Vide les photos des signalements. Les photos de profil sont rangées dans le même
// espace de stockage : sans la liste à préserver, cette fonction les détruisait toutes.
// C'est déjà arrivé — la remise à zéro des données de démonstration a effacé les photos
// de profil de tous les comptes, qui pointent depuis vers des fichiers inexistants.
export async function viderPhotos(urlsAPreserver = []) {
  const aGarder = new Set(urlsAPreserver.map(nomDepuisUrl).filter(Boolean))

  if (stockageLocal) {
    const noms = await readdir(dossierEspace).catch(() => [])
    await Promise.all(
      noms.filter((nom) => !aGarder.has(nom)).map((nom) => rm(path.join(dossierEspace, nom), { force: true }))
    )
    return
  }

  const { data } = await supabase.storage.from(BUCKET).list()
  if (!data?.length) return
  const aSupprimer = data.map((f) => f.name).filter((nom) => !aGarder.has(nom))
  if (aSupprimer.length) {
    await supabase.storage.from(BUCKET).remove(aSupprimer)
  }
}
