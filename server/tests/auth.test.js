import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { authHeader, connecterAdmin, cookieDeSession, demarrerServeurTest } from './helpers.js'

const { baseUrl, fermer } = await demarrerServeurTest()
// Importé après demarrerServeurTest() : c'est ce qui charge le .env (voir server/index.js).
const { genererTokenReinitialisation } = await import('../auth.js')

test('refuse un mauvais mot de passe', async () => {
  const reponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: 'admin', motDePasse: 'faux' })
  })
  assert.equal(reponse.status, 401)
})

test('accepte les bons identifiants et pose un cookie de session protégé', async () => {
  const reponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: process.env.ADMIN_IDENTIFIANT, motDePasse: process.env.ADMIN_MOT_DE_PASSE })
  })
  assert.equal(reponse.status, 200)
  const corps = await reponse.json()
  // Le jeton ne doit jamais être lisible par la page : ni dans la réponse, ni hors cookie HttpOnly.
  assert.equal(corps.token, undefined)
  const cookie = reponse.headers.getSetCookie().find((c) => c.startsWith('sm_session='))
  assert.ok(cookie, 'cookie de session posé')
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Strict/i)
  assert.match(cookie, /Path=\//i)
  assert.doesNotMatch(cookie, /Expires|Max-Age/i)
})

test('refuse toute route protégée sans cookie de session', async () => {
  const reponse = await fetch(`${baseUrl}/api/contact`)
  assert.equal(reponse.status, 401)
})

test("l'ancien en-tête Authorization n'ouvre plus aucune session", async () => {
  const cookie = await connecterAdmin(baseUrl)
  const jeton = cookie.split('=')[1]
  const reponse = await fetch(`${baseUrl}/api/contact`, { headers: { Authorization: `Bearer ${jeton}` } })
  assert.equal(reponse.status, 401)
})

test('la session devient invalide après déconnexion, et le cookie est effacé', async () => {
  const cookie = await connecterAdmin(baseUrl)

  const avant = await fetch(`${baseUrl}/api/contact`, { headers: authHeader(cookie) })
  assert.equal(avant.status, 200)

  const deconnexion = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: authHeader(cookie) })
  assert.match(deconnexion.headers.getSetCookie().join(), /sm_session=;/)

  const apres = await fetch(`${baseUrl}/api/contact`, { headers: authHeader(cookie) })
  assert.equal(apres.status, 401)
})

test('se reconnecter ferme la session précédente du même navigateur', async () => {
  const premier = await connecterAdmin(baseUrl)
  const reponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(premier) },
    body: JSON.stringify({ identifiant: process.env.ADMIN_IDENTIFIANT, motDePasse: process.env.ADMIN_MOT_DE_PASSE })
  })
  assert.ok(cookieDeSession(reponse))
  const ancien = await fetch(`${baseUrl}/api/contact`, { headers: authHeader(premier) })
  assert.equal(ancien.status, 401)
})

test('/session dit qui est connecté, sans jamais renvoyer le jeton', async () => {
  const anonyme = await fetch(`${baseUrl}/api/auth/session`)
  assert.deepEqual(await anonyme.json(), { type: null })

  const cookie = await connecterAdmin(baseUrl)
  const connecte = await fetch(`${baseUrl}/api/auth/session`, { headers: authHeader(cookie) })
  assert.deepEqual(await connecte.json(), { type: 'admin', identifiant: process.env.ADMIN_IDENTIFIANT })
})

test('refuse une requête venue d’un autre site (anti-CSRF)', async () => {
  const cookie = await connecterAdmin(baseUrl)
  const autreSite = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { ...authHeader(cookie), 'Sec-Fetch-Site': 'cross-site' }
  })
  assert.equal(autreSite.status, 403)

  const autreOrigine = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { ...authHeader(cookie), Origin: 'https://site-malveillant.example' }
  })
  assert.equal(autreOrigine.status, 403)

  // La session a survécu aux deux tentatives.
  const toujours = await fetch(`${baseUrl}/api/contact`, { headers: authHeader(cookie) })
  assert.equal(toujours.status, 200)
})

test('les réponses de l’API ne sont jamais mises en cache', async () => {
  const reponse = await fetch(`${baseUrl}/api/signalements`)
  assert.equal(reponse.headers.get('cache-control'), 'no-store')
})

test('rejette un token de réinitialisation invalide', async () => {
  const reponse = await fetch(`${baseUrl}/api/auth/reinitialiser-mot-de-passe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'inconnu', motDePasse: 'nouveauMotDePasse123' })
  })
  assert.equal(reponse.status, 400)
})

test('permet de réinitialiser le mot de passe avec un token valide, puis se connecter avec le nouveau', async () => {
  const email = `citoyen-${Date.now()}@example.com`
  const inscription = await fetch(`${baseUrl}/api/auth/inscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Citoyen Test', email, motDePasse: 'motDePasseInitial1' })
  })
  assert.equal(inscription.status, 201)

  // La demande /mot-de-passe-oublie ne révèle jamais le token (email désactivé en test) :
  // on le récupère directement via la fonction serveur pour simuler le lien reçu par email.
  const { token } = await genererTokenReinitialisation(email)

  const reinitialisation = await fetch(`${baseUrl}/api/auth/reinitialiser-mot-de-passe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, motDePasse: 'nouveauMotDePasse123' })
  })
  assert.equal(reinitialisation.status, 204)

  const ancienMotDePasse = await fetch(`${baseUrl}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: email, motDePasse: 'motDePasseInitial1' })
  })
  assert.equal(ancienMotDePasse.status, 401)

  const nouveauMotDePasse = await fetch(`${baseUrl}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: email, motDePasse: 'nouveauMotDePasse123' })
  })
  assert.equal(nouveauMotDePasse.status, 200)
})

test('/mot-de-passe-oublie répond toujours 204, compte existant ou non', async () => {
  const reponse = await fetch(`${baseUrl}/api/auth/mot-de-passe-oublie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'inconnu@example.com' })
  })
  assert.equal(reponse.status, 204)
})

after(fermer)
