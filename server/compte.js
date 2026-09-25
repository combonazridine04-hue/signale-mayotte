import bcrypt from 'bcryptjs'
import { db } from './db.js'
import { revoquerSessionsUtilisateur } from './auth.js'
import { supprimerPhoto } from './storage.js'
import { AUTEUR_SUPPRIME } from './signalements/representation.js'

// Droits des personnes sur leurs données (RGPD) : accès et portabilité (art. 15 et 20),
// rectification (art. 16) et effacement (art. 17).

export async function motDePasseCorrect(utilisateurId, motDePasse) {
  if (typeof motDePasse !== 'string' || !motDePasse) return false
  const { rows } = await db.query('SELECT mot_de_passe_hash FROM utilisateurs WHERE id = $1', [utilisateurId])
  if (!rows[0]) return false
  return bcrypt.compare(motDePasse, rows[0].mot_de_passe_hash)
}

// Efface un compte et tout ce qui permet d'identifier la personne.
//
// Sans `avecContenus`, ses signalements restent en ligne mais deviennent anonymes : ils
// décrivent un problème public (un trou, un dépôt sauvage) qui reste utile aux communes.
// L'adresse email de suivi qui y était attachée est effacée, et ses commentaires
// s'affichent « Compte supprimé ». Avec `avecContenus`, signalements et commentaires
// disparaissent eux aussi.
//
// Tout se fait dans une transaction : un effacement à moitié fait laisserait des données
// personnelles derrière lui. Les photos sont retirées du stockage après validation, pour
// ne jamais détruire un fichier encore référencé si la transaction échouait.
export async function effacerCompte(utilisateurId, { avecContenus = false } = {}) {
  const photos = []
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query('SELECT avatar_url FROM utilisateurs WHERE id = $1 FOR UPDATE', [utilisateurId])
    if (!rows[0]) {
      await client.query('ROLLBACK')
      return false
    }
    photos.push(rows[0].avatar_url)

    if (avecContenus) {
      // Les soutiens, commentaires, mises à jour et notifications liés à ces
      // signalements partent avec eux (ON DELETE CASCADE).
      const { rows: supprimes } = await client.query(
        'DELETE FROM signalements WHERE utilisateur_id = $1 RETURNING photos, photo_resolution',
        [utilisateurId]
      )
      for (const s of supprimes) photos.push(...(s.photos || []), s.photo_resolution)
      await client.query('DELETE FROM commentaires WHERE utilisateur_id = $1', [utilisateurId])
    } else {
      await client.query('UPDATE signalements SET email_contact = NULL WHERE utilisateur_id = $1', [utilisateurId])
      await client.query('UPDATE commentaires SET auteur = $2 WHERE utilisateur_id = $1', [
        utilisateurId,
        AUTEUR_SUPPRIME
      ])
    }

    // Le reste suit les clés étrangères : notifications supprimées (CASCADE) ; soutiens,
    // signalements restants, commentaires et signalements d'abus détachés (SET NULL).
    await client.query('DELETE FROM utilisateurs WHERE id = $1', [utilisateurId])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  revoquerSessionsUtilisateur(utilisateurId)
  await Promise.all(photos.filter(Boolean).map(supprimerPhoto))
  return true
}

// Toutes les données rattachées au compte, dans un format lisible et réutilisable (JSON).
export async function exporterDonnees(utilisateurId) {
  const requete = async (sql) => (await db.query(sql, [utilisateurId])).rows
  const [profil] = await requete(
    `SELECT nom, email, telephone, pseudo, avatar_url AS photo_de_profil, email_verifie,
            cree_le AS compte_cree_le, derniere_connexion
     FROM utilisateurs WHERE id = $1`
  )
  if (!profil) return null

  return {
    exporte_le: new Date().toISOString(),
    source: 'Signale Mayotte — https://signale-mayotte.onrender.com',
    profil,
    signalements: await requete(
      `SELECT id, categorie, commune, description, photos, statut, urgent, latitude, longitude,
              email_contact AS email_de_suivi, nb_soutiens, date_signalement, date_modification, date_resolution
       FROM signalements WHERE utilisateur_id = $1 ORDER BY date_signalement`
    ),
    commentaires: await requete(
      `SELECT id, signalement_id, parent_id AS en_reponse_a, texte, date_creation
       FROM commentaires WHERE utilisateur_id = $1 ORDER BY date_creation`
    ),
    soutiens: await requete(
      'SELECT signalement_id, date_soutien FROM soutiens WHERE utilisateur_id = $1 ORDER BY date_soutien'
    ),
    contenus_signales_a_la_moderation: await requete(
      `SELECT type, cible_id, motif, date_creation
       FROM signalements_abus WHERE utilisateur_id = $1 ORDER BY date_creation`
    ),
    notifications: await requete(
      `SELECT signalement_id, texte, lue, date_creation
       FROM notifications WHERE utilisateur_id = $1 ORDER BY date_creation`
    )
  }
}

// Rectification du nom (art. 16). Le nom n'est jamais public : il sert à l'administration
// et, abrégé, à signer les commentaires quand aucun pseudo n'est choisi.
export async function mettreAJourNom(utilisateurId, nom) {
  const valeur = typeof nom === 'string' ? nom.trim() : ''
  if (valeur.length < 2) return { erreur: 'Le nom doit contenir au moins 2 caractères.' }
  if (valeur.length > 100) return { erreur: 'Le nom ne doit pas dépasser 100 caractères.' }
  await db.query('UPDATE utilisateurs SET nom = $1 WHERE id = $2', [valeur, utilisateurId])
  return { nom: valeur }
}
