// Capture chaque planche de wireframes.html en image PNG, dans ce même dossier.
// Lancement (depuis la racine du dépôt) : node docs/maquettes/wireframes/capturer.mjs
// Utilise le navigateur de test déjà installé pour le back-end (playwright-chromium).
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const dossier = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(dossier, '..', '..', '..', 'backend', 'package.json'))
const { chromium } = require('playwright-chromium')

const navigateur = await chromium.launch()
const page = await navigateur.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 })
await page.goto(pathToFileURL(path.join(dossier, 'wireframes.html')).href)

for (const id of await page.$$eval('section.planche', (s) => s.map((x) => x.id))) {
  await page.locator(`#${id}`).screenshot({ path: path.join(dossier, `${id}.png`) })
  console.log('planche', id)
}
await navigateur.close()
