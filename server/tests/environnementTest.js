import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Prépare l'environnement de TOUS les tests (API et parcours navigateur). Doit être
// appelé avant d'importer le moindre module du serveur, qui lit sa configuration au
// chargement.
//
// Un seul module, et non une copie par suite de tests : c'est parce que cette garde
// était recopiée qu'elle avait été oubliée sur le test de parcours, lequel aurait alors
// effacé la base de production comme la première fois.

export const BUCKET_TESTS = 'signalement-photos-tests'

export function preparerEnvironnementTest() {
  const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  try {
    process.loadEnvFile(path.join(racine, '.env'))
  } catch {
    // Pas de .env : les variables doivent déjà être dans l'environnement.
  }

  // 1. Base de données : les tests font des TRUNCATE.
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL manquant. Les tests effacent la base : créez un projet Supabase séparé ' +
        'pour les tests et renseignez TEST_DATABASE_URL dans .env (voir .env.example).'
    )
  }
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL est identique à DATABASE_URL : les tests effaceraient la production.')
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

  // 2. Photos : la remise à zéro des tests vide l'espace de stockage. Sans cet espace
  // dédié, elle viderait celui de la production — toutes les photos des signalements et
  // tous les avatars —, même avec une base de test correctement séparée.
  process.env.SUPABASE_BUCKET = BUCKET_TESTS

  // 3. Emails : aucun test ne doit en envoyer de vrai. Les noms de variables suivent les
  // fournisseurs réellement utilisés par mailer.js (Brevo, puis Resend en secours).
  for (const cle of ['BREVO_API_KEY', 'BREVO_EXPEDITEUR', 'RESEND_API_KEY', 'RESEND_FROM']) {
    delete process.env[cle]
  }
}
