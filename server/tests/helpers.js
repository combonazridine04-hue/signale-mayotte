export async function demarrerServeurTest() {
  const path = (await import('node:path')).default
  const { fileURLToPath } = await import('node:url')
  const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  try {
    process.loadEnvFile(path.join(racine, '.env'))
  } catch {
    // Pas de .env : les variables doivent déjà être dans l'environnement.
  }

  // Garde-fou critique : les tests font des TRUNCATE sur la base. Sans base de test
  // séparée, ils effaceraient les données réelles de la base de production.
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL manquant. Les tests ne doivent jamais tourner sur la base de production : " +
      "créez un projet Supabase séparé pour les tests et renseignez TEST_DATABASE_URL dans .env (voir .env.example)."
    )
  }
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL est identique à DATABASE_URL : les tests effaceraient les données de production. " +
      "Utilisez un projet Supabase distinct pour TEST_DATABASE_URL."
    )
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

  delete process.env.EMAIL_EXPEDITEUR
  delete process.env.EMAIL_MOT_DE_PASSE_APP

  const { app } = await import('../index.js')
  const { reinitialiserDonneesDemo } = await import('../db.js')
  await reinitialiserDonneesDemo()

  const serveur = app.listen(0)
  await new Promise((resolve) => serveur.once('listening', resolve))
  const port = serveur.address().port

  return {
    baseUrl: `http://localhost:${port}`,
    fermer: () => new Promise((resolve) => serveur.close(resolve))
  }
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

export async function connecterAdmin(baseUrl) {
  const reponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifiant: process.env.ADMIN_IDENTIFIANT,
      motDePasse: process.env.ADMIN_MOT_DE_PASSE
    })
  })
  const { token } = await reponse.json()
  return token
}
