import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrerServeurTest } from './helpers.js'

const { baseUrl, fermer } = await demarrerServeurTest()

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

after(fermer)
