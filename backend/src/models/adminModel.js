import { db } from '../config/db.js'

// Accès à la table admins (comptes administrateurs et leur double authentification).

// Le secret n'est jamais renvoyé par l'API, sauf une fois, au moment de l'activation.
const COLONNES_PUBLIQUES = 'id, identifiant, cree_le, totp_secret IS NOT NULL AS deux_facteurs'

export async function lister() {
  const { rows } = await db.query(`SELECT ${COLONNES_PUBLIQUES} FROM admins ORDER BY cree_le ASC`)
  return rows
}

// Toutes les colonnes (hash du mot de passe et secret compris) : ou undefined.
export async function trouverParId(id) {
  const { rows } = await db.query('SELECT * FROM admins WHERE id = ?', [id])
  return rows[0]
}

export async function aDeuxFacteurs(id) {
  const { rows } = await db.query(`SELECT ${COLONNES_PUBLIQUES} FROM admins WHERE id = ?`, [id])
  return Boolean(rows[0]?.deux_facteurs)
}

export async function identifiantExiste(identifiant) {
  const { rows } = await db.query('SELECT id FROM admins WHERE identifiant = ?', [identifiant])
  return rows.length > 0
}

export async function compter() {
  const { rows } = await db.query('SELECT COUNT(*) AS count FROM admins')
  return rows[0].count
}

export async function creer(identifiant, motDePasseHash) {
  const { rows } = await db.query(
    'INSERT INTO admins (identifiant, mot_de_passe_hash, cree_le) VALUES (?, ?, ?) RETURNING id, identifiant, cree_le',
    [identifiant, motDePasseHash, new Date().toISOString()]
  )
  return rows[0]
}

// Renvoie l'identifiant du compte supprimé, ou undefined s'il n'existait pas.
export async function supprimer(id) {
  const { rows } = await db.query('DELETE FROM admins WHERE id = ? RETURNING identifiant', [id])
  return rows[0]?.identifiant
}

export async function changerMotDePasse(id, motDePasseHash) {
  await db.query('UPDATE admins SET mot_de_passe_hash = ? WHERE id = ?', [motDePasseHash, id])
}

// --- Double authentification ---

// Secret proposé (QR code), pas encore confirmé par un premier code.
export async function enregistrerSecretEnAttente(id, secret) {
  await db.query('UPDATE admins SET totp_secret_attente = ? WHERE id = ?', [secret, id])
}

export async function lireSecretEnAttente(id) {
  const { rows } = await db.query('SELECT totp_secret_attente FROM admins WHERE id = ?', [id])
  return rows[0]?.totp_secret_attente
}

// Le premier code valide confirme le secret : il devient actif.
export async function activerDeuxFacteurs(id, secret, pas) {
  await db.query('UPDATE admins SET totp_secret = ?, totp_secret_attente = NULL, totp_dernier_pas = ? WHERE id = ?', [
    secret,
    pas,
    id
  ])
}

export async function desactiverDeuxFacteurs(id) {
  await db.query('UPDATE admins SET totp_secret = NULL, totp_dernier_pas = NULL WHERE id = ?', [id])
}

// Téléphone perdu : tout est effacé, y compris un secret en attente.
// Renvoie true si le compte existe.
export async function reinitialiserDeuxFacteurs(id) {
  const { rowCount } = await db.query(
    'UPDATE admins SET totp_secret = NULL, totp_secret_attente = NULL, totp_dernier_pas = NULL WHERE id = ?',
    [id]
  )
  return rowCount > 0
}
