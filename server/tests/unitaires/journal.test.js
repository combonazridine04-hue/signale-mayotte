import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

// Base NoSQL du journal (NeDB) : ces tests écrivent dans le journal de test, jamais dans
// le vrai, ni dans celui des autres tests qui tournent en même temps (voir server/journal.js).
process.env.JOURNAL_FICHIER = 'journal-test-unitaire.db'
const { journaliser, lireJournal, statistiquesJournal, viderJournal, fermerJournal } = await import('../../journal.js')

const admin = { admin: { id: 1, identifiant: 'admin' } }
const partenaire = { partenaire: { id: 7, nom: 'Mairie de Sada' } }

// journaliser() n'attend pas l'écriture (elle ne doit jamais ralentir une requête) :
// on attend que le journal contienne le nombre de documents voulu.
async function attendreDocuments(nombre) {
  for (let i = 0; i < 50; i++) {
    if ((await lireJournal({})).total >= nombre) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error(`le journal n'a pas atteint ${nombre} documents`)
}

before(async () => {
  await viderJournal()
  journaliser(admin, 'admin.connexion')
  journaliser(partenaire, 'signalement.statut', {
    cible: { type: 'signalement', id: 42 },
    details: { avant: 'Signalé', apres: 'En cours' }
  })
  journaliser({}, 'captcha.echec', { resultat: 'echec', details: { route: '/api/contact' } })
  await attendreDocuments(3)
})

after(async () => {
  await viderJournal()
  await fermerJournal()
})

test('journal NoSQL : chaque document ne porte que ses propres champs', async () => {
  const { evenements } = await lireJournal({})
  const connexion = evenements.find((e) => e.type === 'admin.connexion')
  const statut = evenements.find((e) => e.type === 'signalement.statut')

  assert.deepEqual(connexion.acteur, { type: 'admin', id: 1, nom: 'admin' })
  assert.equal(connexion.cible, null, 'une connexion n’a pas de cible')
  assert.equal(connexion.details, null, 'ni de détails')
  assert.deepEqual(statut.details, { avant: 'Signalé', apres: 'En cours' })
  assert.equal(statut.libelle, 'Changement de statut')
})

test('journal NoSQL : filtre par type et par résultat', async () => {
  const echecs = await lireJournal({ resultat: 'echec' })
  assert.equal(echecs.total, 1)
  assert.equal(echecs.evenements[0].type, 'captcha.echec')

  const statuts = await lireJournal({ type: 'signalement.statut' })
  assert.equal(statuts.total, 1)
  assert.equal(statuts.evenements[0].acteur.nom, 'Mairie de Sada')
})

test('journal NoSQL : pagination, du plus récent au plus ancien', async () => {
  const page1 = await lireJournal({ page: 1, parPage: 2 })
  const page2 = await lireJournal({ page: 2, parPage: 2 })
  assert.equal(page1.total, 3)
  assert.equal(page1.evenements.length, 2)
  assert.equal(page2.evenements.length, 1)
  assert.ok(page1.evenements[0].date >= page1.evenements[1].date, 'tri par date décroissante')
})

test('journal NoSQL : statistiques par type sur la période', async () => {
  const stats = await statistiquesJournal(30)
  assert.equal(stats.total, 3)
  assert.equal(stats.echecs, 1)
  assert.deepEqual(
    stats.parType.find((l) => l.type === 'captcha.echec'),
    { type: 'captcha.echec', libelle: 'Vérification anti-robot échouée', succes: 0, echec: 1 }
  )
})
