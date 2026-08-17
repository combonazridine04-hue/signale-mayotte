import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-chromium'

delete process.env.EMAIL_EXPEDITEUR
delete process.env.EMAIL_MOT_DE_PASSE_APP

const { app } = await import('../../server/index.js')
const { reinitialiserDonneesDemo } = await import('../../server/db.js')
await reinitialiserDonneesDemo()
const serveur = app.listen(0)
await new Promise((resolve) => serveur.once('listening', resolve))
const port = serveur.address().port
const BASE = `http://localhost:${port}/`

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)
const dossierTemp = mkdtempSync(path.join(tmpdir(), 'signale-mayotte-e2e-'))
const cheminPhoto = path.join(dossierTemp, 'photo-test.png')
writeFileSync(cheminPhoto, PNG_1PX)

let echecs = 0
function verifier(condition, message) {
  if (condition) {
    console.log(`✔ ${message}`)
  } else {
    echecs++
    console.error(`✘ ${message}`)
  }
}

const browser = await chromium.launch()
const context = await browser.newContext()
await context.grantPermissions(['geolocation'], { origin: BASE })
await context.setGeolocation({ latitude: -12.78, longitude: 45.23 })
const page = await context.newPage()
const erreursConsole = []
page.on('pageerror', (err) => erreursConsole.push(err.message))

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page
    .locator('.signalement-card')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {})
  verifier((await page.locator('.signalement-card').count()) === 3, "3 signalements de démo visibles à l'accueil sans connexion")

  await page.goto(BASE + 'signaler', { waitUntil: 'networkidle' })
  await page.selectOption('#categorie', 'Eau')
  await page.selectOption('#commune', 'Dzaoudzi')
  await page.fill('#description', 'Fuite d\'eau testée par la suite end-to-end.')
  await page.setInputFiles('.photo-dropzone input[type=file]', cheminPhoto)
  await page.click('button:has-text("Utiliser ma position actuelle")')
  await page.waitForTimeout(500)
  const [reponseCreation] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/signalements') && r.request().method() === 'POST', { timeout: 20000 }),
    page.click('button[type=submit]')
  ])
  verifier(reponseCreation.ok(), `création du signalement acceptée par le serveur (statut ${reponseCreation.status()})`)
  await page.waitForURL(/\/signalements\/\d+/, { timeout: 10000 })
  await page.waitForTimeout(300)

  const urlDetail = page.url()
  verifier(/\/signalements\/\d+/.test(urlDetail), 'redirection vers la fiche détail après création')
  verifier(await page.locator('.alert-success').isVisible(), 'bannière de succès affichée')

  await page.goto(BASE + 'carte', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const nbMarqueurs = await page.locator('.carte-marker').count()
  verifier(nbMarqueurs >= 1, `au moins un marqueur affiché sur la carte (trouvé ${nbMarqueurs})`)

  console.log('')
  console.log('--- suppression par le créateur, sans être admin ---')
  await page.goto(BASE + 'signaler', { waitUntil: 'networkidle' })
  await page.selectOption('#categorie', 'Voirie')
  await page.selectOption('#commune', 'Sada')
  await page.fill('#description', 'Signalement que je vais supprimer moi-même, sans être admin.')
  const [reponseCreationJetable] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/signalements') && r.request().method() === 'POST', { timeout: 20000 }),
    page.click('button[type=submit]')
  ])
  const creeJetable = await reponseCreationJetable.json()
  verifier(Boolean(creeJetable.tokenSuppression), 'un jeton de suppression est renvoyé au créateur à la création')
  await page.waitForURL(/\/signalements\/\d+/, { timeout: 10000 })
  const boutonSupprimerCreateur = await page
    .locator('button:has-text("Supprimer")')
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false)

  verifier(boutonSupprimerCreateur, 'le créateur (non-admin) voit le bouton Supprimer sur son propre signalement')
  verifier(!(await page.locator('button:has-text("Modifier")').isVisible()), "le créateur (non-admin) ne voit PAS le bouton Modifier (réservé à l'admin)")

  await page.click('button:has-text("Supprimer")')
  await page.waitForTimeout(200)
  const [reponseSuppressionCreateur] = await Promise.all([
    page.waitForResponse((r) => /\/api\/signalements\/\d+(\?|$)/.test(r.url()) && r.request().method() === 'DELETE', { timeout: 20000 }),
    page.click('.dialogue-btn--danger:has-text("Confirmer")')
  ])
  verifier(reponseSuppressionCreateur.ok(), `un non-admin peut supprimer son propre signalement via son jeton (statut ${reponseSuppressionCreateur.status()})`)
  await page.waitForURL(BASE, { timeout: 10000 })

  await page.goto(BASE + 'admin', { waitUntil: 'networkidle' })
  verifier(/\/admin\/login$/.test(page.url()), "accès à /admin sans connexion redirige vers l'écran de connexion")

  await page.goto(BASE + 'admin/login', { waitUntil: 'networkidle' })
  await page.fill('#identifiant', process.env.ADMIN_IDENTIFIANT)
  await page.fill('#motDePasse', process.env.ADMIN_MOT_DE_PASSE)
  const [reponseLogin] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 20000 }),
    page.click('button[type=submit]')
  ])
  verifier(reponseLogin.ok(), `connexion admin acceptée par le serveur (statut ${reponseLogin.status()})`)
  await page.waitForURL(/\/admin$/, { timeout: 10000 })
  await page.waitForTimeout(300)
  verifier(await page.locator('.admin-sidebar').isVisible(), 'connexion admin réussie, tableau de bord affiché')
  verifier(/\/admin$/.test(page.url()), 'redirection vers /admin après connexion')

  const texteJetable = 'Signalement jetable créé uniquement pour tester la suppression depuis le tableau admin.'
  await fetch(`${BASE}api/signalements`, {
    method: 'POST',
    body: (() => {
      const f = new FormData()
      f.set('categorie', 'Eau')
      f.set('commune', 'Sada')
      f.set('description', texteJetable)
      return f
    })()
  })

  // Le tableau de bord admin ne charge les données qu'au montage : on recharge la page
  // pour être sûr que le signalement jetable créé ci-dessus apparaît bien dans le tableau.
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('.admin-nav-item:has-text("Signalements")')
  await page.waitForTimeout(500)
  // Trié par date décroissante : le signalement jetable, tout juste créé, est forcément en première ligne.
  const ligneJetable = page.locator('.admin-table tbody tr').first()
  const nbLignesAvant = await page.locator('.admin-table tbody tr').count()
  await ligneJetable.locator('button:has-text("Supprimer")').click()
  await page.waitForTimeout(200)
  verifier(await page.locator('.dialogue-card').isVisible(), 'fenêtre de confirmation personnalisée affichée (tableau admin)')
  const [reponseSuppressionAdmin] = await Promise.all([
    page.waitForResponse((r) => /\/api\/signalements\/\d+$/.test(r.url()) && r.request().method() === 'DELETE', { timeout: 20000 }),
    page.click('.dialogue-btn--danger:has-text("Confirmer")')
  ])
  verifier(reponseSuppressionAdmin.ok(), `suppression depuis le tableau admin acceptée (statut ${reponseSuppressionAdmin.status()})`)
  await page.waitForTimeout(500)
  const nbLignesApres = await page.locator('.admin-table tbody tr').count()
  verifier(nbLignesApres === nbLignesAvant - 1, `la ligne supprimée disparaît immédiatement du tableau admin (avant: ${nbLignesAvant}, après: ${nbLignesApres})`)

  await page.goto(urlDetail, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Modifier")')
  await page.waitForTimeout(300)
  await page.fill('#edit-description', 'Description mise à jour par la suite end-to-end.')
  const [reponseModification] = await Promise.all([
    page.waitForResponse((r) => /\/api\/signalements\/\d+$/.test(r.url()) && r.request().method() === 'PUT', { timeout: 20000 }),
    page.click('button:has-text("Enregistrer")')
  ])
  verifier(reponseModification.ok(), `modification acceptée par le serveur (statut ${reponseModification.status()})`)
  await page.waitForTimeout(500)
  verifier(
    (await page.locator('.card-glass p.text-secondary').first().textContent())?.includes('mise à jour'),
    'modification bien enregistrée'
  )

  await page.click('button:has-text("Supprimer")')
  await page.waitForTimeout(200)
  verifier(await page.locator('.dialogue-card').isVisible(), 'fenêtre de confirmation personnalisée affichée')
  const [reponseSuppression] = await Promise.all([
    page.waitForResponse((r) => /\/api\/signalements\/\d+$/.test(r.url()) && r.request().method() === 'DELETE', { timeout: 20000 }),
    page.click('.dialogue-btn--danger:has-text("Confirmer")')
  ])
  verifier(reponseSuppression.ok(), `suppression acceptée par le serveur (statut ${reponseSuppression.status()})`)
  await page.waitForURL(BASE, { timeout: 10000 })
  await page
    .locator('.signalement-card')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {})
  const nbCartesApresSuppression = await page.locator('.signalement-card').count()
  verifier(nbCartesApresSuppression === 3, `retour à 3 signalements après suppression (trouvé ${nbCartesApresSuppression})`)

  console.log('')
  console.log('--- déconnexion admin ---')
  await page.goto(BASE + 'admin', { waitUntil: 'networkidle' })
  verifier(await page.locator('.admin-sidebar').isVisible(), 'toujours connecté, tableau de bord accessible')
  await page.click('button:has-text("Déconnexion")')
  await page.waitForURL(/\/admin\/login$/, { timeout: 10000 })
  verifier(/\/admin\/login$/.test(page.url()), 'la déconnexion redirige bien vers l\'écran de connexion')
  await page.goto(BASE + 'admin', { waitUntil: 'networkidle' })
  verifier(/\/admin\/login$/.test(page.url()), 'après déconnexion, /admin redemande bien une connexion')

  verifier(erreursConsole.length === 0, `aucune erreur JS (${erreursConsole.length} trouvée(s))`)
} finally {
  await browser.close()
  await new Promise((resolve) => serveur.close(resolve))
  rmSync(dossierTemp, { recursive: true, force: true })
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles sont passés.' : `${echecs} contrôle(s) en échec.`}`)
if (echecs > 0) process.exit(1)
