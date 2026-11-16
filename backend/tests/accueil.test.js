import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { demarrerServeurTest } from './helpers.js'

// Adresses « techniques » de l'API : accueil, état de santé, adresses inconnues.

const { baseUrl, fermer } = await demarrerServeurTest()

test("l'accueil de l'API présente l'API en JSON", async () => {
  const reponse = await fetch(`${baseUrl}/`)
  assert.equal(reponse.status, 200)
  const donnees = await reponse.json()
  assert.equal(donnees.nom, 'API Signale Mayotte')
  assert.equal(donnees.sante, '/api/sante')
})

test("l'état de santé confirme que l'API et la base répondent", async () => {
  const reponse = await fetch(`${baseUrl}/api/sante`)
  assert.equal(reponse.status, 200)
  const donnees = await reponse.json()
  assert.equal(donnees.statut, 'ok')
  assert.equal(donnees.baseDeDonnees, 'ok')
})

test('une adresse inconnue répond 404 en JSON, sans la page « Cannot GET » d’Express', async () => {
  for (const chemin of ['/nexiste-pas', '/api/nexiste-pas']) {
    const reponse = await fetch(`${baseUrl}${chemin}`)
    assert.equal(reponse.status, 404)
    assert.match(reponse.headers.get('content-type'), /application\/json/)
    const donnees = await reponse.json()
    assert.ok(donnees.erreur)
  }
})

after(fermer)
