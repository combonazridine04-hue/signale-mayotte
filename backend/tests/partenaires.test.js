import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { authHeader, connecterAdmin, demarrerServeurTest } from './helpers.js'

// Vitrine des partenaires sur la page d'accueil, et logo géré depuis l'espace admin.

const { baseUrl, fermer } = await demarrerServeurTest()
const cookieAdmin = await connecterAdmin(baseUrl)
const crees = []

async function creerPartenaire(nom, identifiant) {
  const reponse = await fetch(`${baseUrl}/api/partenaires`, {
    method: 'POST',
    headers: { ...authHeader(cookieAdmin), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom,
      identifiant,
      motDePasse: 'MotDePasseTres-Solide-2026',
      email: `${identifiant}@example.com`
    })
  })
  assert.equal(reponse.status, 201)
  const compte = await reponse.json()
  crees.push(compte.id)
  return compte
}

async function envoyerLogo(id, cookie) {
  // Logo large (800 × 200) : il doit être réduit SANS être recadré.
  const png = await sharp({ create: { width: 800, height: 200, channels: 4, background: '#16a34a' } })
    .png()
    .toBuffer()
  const donnees = new FormData()
  donnees.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png')
  return fetch(`${baseUrl}/api/partenaires/${id}/logo`, { method: 'PUT', headers: authHeader(cookie), body: donnees })
}

const lirePublics = async () => (await fetch(`${baseUrl}/api/partenaires-publics`)).json()

test('la vitrine publique montre le nom des partenaires, sans leurs données privées', async () => {
  await creerPartenaire('EDM', 'edm-test')
  const publics = await lirePublics()
  const edm = publics.find((p) => p.nom === 'EDM')
  assert.deepEqual(edm, { nom: 'EDM', logoUrl: '' })
  assert.equal(JSON.stringify(publics).includes('edm-test'), false, "ni l'identifiant ni l'e-mail")
})

test("l'admin ajoute un logo : réduit sans recadrage, puis visible sur la vitrine", async () => {
  const sogea = await creerPartenaire('SOGEA', 'sogea-test')
  const reponse = await envoyerLogo(sogea.id, cookieAdmin)
  assert.equal(reponse.status, 200)
  const { logoUrl } = await reponse.json()
  assert.match(logoUrl, /^\/uploads\/.+\.png$/)

  const image = await fetch(`${baseUrl}${logoUrl}`)
  assert.equal(image.status, 200)
  const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
  assert.equal(width, 480)
  assert.equal(height, 120)

  const publics = await lirePublics()
  assert.equal(publics.find((p) => p.nom === 'SOGEA').logoUrl, logoUrl)

  const retrait = await fetch(`${baseUrl}/api/partenaires/${sogea.id}/logo`, {
    method: 'DELETE',
    headers: authHeader(cookieAdmin)
  })
  assert.equal(retrait.status, 204)
  assert.equal((await lirePublics()).find((p) => p.nom === 'SOGEA').logoUrl, '')
  assert.equal((await fetch(`${baseUrl}${logoUrl}`)).status, 404, 'le fichier du logo est supprimé')
})

test("sans être admin, impossible de changer le logo d'un partenaire", async () => {
  const mairie = await creerPartenaire('Mairie test', 'mairie-test')
  const reponse = await envoyerLogo(mairie.id, '')
  assert.equal(reponse.status, 401)
})

// Les comptes partenaires ne sont pas remis à zéro entre deux lancements : on les retire.
after(async () => {
  for (const id of crees) {
    await fetch(`${baseUrl}/api/partenaires/${id}`, { method: 'DELETE', headers: authHeader(cookieAdmin) })
  }
  await fermer()
})
