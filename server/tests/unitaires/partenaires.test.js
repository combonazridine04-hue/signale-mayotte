import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dansLePerimetre, libellePerimetre } from '../../../shared/perimetrePartenaire.js'

delete process.env.ALERTES_PARTENAIRES_REELLES
process.env.EMAIL_TEST_PARTENAIRES = 'boite-de-test@example.com'
const { messageAlertePartenaire } = await import('../../mailer.js')

const sidevam = { nom: 'SIDEVAM976', commune: null, categories: ['Dépôt sauvage / déchets'] }
const mairie = { nom: 'Mairie de Koungou', commune: 'Koungou', categories: [] }
const dechetsKoungou = { categorie: 'Dépôt sauvage / déchets', commune: 'Koungou' }
const eauKoungou = { categorie: 'Eau', commune: 'Koungou' }
const dechetsSada = { categorie: 'Dépôt sauvage / déchets', commune: 'Sada' }

test('périmètre : un domaine sur toute l’île, ou une commune pour tous les domaines', () => {
  assert.equal(dansLePerimetre(sidevam, dechetsKoungou), true)
  assert.equal(dansLePerimetre(sidevam, dechetsSada), true)
  assert.equal(dansLePerimetre(sidevam, eauKoungou), false)
  assert.equal(dansLePerimetre(mairie, eauKoungou), true)
  assert.equal(dansLePerimetre(mairie, dechetsSada), false)
  assert.equal(dansLePerimetre({ commune: 'Sada', categories: ['Eau'] }, eauKoungou), false)
  assert.equal(libellePerimetre(sidevam), 'Dépôt sauvage / déchets · toutes les communes')
})

test('alerte partenaire : toujours vers la boîte de test, jamais l’adresse réelle', () => {
  const message = messageAlertePartenaire(
    { nom: 'SIDEVAM976', email: 'contact@sidevam.example' },
    {
      id: 7,
      ...dechetsKoungou,
      description: 'Tas de déchets <b>près</b> du marché',
      dateSignalement: new Date().toISOString(),
      urgent: true
    }
  )
  assert.equal(message.to, 'boite-de-test@example.com')
  assert.match(message.subject, /^\[TEST\] URGENT — Nouveau signalement pour SIDEVAM976/)
  assert.match(message.text, /destiné à SIDEVAM976 \(contact@sidevam\.example\)/)
  assert.match(message.html, /\/signalements\/7/)
  assert.doesNotMatch(message.html, /<b>près<\/b>/, 'le texte du citoyen est échappé dans le HTML')
})
