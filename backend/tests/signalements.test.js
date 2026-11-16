import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { authHeader, connecterAdmin, demarrerServeurTest } from './helpers.js'

const { baseUrl, fermer } = await demarrerServeurTest()
let token

before(async () => {
  token = await connecterAdmin(baseUrl)
})

test('liste les 3 signalements de démo au démarrage', async () => {
  const reponse = await fetch(`${baseUrl}/api/signalements`, { headers: authHeader(token) })
  const donnees = await reponse.json()
  assert.equal(donnees.signalements.length, 3)
  assert.equal(donnees.total, 3)
})

test('rejette une description trop courte', async () => {
  const donnees = new FormData()
  donnees.set('categorie', 'Eau')
  donnees.set('commune', 'Dzaoudzi')
  donnees.set('description', 'court')

  const reponse = await fetch(`${baseUrl}/api/signalements`, {
    method: 'POST',
    headers: authHeader(token),
    body: donnees
  })
  assert.equal(reponse.status, 400)
})

test('rejette une catégorie invalide', async () => {
  const donnees = new FormData()
  donnees.set('categorie', 'Catégorie inexistante')
  donnees.set('commune', 'Dzaoudzi')
  donnees.set('description', 'Description suffisamment longue pour passer.')

  const reponse = await fetch(`${baseUrl}/api/signalements`, {
    method: 'POST',
    headers: authHeader(token),
    body: donnees
  })
  assert.equal(reponse.status, 400)
})

test('cycle complet : créer, modifier, changer le statut puis supprimer', async () => {
  const donnees = new FormData()
  donnees.set('categorie', 'Eau')
  donnees.set('commune', 'Dzaoudzi')
  donnees.set('description', "Fuite d'eau testée automatiquement par la suite de tests.")
  donnees.set('latitude', '-12.78')
  donnees.set('longitude', '45.23')

  const creation = await fetch(`${baseUrl}/api/signalements`, {
    method: 'POST',
    headers: authHeader(token),
    body: donnees
  })
  assert.equal(creation.status, 201)
  const cree = await creation.json()
  assert.equal(cree.statut, 'Signalé')
  assert.equal(cree.latitude, -12.78)

  const modification = new FormData()
  modification.set('categorie', 'Voirie')
  modification.set('commune', 'Mamoudzou')
  modification.set('description', 'Description modifiée par la suite de tests automatisés.')

  const miseAJour = await fetch(`${baseUrl}/api/signalements/${cree.id}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: modification
  })
  assert.equal(miseAJour.status, 200)
  const modifie = await miseAJour.json()
  assert.equal(modifie.categorie, 'Voirie')
  assert.equal(modifie.latitude, -12.78, 'la position existante doit être conservée si non renvoyée')

  const patchStatut = await fetch(`${baseUrl}/api/signalements/${cree.id}`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ statut: 'Résolu' })
  })
  assert.equal(patchStatut.status, 200)
  assert.equal((await patchStatut.json()).statut, 'Résolu')

  const suppression = await fetch(`${baseUrl}/api/signalements/${cree.id}`, {
    method: 'DELETE',
    headers: authHeader(token)
  })
  assert.equal(suppression.status, 204)

  const verification = await fetch(`${baseUrl}/api/signalements/${cree.id}`, { headers: authHeader(token) })
  assert.equal(verification.status, 404)
})

test('renvoie 404 sur un signalement inexistant', async () => {
  const reponse = await fetch(`${baseUrl}/api/signalements/999999`, { headers: authHeader(token) })
  assert.equal(reponse.status, 404)
})

after(fermer)
