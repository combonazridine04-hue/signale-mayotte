// Envoi d'email via l'API HTTPS de Resend (https://resend.com), pas en SMTP :
// Render bloque les connexions SMTP sortantes sur ses instances (anti-abus),
// donc Gmail/nodemailer échouait silencieusement en production.
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM || 'Signale Mayotte <onboarding@resend.dev>'
const destinataire = process.env.EMAIL_DESTINATAIRE || 'benoblock440@gmail.com'
const SITE_URL = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')

if (!RESEND_API_KEY) {
  console.warn('[mailer] RESEND_API_KEY non configuré (.env) : notifications email désactivées.')
}

export const mailerActif = Boolean(RESEND_API_KEY)

function echapperHtml(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function envoyerEmail({ to, subject, text, html, replyTo }) {
  if (!RESEND_API_KEY) return

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    })
    if (!reponse.ok) {
      const corps = await reponse.text().catch(() => '')
      console.error('[mailer] Échec envoi email (Resend) :', reponse.status, corps)
    }
  } catch (e) {
    console.error('[mailer] Échec envoi email (Resend) :', e.message)
  }
}

export async function envoyerNotificationSignalement(signalement) {
  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`
  const lienPhoto = signalement.photoUrls?.[0] || ''
  const nbAutresPhotos = Math.max(0, (signalement.photoUrls?.length || 0) - 1)
  const dateFormatee = new Date(signalement.dateSignalement).toLocaleString('fr-FR')

  await envoyerEmail({
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
}

export async function envoyerConfirmationSignalement(signalement, emailCitoyen, tokenSuppression) {
  if (!emailCitoyen) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}?token=${tokenSuppression}`

  await envoyerEmail({
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
}

export async function envoyerChangementStatut(signalement, emailCitoyen) {
  if (!emailCitoyen) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`

  await envoyerEmail({
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
}

export async function envoyerVerificationEmail(nom, email, code) {
  if (!email) return

  await envoyerEmail({
    to: email,
    subject: `${code} — Votre code de confirmation Signale Mayotte`,
    text: [
      `Bonjour ${nom},`,
      '',
      'Voici votre code de confirmation :',
      code,
      '',
      'Saisissez ce code sur Signale Mayotte pour confirmer votre adresse email. Il expire dans 30 minutes.',
      '',
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email."
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">Confirmez votre email</h2>
        </div>
        <div style="padding: 20px; color: #0f172a;">
          <p style="margin: 0 0 16px;">Bonjour ${echapperHtml(nom)},</p>
          <p style="margin: 0 0 16px;">Voici votre code de confirmation pour Signale Mayotte :</p>
          <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; background: #f1f5f9; border-radius: 8px; padding: 16px;">${echapperHtml(code)}</p>
          <p style="margin: 0; color: #64748b; font-size: 12px;">Ce code expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
        </div>
      </div>
    `
  })
}

export async function envoyerReinitialisationMotDePasse(nom, email, token) {
  if (!email) return

  const lienReinitialisation = `${SITE_URL}/reinitialiser-mot-de-passe?token=${token}`

  await envoyerEmail({
    to: email,
    subject: 'Réinitialisez votre mot de passe — Signale Mayotte',
    text: [
      `Bonjour ${nom},`,
      '',
      'Vous avez demandé à réinitialiser votre mot de passe :',
      lienReinitialisation,
      '',
      'Ce lien expire dans 1 heure.',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé."
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">Réinitialisation du mot de passe</h2>
        </div>
        <div style="padding: 20px; color: #0f172a;">
          <p style="margin: 0 0 16px;">Bonjour ${echapperHtml(nom)},</p>
          <p style="margin: 0 0 16px;">Vous avez demandé à réinitialiser votre mot de passe sur Signale Mayotte.</p>
          <a href="${lienReinitialisation}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: bold;">
            Choisir un nouveau mot de passe
          </a>
          <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé.</p>
        </div>
      </div>
    `
  })
}

export async function envoyerMessageContact({ nom, email, sujet, message }) {
  await envoyerEmail({
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
