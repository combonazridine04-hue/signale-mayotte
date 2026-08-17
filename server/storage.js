import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'signalement-photos'

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
    cacheControl: '31536000',
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
  await supabase.storage.from(BUCKET).remove([nomFichier]).catch(() => {})
}

export async function viderPhotos() {
  const { data } = await supabase.storage.from(BUCKET).list()
  if (!data?.length) return
  await supabase.storage.from(BUCKET).remove(data.map((f) => f.name))
}
