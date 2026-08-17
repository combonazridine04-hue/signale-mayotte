import nodemailer from 'nodemailer'

const expediteur = process.env.EMAIL_EXPEDITEUR
const motDePasse = process.env.EMAIL_MOT_DE_PASSE_APP
const destinataire = process.env.EMAIL_DESTINATAIRE || 'benoblock440@gmail.com'
const SITE_URL = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')

const transporteur = expediteur && motDePasse
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: expediteur, pass: motDePasse }
    })
  : null

if (!transporteur) {
  console.warn('[mailer] EMAIL_EXPEDITEUR / EMAIL_MOT_DE_PASSE_APP non configurés (.env) : notifications email désactivées.')
}

export const mailerActif = Boolean(transporteur)

function echapperHtml(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function envoyerNotificationSignalement(signalement) {
  if (!transporteur) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`
  const lienPhoto = signalement.photoUrls?.[0] || ''
  const nbAutresPhotos = Math.max(0, (signalement.photoUrls?.length || 0) - 1)
  const dateFormatee = new Date(signalement.dateSignalement).toLocaleString('fr-FR')

  try {
    await transporteur.sendMail({
      from: `"Signale Mayotte" <${expediteur}>`,
      to: destinataire,
      subject: `Nouveau signalement — ${signalement.categorie} à ${signalement.commune}`,
      text: [
        `Catégorie : ${signalement.categorie}`,
        `Commune : ${signalement.commune}`,
        `Description : ${signalement.description}`,
        `Date : ${dateFormatee}`,
        lienPhoto ? `Photo : ${lienPhoto}` : '',
        `Voir le signalement : ${lienDetail}`
      ].filter(Boolean).join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0; font-size: 18px;">Nouveau signalement</h2>
          </div>
          <div style="padding: 20px; color: #0f172a;">
            <p style="margin: 0 0 8px;"><strong>Catégorie :</strong> ${echapperHtml(signalement.categorie)}</p>
            <p style="margin: 0 0 8px;"><strong>Commune :</strong> ${echapperHtml(signalement.commune)}</p>
            <p style="margin: 0 0 8px;"><strong>Description :</strong> ${echapperHtml(signalement.description)}</p>
            <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">Signalé le ${dateFormatee}</p>
            ${lienPhoto ? `<img src="${lienPhoto}" alt="Photo du signalement" style="width: 100%; border-radius: 6px; margin-bottom: 8px;" />` : ''}
            ${nbAutresPhotos ? `<p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">+ ${nbAutresPhotos} autre${nbAutresPhotos > 1 ? 's' : ''} photo${nbAutresPhotos > 1 ? 's' : ''}</p>` : ''}
            <a href="${lienDetail}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: bold;">
              Voir le signalement
            </a>
          </div>
        </div>
      `
    })
  } catch (e) {
    console.error('[mailer] Échec envoi notification email :', e.message)
  }
}

export async function envoyerConfirmationSignalement(signalement, emailCitoyen, tokenSuppression) {
  if (!transporteur || !emailCitoyen) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}?token=${tokenSuppression}`

  try {
    await transporteur.sendMail({
      from: `"Signale Mayotte" <${expediteur}>`,
      to: emailCitoyen,
      subject: 'Votre signalement a bien été enregistré',
      text: [
        'Merci pour votre signalement, il a bien été enregistré.',
        `Catégorie : ${signalement.categorie}`,
        `Commune : ${signalement.commune}`,
        `Suivre ou supprimer votre signalement : ${lienDetail}`,
        "Gardez ce lien : c'est le seul moyen de supprimer vous-même ce signalement plus tard."
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0; font-size: 18px;">Signalement enregistré</h2>
          </div>
          <div style="padding: 20px; color: #0f172a;">
            <p style="margin: 0 0 8px;">Merci, votre signalement a bien été pris en compte.</p>
            <p style="margin: 0 0 8px;"><strong>Catégorie :</strong> ${echapperHtml(signalement.categorie)}</p>
            <p style="margin: 0 0 16px;"><strong>Commune :</strong> ${echapperHtml(signalement.commune)}</p>
            <a href="${lienDetail}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: bold;">
              Suivre mon signalement
            </a>
            <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">Gardez cet email : ce lien est le seul moyen de supprimer vous-même ce signalement plus tard.</p>
          </div>
        </div>
      `
    })
  } catch (e) {
    console.error('[mailer] Échec envoi confirmation citoyen :', e.message)
  }
}

export async function envoyerChangementStatut(signalement, emailCitoyen) {
  if (!transporteur || !emailCitoyen) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`

  try {
    await transporteur.sendMail({
      from: `"Signale Mayotte" <${expediteur}>`,
      to: emailCitoyen,
      subject: `Votre signalement est maintenant "${signalement.statut}"`,
      text: [
        `Le statut de votre signalement a été mis à jour : ${signalement.statut}`,
        `Catégorie : ${signalement.categorie}`,
        `Commune : ${signalement.commune}`,
        `Voir le signalement : ${lienDetail}`
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0; font-size: 18px;">Mise à jour de votre signalement</h2>
          </div>
          <div style="padding: 20px; color: #0f172a;">
            <p style="margin: 0 0 8px;">Le statut de votre signalement est maintenant :</p>
            <p style="margin: 0 0 16px; font-size: 20px; font-weight: bold;">${echapperHtml(signalement.statut)}</p>
            <p style="margin: 0 0 8px;"><strong>Catégorie :</strong> ${echapperHtml(signalement.categorie)}</p>
            <p style="margin: 0 0 16px;"><strong>Commune :</strong> ${echapperHtml(signalement.commune)}</p>
            <a href="${lienDetail}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: bold;">
              Voir le signalement
            </a>
          </div>
        </div>
      `
    })
  } catch (e) {
    console.error('[mailer] Échec envoi changement de statut :', e.message)
  }
}

export async function envoyerMessageContact({ nom, email, sujet, message }) {
  if (!transporteur) return

  await transporteur.sendMail({
    from: `"Signale Mayotte" <${expediteur}>`,
    to: destinataire,
    replyTo: email,
    subject: `[Contact] ${sujet} — ${nom}`,
    text: [
      `De : ${nom} <${email}>`,
      `Sujet : ${sujet}`,
      '',
      message
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #2563eb; color: #ffffff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">Nouveau message de contact</h2>
        </div>
        <div style="padding: 20px; color: #0f172a;">
          <p style="margin: 0 0 8px;"><strong>De :</strong> ${echapperHtml(nom)} (${echapperHtml(email)})</p>
          <p style="margin: 0 0 8px;"><strong>Sujet :</strong> ${echapperHtml(sujet)}</p>
          <p style="margin: 16px 0 0; white-space: pre-wrap;">${echapperHtml(message)}</p>
        </div>
      </div>
    `
  })
}
