import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-cpu'
import * as nsfwjs from 'nsfwjs'
import sharp from 'sharp'

const SEUIL_PROBABILITE = 0.6
const CLASSES_EXPLICITES = new Set(['Porn', 'Hentai'])

let modelePromesse = null

function chargerModele() {
  if (!modelePromesse) {
    modelePromesse = (async () => {
      await tf.setBackend('cpu')
      await tf.ready()
      return nsfwjs.load()
    })()
  }
  return modelePromesse
}

// Démarre le chargement du modèle sans attendre : à appeler au démarrage du serveur
// pour que le premier envoi de photo n'ait pas à attendre le téléchargement du modèle.
export function precharger() {
  chargerModele().catch((e) => console.error('[moderation] Échec préchargement du modèle :', e.message))
}

// Analyse une photo et renvoie true si elle est probablement à caractère explicite
// (nudité...). En cas d'échec de l'analyse (image corrompue, modèle indisponible...),
// on autorise par défaut plutôt que de bloquer tous les envois de photos du site.
export async function contientContenuExplicite(buffer) {
  try {
    const modele = await chargerModele()
    const { data, info } = await sharp(buffer)
      .resize(224, 224, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const tensor = tf.tensor3d(data, [info.height, info.width, info.channels], 'int32')
    const predictions = await modele.classify(tensor)
    tensor.dispose()

    return predictions.some((p) => CLASSES_EXPLICITES.has(p.className) && p.probability > SEUIL_PROBABILITE)
  } catch (e) {
    console.error('[moderation] Échec analyse image, autorisée par défaut :', e.message)
    return false
  }
}
