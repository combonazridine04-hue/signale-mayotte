import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Codes à usage unique (TOTP, RFC 6238) : ceux qu'affichent Google Authenticator,
// Microsoft Authenticator, etc. 6 chiffres, renouvelés toutes les 30 secondes.
const PERIODE_S = 30
const CHIFFRES = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function versBase32(octets) {
  let bits = ''
  for (const o of octets) bits += o.toString(2).padStart(8, '0')
  let texte = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) texte += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return texte
}

function depuisBase32(texte) {
  let bits = ''
  for (const c of texte.replace(/=+$/, '').toUpperCase()) {
    const valeur = ALPHABET.indexOf(c)
    if (valeur === -1) throw new Error('Secret TOTP invalide.')
    bits += valeur.toString(2).padStart(5, '0')
  }
  const octets = []
  for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(octets)
}

export function genererSecret() {
  return versBase32(randomBytes(20))
}

export function pasCourant(maintenantMs = Date.now()) {
  return Math.floor(maintenantMs / 1000 / PERIODE_S)
}

export function codePourPas(secretBase32, pas, chiffres = CHIFFRES) {
  const compteur = Buffer.alloc(8)
  compteur.writeBigUInt64BE(BigInt(pas))
  const hmac = createHmac('sha1', depuisBase32(secretBase32)).update(compteur).digest()
  const decalage = hmac[hmac.length - 1] & 0x0f
  const nombre = (hmac.readUInt32BE(decalage) & 0x7fffffff) % 10 ** chiffres
  return String(nombre).padStart(chiffres, '0')
}

// Renvoie le pas de temps qui correspond au code (pour interdire de le rejouer), ou null.
// Tolère un pas d'écart de chaque côté : l'horloge d'un téléphone dérive souvent un peu.
export function verifierCode(secretBase32, code, { maintenantMs = Date.now(), dernierPasUtilise = null } = {}) {
  const saisi = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(saisi)) return null
  const pas = pasCourant(maintenantMs)
  for (const candidat of [pas - 1, pas, pas + 1]) {
    if (dernierPasUtilise !== null && candidat <= dernierPasUtilise) continue
    const attendu = codePourPas(secretBase32, candidat)
    if (timingSafeEqual(Buffer.from(attendu), Buffer.from(saisi))) return candidat
  }
  return null
}

export function lienOtpauth(secretBase32, compte) {
  const libelle = encodeURIComponent(`Signale Mayotte:${compte}`)
  return `otpauth://totp/${libelle}?secret=${secretBase32}&issuer=${encodeURIComponent('Signale Mayotte')}&algorithm=SHA1&digits=${CHIFFRES}&period=${PERIODE_S}`
}
