import { preparerEnvironnementTest } from './environnementTest.js'

export async function demarrerServeurTest() {
  preparerEnvironnementTest()

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

// Les tests parlent au serveur en HTTP : le cookie porte donc son nom sans préfixe __Host-.
export function cookieDeSession(reponse) {
  const cookie = reponse.headers.getSetCookie().find((c) => c.startsWith('sm_session='))
  return cookie ? cookie.split(';')[0] : ''
}

export function authHeader(cookie) {
  return { Cookie: cookie }
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
  return cookieDeSession(reponse)
}
