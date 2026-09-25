// Excel, LibreOffice et Google Sheets exécutent une cellule qui commence par = + - @
// comme une formule. Une description saisie par n'importe quel citoyen finissant dans
// le tableur de l'association, on neutralise ce premier caractère (injection CSV).
export function celluleCsv(valeur) {
  let texteCellule = String(valeur ?? '')
  if (/^[=+\-@\t\r]/.test(texteCellule) && typeof valeur !== 'number') texteCellule = `'${texteCellule}`
  return `"${texteCellule.replace(/"/g, '""')}"`
}
