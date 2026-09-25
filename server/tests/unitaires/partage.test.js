import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliserTelephone, telephoneValide } from '../../../shared/telephone.js'
import { nomPublic } from '../../../shared/nomPublic.js'
import { motDePasseInterdit } from '../../../shared/motDePasse.js'

// Règles partagées entre le navigateur et le serveur : une régression ici casserait
// les deux côtés à la fois.

test('un numéro mahorais a une seule forme enregistrée (RG-07)', () => {
  assert.equal(normaliserTelephone('06 39 06 50 31'), '0639065031')
  assert.equal(normaliserTelephone('+262 639 06 50 31'), '0639065031')
  assert.equal(telephoneValide('0639065031'), true)
  assert.equal(telephoneValide('12345'), false)
})

test("l'identité publique est abrégée (RG-18)", () => {
  assert.equal(nomPublic('Zakaria Bacar'), 'Zakaria B.')
  assert.equal(nomPublic('Zakaria'), 'Zakaria')
})

test('les mots de passe trop courts ou trop courants sont refusés (RG-08)', () => {
  assert.ok(motDePasseInterdit('court'))
  assert.ok(motDePasseInterdit('12345678'))
  assert.ok(motDePasseInterdit('MAYOTTE976'), 'la casse ne doit pas permettre de contourner la liste')
  assert.ok(motDePasseInterdit(undefined))
  assert.equal(motDePasseInterdit('Lagon-Bleu-2026'), '', 'aucun refus : chaîne vide')
})
