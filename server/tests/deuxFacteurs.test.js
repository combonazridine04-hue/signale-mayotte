import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { authHeader, connecterAdmin, cookieDeSession, demarrerServeurTest } from './helpers.js'

// Fichier séparé : chaque fichier de test a son propre serveur, donc son propre compteur
// de tentatives de connexion (10 par quart d'heure).
const { baseUrl, fermer } = await demarrerServeurTest()

test('double authentification : une fois activée, le mot de passe seul ne suffit plus', async () => {
  const { codePourPas, pasCourant } = await import('../totp.js')
  const admin = await connecterAdmin(baseUrl)
  const identifiant = `admin-2fa-${Date.now()}`
  const motDePasse = 'MotDePasse2faTest!'
  const json = { 'Content-Type': 'application/json' }
  await fetch(`${baseUrl}/api/admins`, {
    method: 'POST',
    headers: { ...json, ...authHeader(admin) },
    body: JSON.stringify({ identifiant, motDePasse })
  })
  const connexion = () =>
    fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ identifiant, motDePasse })
    })
  const session = cookieDeSession(await connexion())

  const { secret, qr } = await (
    await fetch(`${baseUrl}/api/admins/me/2fa/preparer`, { method: 'POST', headers: authHeader(session) })
  ).json()
  assert.match(qr, /^data:image\/png;base64,/)
  const faux = await fetch(`${baseUrl}/api/admins/me/2fa/activer`, {
    method: 'POST',
    headers: { ...json, ...authHeader(session) },
    body: JSON.stringify({ code: '000000' === codePourPas(secret, pasCourant()) ? '111111' : '000000' })
  })
  assert.equal(faux.status, 400)
  const codeActivation = codePourPas(secret, pasCourant())
  const activation = await fetch(`${baseUrl}/api/admins/me/2fa/activer`, {
    method: 'POST',
    headers: { ...json, ...authHeader(session) },
    body: JSON.stringify({ code: codeActivation })
  })
  assert.equal(activation.status, 204)

  const sansCode = await connexion()
  assert.equal(sansCode.status, 401)
  assert.equal((await sansCode.json()).codeRequis, true)
  assert.equal(cookieDeSession(sansCode), '')

  // Le code d'activation a déjà servi : il ne peut pas être rejoué pour se connecter.
  const rejoue = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ identifiant, motDePasse, code: codeActivation })
  })
  assert.equal(rejoue.status, 401)

  const liste = await (await fetch(`${baseUrl}/api/admins`, { headers: authHeader(admin) })).json()
  const compte = liste.find((c) => c.identifiant === identifiant)
  assert.equal(compte.deuxFacteurs, true)
  assert.equal(JSON.stringify(liste).includes(secret), false)

  const reinit = await fetch(`${baseUrl}/api/admins/${compte.id}/2fa`, { method: 'DELETE', headers: authHeader(admin) })
  assert.equal(reinit.status, 204)
  assert.equal((await connexion()).status, 200)
})

after(fermer)
