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

// Renvoie le nom du compte supprimé, ou undefined s'il n'existait pas.
export async function supprimer(id) {
  const { rows } = await db.query('DELETE FROM partenaires WHERE id = ? RETURNING nom', [id])
  return rows[0]?.nom
}
