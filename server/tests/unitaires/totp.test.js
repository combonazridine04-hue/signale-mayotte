import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codePourPas, genererSecret, lienOtpauth, verifierCode } from '../../totp.js'

// Vecteurs officiels de la RFC 6238 (SHA-1, secret ASCII « 12345678901234567890 »).
const SECRET_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

test('TOTP : conforme aux vecteurs de test de la RFC 6238', () => {
  assert.equal(codePourPas(SECRET_RFC, Math.floor(59 / 30), 8), '94287082')
  assert.equal(codePourPas(SECRET_RFC, Math.floor(1111111109 / 30), 8), '07081804')
  assert.equal(codePourPas(SECRET_RFC, Math.floor(1234567890 / 30), 8), '89005924')
  assert.equal(codePourPas(SECRET_RFC, Math.floor(20000000000 / 30), 8), '65353130')
})

test("TOTP : accepte le code du moment et d'un pas voisin, refuse le reste", () => {
  const secret = genererSecret()
  const t = 1_800_000_000_000
  const pas = Math.floor(t / 30000)
  assert.equal(verifierCode(secret, codePourPas(secret, pas), { maintenantMs: t }), pas)
  assert.equal(verifierCode(secret, codePourPas(secret, pas - 1), { maintenantMs: t }), pas - 1)
  assert.equal(verifierCode(secret, codePourPas(secret, pas - 3), { maintenantMs: t }), null)
  assert.equal(verifierCode(secret, '12345', { maintenantMs: t }), null)
  assert.equal(verifierCode(secret, 'abcdef', { maintenantMs: t }), null)
  assert.equal(verifierCode(secret, undefined, { maintenantMs: t }), null)
})

test('TOTP : un code déjà utilisé ne peut pas être rejoué', () => {
  const secret = genererSecret()
  const t = 1_800_000_000_000
  const pas = Math.floor(t / 30000)
  const code = codePourPas(secret, pas)
  assert.equal(verifierCode(secret, code, { maintenantMs: t, dernierPasUtilise: pas }), null)
})

test('TOTP : secret de 32 caractères base32 et lien pour les applis', () => {
  const secret = genererSecret()
  assert.match(secret, /^[A-Z2-7]{32}$/)
  assert.match(
    lienOtpauth(secret, 'marie'),
    /^otpauth:\/\/totp\/Signale%20Mayotte%3Amarie\?secret=[A-Z2-7]{32}&issuer=/
  )
})
