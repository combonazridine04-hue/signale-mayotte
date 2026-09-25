import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idValide, texte, emailValide } from '../../validation.js'
import { lirePosition } from '../../signalements/localisation.js'
import { celluleCsv } from '../../signalements/csv.js'

// Tests sans base de données : ils tournent partout, y compris dans l'intégration
// continue, et couvrent les contrôles d'entrée dont dépend la sécurité des routes.

test('idValide accepte un entier positif, refuse tout le reste', () => {
  assert.equal(idValide('42'), 42)
  assert.equal(idValide(7), 7)
  for (const mauvais of ['abc', '', '0', '-3', '1.5', '1e3x', '2147483648', null, undefined, 'NaN']) {
    assert.equal(idValide(mauvais), null, `« ${mauvais} » devrait être refusé`)
  }
})

test('texte ne renvoie une chaîne que si on lui en donne une', () => {
  assert.equal(texte('bonjour'), 'bonjour')
  assert.equal(texte(12), '')
  assert.equal(texte(['a']), '')
  assert.equal(texte({ trim: 1 }), '')
  assert.equal(texte(undefined), '')
})

test('emailValide', () => {
  assert.equal(emailValide('nom@exemple.yt'), true)
  assert.equal(emailValide('pas-un-email'), false)
  assert.equal(emailValide('a@b'), false)
  assert.equal(emailValide(`${'a'.repeat(250)}@b.fr`), false)
  assert.equal(emailValide(42), false)
})

test('lirePosition : aucune position est autorisé', () => {
  assert.deepEqual(lirePosition(undefined, undefined), { latitude: null, longitude: null })
  assert.deepEqual(lirePosition('', ''), { latitude: null, longitude: null })
})

test('lirePosition : une position à Mayotte est acceptée', () => {
  // Mamoudzou, et Dzaoudzi sur Petite-Terre
  assert.deepEqual(lirePosition('-12.78', '45.23'), { latitude: -12.78, longitude: 45.23 })
  assert.deepEqual(lirePosition(-12.7806, 45.2567), { latitude: -12.7806, longitude: 45.2567 })
})

test('lirePosition refuse les positions incomplètes, illisibles ou hors de Mayotte', () => {
  assert.ok(lirePosition('-12.78', '').erreur, 'longitude manquante')
  assert.ok(lirePosition('abc', '45.2').erreur, 'NaN')
  assert.ok(lirePosition('Infinity', '45.2').erreur, 'infini')
  assert.ok(lirePosition('0', '0').erreur, 'point 0,0')
  assert.ok(lirePosition('48.85', '2.35').erreur, 'Paris')
  assert.ok(lirePosition('45.23', '-12.78').erreur, 'latitude et longitude inversées')
})

test('celluleCsv neutralise les formules et échappe les guillemets', () => {
  assert.equal(celluleCsv('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`)
  assert.equal(celluleCsv('+33 6 39'), `"'+33 6 39"`)
  assert.equal(celluleCsv('@SUM(A1)'), `"'@SUM(A1)"`)
  assert.equal(celluleCsv('Trou dans la route'), '"Trou dans la route"')
  // Un nombre négatif (latitude) reste un nombre, pas une formule.
  assert.equal(celluleCsv(-12.78), '"-12.78"')
  assert.equal(celluleCsv(null), '""')
})
