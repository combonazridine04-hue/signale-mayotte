import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
// Configurable pour que les tests travaillent dans leur propre espace, jamais dans celui
// de la production (voir server/tests/environnementTest.js).
const BUCKET = process.env.SUPABASE_BUCKET || 'signalement-photos'

if (!url || !cle) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants : renseignez-les dans .env (Project Settings > API sur Supabase).'
  )
}

const supabase = createClient(url, cle, {
  auth: { persistSession: false }
})

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

export async function uploaderPhoto(buffer, nomFichier, contentType) {
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
  if (!photoUrl) return
  const nomFichier = photoUrl.split(`/${BUCKET}/`).pop()
  if (!nomFichier) return
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
  const { data } = await supabase.storage.from(BUCKET).list()
  if (!data?.length) return

  const aGarder = new Set(
    urlsAPreserver
      .filter(Boolean)
      .map((u) => u.split(`/${BUCKET}/`).pop())
      .filter(Boolean)
  )

  const aSupprimer = data.map((f) => f.name).filter((nom) => !aGarder.has(nom))
  if (aSupprimer.length) {
    await supabase.storage.from(BUCKET).remove(aSupprimer)
  }
}
