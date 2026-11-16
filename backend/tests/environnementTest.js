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

// Le serveur ne crée le compte admin que si la table est vide : une base de test plus
// ancienne garde donc l'admin créé avec l'ANCIEN mot de passe du .env, et toute connexion
// admin des tests échoue (401). On réaligne ce compte sur le .env actuel, sans double
// authentification (un test l'active, un autre test ne doit pas en hériter). Appelé
// uniquement sur la base de test, après preparerEnvironnementTest().
export async function preparerAdminTest(db) {
  const bcrypt = (await import('bcryptjs')).default
  const hash = await bcrypt.hash(process.env.ADMIN_MOT_DE_PASSE, 10)
  await db.query(
    `INSERT INTO admins (identifiant, mot_de_passe_hash, cree_le) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       mot_de_passe_hash = VALUES(mot_de_passe_hash),
       totp_secret = NULL, totp_secret_attente = NULL, totp_dernier_pas = NULL`,
    [process.env.ADMIN_IDENTIFIANT, hash, new Date().toISOString()]
  )
}

export function preparerEnvironnementTest() {
  const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  try {
    process.loadEnvFile(path.join(racine, '.env'))
  } catch {
    // Pas de .env : les variables doivent déjà être dans l'environnement.
  }

  // 1. Base de données : les tests font des TRUNCATE.
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL manquant. Les tests effacent la base : créez une base MariaDB séparée ' +
        '(ex. signale_mayotte_test) et renseignez TEST_DATABASE_URL dans .env (voir .env.example).'
    )
  }
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL est identique à DATABASE_URL : les tests effaceraient la production.')
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

  // 2. Photos : la remise à zéro des tests vide l'espace de stockage. Sans cet espace
  // dédié, elle viderait celui de la production — toutes les photos des signalements et
  // tous les avatars —, même avec une base de test correctement séparée.
  process.env.ESPACE_PHOTOS = BUCKET_TESTS

  // 3. Emails : aucun test ne doit en envoyer de vrai. Les noms de variables suivent les
  // fournisseurs réellement utilisés par mailer.js (Brevo, puis Resend en secours).
  for (const cle of ['BREVO_API_KEY', 'BREVO_EXPEDITEUR', 'RESEND_API_KEY', 'RESEND_FROM']) {
    delete process.env[cle]
  }

  // 4. Journal NoSQL (NeDB) : les tests le vident. Ils écrivent donc dans leur propre
  // fichier, jamais dans le vrai journal (data/journal/journal-activite.db).
  process.env.JOURNAL_FICHIER = 'journal-test.db'

  // 5. Captcha : les tests appellent l'API sans navigateur, donc sans widget. Ils
  // vérifient la protection séparément (tests/unitaires/captcha.test.js).
  delete process.env.TURNSTILE_SITE_KEY
  delete process.env.TURNSTILE_SECRET_KEY
}
