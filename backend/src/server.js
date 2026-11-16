// Point d'entrée : démarre l'API. La configuration d'Express (routes, sécurité, erreurs)
// est dans app.js, que les tests importent sans lancer de serveur.
const { app } = await import('./app.js')
const { planifierPurge } = await import('./services/retentionService.js')

// Effacement automatique des données trop anciennes (voir retentionService.js).
planifierPurge()

// Chez alwaysdata, l'application DOIT écouter sur l'adresse et le port qu'il fournit
// (variables IP ou HOST, et PORT). En local, aucune adresse : toutes les interfaces.
const PORT = process.env.PORT || 3001
const ADRESSE = process.env.IP || process.env.HOST || undefined
app.listen(PORT, ADRESSE, () => {
  console.log(`API Signale Mayotte disponible sur ${ADRESSE ? `${ADRESSE}:${PORT}` : `http://localhost:${PORT}`}`)
})
