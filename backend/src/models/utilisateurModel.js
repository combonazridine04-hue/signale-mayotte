import { db } from '../config/db.js'

// Accès à la table utilisateurs (comptes citoyens), pour les contrôleurs.
// L'inscription, la connexion et la gestion du compte sont dans services/authService.js
// et services/compteService.js.

// Nom, pseudo et photo affichés sous un commentaire : ou undefined.
export async function trouverIdentitePublique(id) {
  const { rows } = await db.query('SELECT nom, pseudo, avatar_url FROM utilisateurs WHERE id = ?', [id])
  return rows[0]
}

// { email, email_verifie } : ou undefined.
export async function trouverEtatEmail(id) {
  const { rows } = await db.query('SELECT email, email_verifie FROM utilisateurs WHERE id = ?', [id])
  return rows[0]
}

// Sert à effacer les comptes restés inutilisés trop longtemps (voir retentionService.js).
// Sans attendre : un échec ne doit pas empêcher la connexion.
export function noterConnexion(id) {
  db.query('UPDATE utilisateurs SET derniere_connexion = ? WHERE id = ?', [new Date().toISOString(), id]).catch((e) =>
    console.error('[auth] derniere_connexion :', e.message)
  )
}
