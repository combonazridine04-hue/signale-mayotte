export async function demarrerServeurTest() {
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
