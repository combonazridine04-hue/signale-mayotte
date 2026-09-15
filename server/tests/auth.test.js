import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrerServeurTest } from './helpers.js'

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

test('accepte les bons identifiants et renvoie un jeton', async () => {
  const reponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: process.env.ADMIN_IDENTIFIANT, motDePasse: process.env.ADMIN_MOT_DE_PASSE })
  })
  assert.equal(reponse.status, 200)
  const { token } = await reponse.json()
  assert.ok(token && token.length > 10)
})

test('refuse toute route protégée sans jeton', async () => {
  const reponse = await fetch(`${baseUrl}/api/contact`)
  assert.equal(reponse.status, 401)
})

test('le jeton devient invalide après déconnexion', async () => {
  const connexion = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: process.env.ADMIN_IDENTIFIANT, motDePasse: process.env.ADMIN_MOT_DE_PASSE })
  })
  const { token } = await connexion.json()

  const avant = await fetch(`${baseUrl}/api/contact`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(avant.status, 200)

  await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })

  const apres = await fetch(`${baseUrl}/api/contact`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(apres.status, 401)
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
