const CLE = 'signale-mayotte-tokens-suppression'

function lireTous() {
  try {
    return JSON.parse(localStorage.getItem(CLE) || '{}')
  } catch {
    return {}
  }
}

export function enregistrerTokenSuppression(id, token) {
  if (!token) return
  try {
    const tokens = lireTous()
    tokens[id] = token
    localStorage.setItem(CLE, JSON.stringify(tokens))
  } catch {
    // localStorage indisponible (navigation privée stricte, etc.) : on continue sans.
  }
}

export function lireTokenSuppression(id) {
  return lireTous()[id] || null
}
