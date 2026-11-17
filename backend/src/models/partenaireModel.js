import { db } from '../config/db.js'

// Accès à la table partenaires (agents municipaux et services techniques).

export async function lister() {
  const { rows } = await db.query('SELECT * FROM partenaires ORDER BY cree_le ASC')
  return rows
}

export async function identifiantExiste(identifiant) {
  const { rows } = await db.query('SELECT id FROM partenaires WHERE identifiant = ?', [identifiant])
  return rows.length > 0
}

export async function creer({ nom, identifiant, motDePasseHash, commune, categories, email }) {
  const { rows } = await db.query(
    `INSERT INTO partenaires (nom, identifiant, mot_de_passe_hash, commune, categories, email, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      nom,
      identifiant,
      motDePasseHash,
      commune,
      // Colonne JSON : la liste est enregistrée sous forme de texte JSON.
      JSON.stringify(categories),
      email,
      new Date().toISOString()
    ]
  )
  return rows[0]
}

// Renvoie { nom, logo_url } du compte supprimé, ou undefined s'il n'existait pas.
export async function supprimer(id) {
  const { rows } = await db.query('DELETE FROM partenaires WHERE id = ? RETURNING nom, logo_url', [id])
  return rows[0]
}

export async function trouver(id) {
  const { rows } = await db.query('SELECT id, nom, logo_url FROM partenaires WHERE id = ?', [id])
  return rows[0]
}

export async function mettreAJourLogo(id, logoUrl) {
  await db.query('UPDATE partenaires SET logo_url = ? WHERE id = ?', [logoUrl, id])
}

// Vitrine publique : seulement le nom et le logo, jamais l'identifiant, l'e-mail ou le
// périmètre. Sans logo, le site affiche le nom à la place.
export async function listerPublics() {
  const { rows } = await db.query('SELECT nom, logo_url FROM partenaires ORDER BY nom ASC')
  return rows
}
