import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// Un échec de captcha est journalisé : ces tests écrivent dans le journal de test, jamais
// dans le vrai (voir src/services/journalService.js).
process.env.JOURNAL_FICHIER = 'journal-test.db'
const { exigerCaptcha, configurationPublique, verifierJeton } = await import('../../src/services/captchaService.js')

const fetchOriginal = globalThis.fetch
let appels

// Remplace Cloudflare par une réponse choisie, et garde ce que le serveur lui a envoyé.
function simulerCloudflare(reponse) {
  globalThis.fetch = async (url, options) => {
    appels.push({ url, corps: new URLSearchParams(options.body) })
    if (reponse instanceof Error) throw reponse
    return { ok: true, json: async () => reponse }
  }
}

// Fait passer une fausse requête dans le middleware et rapporte ce qu'il a décidé.
async function passer(corps) {
  const req = { body: corps, ip: '203.0.113.7', originalUrl: '/api/contact' }
  let statut = null
  let reponse = null
  let suivant = false
  const res = {
    status(code) {
      statut = code
      return this
    },
    json(donnees) {
      reponse = donnees
      return this
    }
  }
  await exigerCaptcha(req, res, () => (suivant = true))
  return { statut, reponse, suivant }
}

beforeEach(() => {
  appels = []
  process.env.TURNSTILE_SITE_KEY = 'cle-site-test'
  process.env.TURNSTILE_SECRET_KEY = 'cle-secrete-test'
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
  delete process.env.TURNSTILE_SITE_KEY
  delete process.env.TURNSTILE_SECRET_KEY
})

test('captcha : sans clés, la vérification est désactivée et rien ne part chez Cloudflare', async () => {
  delete process.env.TURNSTILE_SECRET_KEY
  simulerCloudflare({ success: false })
  const { suivant } = await passer({})
  assert.equal(suivant, true)
  assert.equal(appels.length, 0)
  assert.deepEqual(configurationPublique(), { actif: false })
})

test('captcha : la clé secrète ne sort jamais dans la configuration publique', () => {
  const config = configurationPublique()
  assert.deepEqual(config, { actif: true, cleSite: 'cle-site-test' })
  assert.ok(!JSON.stringify(config).includes('cle-secrete-test'))
})

test('captcha : un jeton validé par Cloudflare laisse passer la requête', async () => {
  simulerCloudflare({ success: true })
  const { suivant, statut } = await passer({ captcha: 'jeton-valide' })
  assert.equal(suivant, true)
  assert.equal(statut, null)
  // Le serveur envoie bien la clé SECRÈTE, le jeton et l'IP du visiteur.
  assert.equal(appels[0].corps.get('secret'), 'cle-secrete-test')
  assert.equal(appels[0].corps.get('response'), 'jeton-valide')
  assert.equal(appels[0].corps.get('remoteip'), '203.0.113.7')
})

test('captcha : un jeton refusé par Cloudflare bloque la requête (400)', async () => {
  simulerCloudflare({ success: false, 'error-codes': ['invalid-input-response'] })
  const { suivant, statut, reponse } = await passer({ captcha: 'jeton-invente' })
  assert.equal(suivant, false)
  assert.equal(statut, 400)
  assert.equal(reponse.captcha, true)
})

test('captcha : sans jeton, la requête est bloquée sans même interroger Cloudflare', async () => {
  simulerCloudflare({ success: true })
  for (const corps of [{}, { captcha: '' }, { captcha: { $ne: '' } }, { captcha: 'x'.repeat(5000) }]) {
    const { suivant, statut } = await passer(corps)
    assert.equal(suivant, false)
    assert.equal(statut, 400)
  }
  assert.equal(appels.length, 0)
})

test('captcha : Cloudflare injoignable → refus (503), jamais un passage par défaut', async () => {
  simulerCloudflare(new Error('réseau coupé'))
  const { suivant, statut } = await passer({ captcha: 'jeton' })
  assert.equal(suivant, false)
  assert.equal(statut, 503)
  assert.equal(await verifierJeton('jeton'), 'indisponible')
})
