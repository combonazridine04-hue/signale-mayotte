import { chromium } from 'playwright-chromium'
const nav = await chromium.launch()
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } })
await p.addInitScript(() => {
  Object.defineProperty(navigator, 'connection', { configurable: true,
    get: () => ({ effectiveType: '4g', saveData: true, addEventListener() {}, removeEventListener() {} }) })
})
for (const [nom, url] of [
  ['mot-de-passe-oublie', '/mot-de-passe-oublie'],
  ['reinitialiser', '/reinitialiser-mot-de-passe?token=abc'],
  ['verifier-email', '/verifier-email'],
  ['introuvable', '/page-qui-nexiste-pas'],
  ['transparence', '/transparence']
]) {
  await p.goto('http://localhost:3001' + url)
  await p.waitForTimeout(2500)
  const m = await p.evaluate(() => {
    const g = document.querySelector('.col-lg-5')
    const d = document.querySelector('.col-lg-6, .col-lg-7')
    const main = document.querySelector('main')
    return {
      gauche: g ? Math.round(g.getBoundingClientRect().height) : null,
      droite: d ? Math.round(d.getBoundingClientRect().height) : null,
      hauteurContenu: Math.round(main.getBoundingClientRect().height),
      ecran: window.innerHeight
    }
  })
  const vide = m.hauteurContenu < m.ecran - 200
  console.log(nom.padEnd(22), JSON.stringify(m), vide ? '<- PAGE COURTE, beaucoup de vide' : '')
}
await nav.close()
