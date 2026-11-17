// Envoi d'email par API HTTPS, jamais en SMTP : beaucoup d'hébergeurs bloquent les
// connexions SMTP sortantes (anti-abus) ; un envoi SMTP y échouerait en silence.
//
// Brevo est prioritaire sur Resend : Resend refuse (403) tout destinataire autre que
// le propriétaire du compte tant qu'un nom de domaine n'est pas vérifié, ce qui
// empêchait les citoyens de recevoir leur code. Brevo demande seulement de valider
// une adresse d'expédition, sans domaine à acheter.
const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_EXPEDITEUR = process.env.BREVO_EXPEDITEUR
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM = process.env.RESEND_FROM || 'Signale Mayotte <onboarding@resend.dev>'
const NOM_EXPEDITEUR = 'Signale Mayotte'
const destinataire = process.env.EMAIL_DESTINATAIRE || 'benoblock440@gmail.com'
const SITE_URL = (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '')

const fournisseur = BREVO_API_KEY && BREVO_EXPEDITEUR ? 'brevo' : RESEND_API_KEY ? 'resend' : null

if (BREVO_API_KEY && !BREVO_EXPEDITEUR) {
  console.warn("[mailer] BREVO_API_KEY fourni sans BREVO_EXPEDITEUR (l'adresse validée chez Brevo) : Brevo ignoré.")
}
if (!fournisseur) {
  console.warn(
    '[mailer] Aucun fournisseur email configuré (BREVO_API_KEY ou RESEND_API_KEY) : notifications désactivées.'
  )
} else {
  console.log(`[mailer] Fournisseur email : ${fournisseur}`)
}

export const mailerActif = Boolean(fournisseur)

function echapperHtml(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------------------
// Mise en page commune à tous les emails. Les messageries (Gmail, Outlook…) ignorent
// une grande partie du CSS : tout est en tableaux et en styles « inline », sans image
// externe, pour un rendu identique partout et lisible même avec les images bloquées.
// ---------------------------------------------------------------------------------------
const COULEURS = { vert: '#16a34a', sarcelle: '#0f766e', rouge: '#dc2626', bleu: '#2563eb' }
const POLICE = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// apercu : la phrase que la messagerie affiche à côté de l'objet, dans la liste des emails.
function gabarit({ titre, sousTitre = '', couleur = COULEURS.vert, apercu = '', bandeau = '', contenu }) {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapperHtml(titre)}</title></head>
<body style="margin:0; padding:0; background:#eef2f6;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${echapperHtml(apercu)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6; font-family:${POLICE};">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td align="center" style="padding:0 0 20px;">
          <a href="${SITE_URL}" style="text-decoration:none; color:#0f172a; font-size:20px; font-weight:800; letter-spacing:-0.3px;">
            <span style="display:inline-block; width:30px; height:30px; line-height:30px; border-radius:50%; background:${COULEURS.vert}; color:#ffffff; font-size:16px; text-align:center; vertical-align:middle;">&#9679;</span>
            <span style="vertical-align:middle;">&nbsp;Signale Mayotte</span>
          </a>
        </td></tr>
        <tr><td style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 18px rgba(15,23,42,0.08);">
          ${bandeau ? `<div style="background:#fef3c7; color:#92400e; padding:12px 28px; font-size:13px; line-height:1.5;">${echapperHtml(bandeau)}</div>` : ''}
          <div style="height:6px; background:${couleur};"></div>
          <div style="padding:32px 28px 8px;">
            <h1 style="margin:0; font-size:24px; line-height:1.3; color:#0f172a; font-weight:800;">${echapperHtml(titre)}</h1>
            ${sousTitre ? `<p style="margin:8px 0 0; font-size:14px; color:#64748b;">${echapperHtml(sousTitre)}</p>` : ''}
          </div>
          <div style="padding:16px 28px 32px; font-size:15px; line-height:1.6; color:#334155;">
            ${contenu}
          </div>
        </td></tr>
        <tr><td align="center" style="padding:24px 16px 0; font-size:12px; line-height:1.6; color:#94a3b8;">
          <strong style="color:#64748b;">Signale Mayotte</strong> — la plateforme citoyenne pour signaler les problèmes du quotidien.<br>
          <a href="${SITE_URL}" style="color:#64748b;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const paragraphe = (html) => `<p style="margin:0 0 16px;">${html}</p>`
const note = (html) => `<p style="margin:24px 0 0; font-size:13px; line-height:1.5; color:#64748b;">${html}</p>`

function bouton(lien, texte, couleur = COULEURS.vert) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr>
    <td style="border-radius:10px; background:${couleur};">
      <a href="${lien}" style="display:inline-block; padding:14px 26px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">${texte}</a>
    </td></tr></table>`
}

// Fiche « Catégorie / Commune / … » : les valeurs sont échappées ici.
function fiche(lignes) {
  const rangees = lignes
    .filter(([, valeur]) => valeur)
    .map(
      ([libelle, valeur]) => `<tr>
        <td style="padding:10px 14px; width:110px; font-size:13px; color:#64748b; border-bottom:1px solid #e2e8f0; vertical-align:top;">${libelle}</td>
        <td style="padding:10px 14px; font-size:14px; color:#0f172a; font-weight:600; border-bottom:1px solid #e2e8f0; white-space:pre-wrap;">${echapperHtml(valeur)}</td>
      </tr>`
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; border-collapse:separate; overflow:hidden;">${rangees}</table>`
}

function citation(texte, couleur = COULEURS.vert) {
  return `<div style="margin:0 0 20px; padding:14px 18px; background:#f8fafc; border-left:4px solid ${couleur}; border-radius:6px; color:#0f172a; white-space:pre-wrap;">${echapperHtml(texte)}</div>`
}

async function envoyerViaBrevo({ to, subject, text, html, replyTo }) {
  const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: NOM_EXPEDITEUR, email: BREVO_EXPEDITEUR },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {})
    })
  })
  return reponse
}

async function envoyerViaResend({ to, subject, text, html, replyTo }) {
  return fetch('https://api.resend.com/emails', {
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
}

async function envoyerEmail(message) {
  if (!fournisseur) return

  try {
    const reponse = fournisseur === 'brevo' ? await envoyerViaBrevo(message) : await envoyerViaResend(message)
    if (!reponse.ok) {
      const corps = await reponse.text().catch(() => '')
      console.error(`[mailer] Échec envoi email (${fournisseur}) :`, reponse.status, corps)
    }
  } catch (e) {
    console.error(`[mailer] Échec envoi email (${fournisseur}) :`, e.message)
  }
}

export async function envoyerNotificationSignalement(signalement) {
  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`
  // Photo stockée sur le disque (mode local) : son adresse est relative au site, ce
  // qu'un client email ne sait pas résoudre.
  const premierePhoto = signalement.photoUrls?.[0] || ''
  const lienPhoto = premierePhoto.startsWith('/') ? `${SITE_URL}${premierePhoto}` : premierePhoto
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
    ]
      .filter(Boolean)
      .join('\n'),
    html: gabarit({
      titre: 'Nouveau signalement',
      sousTitre: `Signalé le ${dateFormatee}`,
      apercu: `${signalement.categorie} à ${signalement.commune}`,
      contenu: `
        ${fiche([
          ['Catégorie', signalement.categorie],
          ['Commune', signalement.commune],
          ['Description', signalement.description]
        ])}
        ${lienPhoto ? `<img src="${lienPhoto}" alt="Photo du signalement" width="504" style="display:block; width:100%; max-width:504px; height:auto; border-radius:10px; margin:0 0 8px;">` : ''}
        ${nbAutresPhotos ? `<p style="margin:0 0 16px; color:#64748b; font-size:13px;">+ ${nbAutresPhotos} autre${nbAutresPhotos > 1 ? 's' : ''} photo${nbAutresPhotos > 1 ? 's' : ''}</p>` : ''}
        ${bouton(lienDetail, 'Voir le signalement')}
      `
    })
  })
}

// Tant que la plateforme n'est pas en service avec de vrais partenaires, leurs alertes
// partent vers une boîte de test (par défaut celle de l'association), JAMAIS vers
// l'adresse réelle de l'organisme. Pour les envoyer pour de vrai, il faut le décider
// explicitement : ALERTES_PARTENAIRES_REELLES=oui.
export const alertesPartenairesReelles = process.env.ALERTES_PARTENAIRES_REELLES === 'oui'
export const boiteTestPartenaires = process.env.EMAIL_TEST_PARTENAIRES || destinataire

export function messageAlertePartenaire(partenaire, signalement) {
  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`
  const lienEspace = `${SITE_URL}/partenaire`
  const dateFormatee = new Date(signalement.dateSignalement).toLocaleString('fr-FR')
  const test = !alertesPartenairesReelles
  const bandeauTexte = test
    ? `[TEST] Cet e-mail était destiné à ${partenaire.nom}${partenaire.email ? ` (${partenaire.email})` : ''}. Il a été envoyé à la boîte de test : la plateforme n'est pas encore en service.`
    : ''
  const urgent = signalement.urgent ? 'URGENT — ' : ''

  return {
    to: test ? boiteTestPartenaires : partenaire.email,
    subject: `${test ? '[TEST] ' : ''}${urgent}Nouveau signalement pour ${partenaire.nom} — ${signalement.categorie} à ${signalement.commune}`,
    text: [
      bandeauTexte,
      bandeauTexte ? '' : null,
      `Bonjour ${partenaire.nom},`,
      '',
      'Un nouveau signalement relève de votre périmètre :',
      `Catégorie : ${signalement.categorie}`,
      `Commune : ${signalement.commune}`,
      signalement.urgent ? 'Marqué URGENT (danger immédiat)' : null,
      `Description : ${signalement.description}`,
      `Signalé le : ${dateFormatee}`,
      '',
      `Voir le signalement : ${lienDetail}`,
      `Votre espace partenaire (pour passer le statut à « En cours » puis « Résolu ») : ${lienEspace}`
    ]
      .filter((ligne) => ligne !== null)
      .join('\n'),
    html: gabarit({
      titre: `${signalement.urgent ? 'URGENT — ' : ''}Nouveau signalement à traiter`,
      sousTitre: `Signalé le ${dateFormatee}`,
      couleur: signalement.urgent ? COULEURS.rouge : COULEURS.sarcelle,
      apercu: `${signalement.categorie} à ${signalement.commune}`,
      bandeau: bandeauTexte,
      contenu: `
        ${paragraphe(`Bonjour ${echapperHtml(partenaire.nom)}, un nouveau signalement relève de votre périmètre :`)}
        ${fiche([
          ['Catégorie', signalement.categorie],
          ['Commune', signalement.commune],
          ['Urgence', signalement.urgent ? 'Danger immédiat' : ''],
          ['Description', signalement.description]
        ])}
        ${bouton(lienDetail, 'Voir le signalement', COULEURS.sarcelle)}
        ${note(`Une fois sur place, faites évoluer le statut depuis <a href="${lienEspace}" style="color:${COULEURS.sarcelle};">votre espace partenaire</a> : « En cours », puis « Résolu ». L'habitant qui a signalé le problème sera prévenu.`)}
      `
    })
  }
}

export async function envoyerAlertePartenaire(partenaire, signalement) {
  const message = messageAlertePartenaire(partenaire, signalement)
  console.log(
    `[mailer] alerte signalement #${signalement.id} pour « ${partenaire.nom} » → ${alertesPartenairesReelles ? 'adresse réelle' : 'boîte de test'}${fournisseur ? '' : ' (aucun fournisseur e-mail : non envoyée)'}`
  )
  await envoyerEmail(message)
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
    html: gabarit({
      titre: 'Merci, votre signalement est enregistré',
      apercu: 'Suivez son avancement depuis ce lien.',
      contenu: `
        ${paragraphe('Votre signalement a bien été pris en compte. Vous serez prévenu par email dès que son statut évolue.')}
        ${fiche([
          ['Catégorie', signalement.categorie],
          ['Commune', signalement.commune]
        ])}
        ${bouton(lienDetail, 'Suivre mon signalement')}
        ${note('Gardez cet email : ce lien est le seul moyen de supprimer vous-même ce signalement plus tard.')}
      `
    })
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
    html: gabarit({
      titre: 'Votre signalement avance',
      apercu: `Nouveau statut : ${signalement.statut}`,
      contenu: `
        ${paragraphe('Le statut de votre signalement est maintenant :')}
        <p style="margin:0 0 20px;"><span style="display:inline-block; padding:8px 16px; border-radius:999px; background:#dcfce7; color:#166534; font-size:16px; font-weight:800;">${echapperHtml(signalement.statut)}</span></p>
        ${fiche([
          ['Catégorie', signalement.categorie],
          ['Commune', signalement.commune]
        ])}
        ${bouton(lienDetail, 'Voir le signalement')}
      `
    })
  })
}

export async function envoyerMiseAJourSignalement(signalement, emailCitoyen, texte) {
  if (!emailCitoyen) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`

  await envoyerEmail({
    to: emailCitoyen,
    subject: 'Du nouveau sur votre signalement',
    text: [
      'Un suivi a été publié sur votre signalement :',
      `${signalement.categorie} — ${signalement.commune}`,
      '',
      texte,
      '',
      `Voir le signalement : ${lienDetail}`
    ].join('\n'),
    html: gabarit({
      titre: 'Du nouveau sur votre signalement',
      sousTitre: `${signalement.categorie} — ${signalement.commune}`,
      apercu: texte.slice(0, 120),
      contenu: `
        ${paragraphe('Un message de suivi a été publié sur votre signalement :')}
        ${citation(texte)}
        ${bouton(lienDetail, 'Voir le signalement')}
      `
    })
  })
}

export async function envoyerNouveauCommentaire(signalement, emailAuteur, commentaire) {
  if (!emailAuteur) return

  const lienDetail = `${SITE_URL}/signalements/${signalement.id}`
  const extrait = commentaire.texte.length > 300 ? `${commentaire.texte.slice(0, 300)}...` : commentaire.texte
  const objet = commentaire.estReponse
    ? `${commentaire.auteur} a répondu à votre commentaire`
    : `${commentaire.auteur} a réagi à votre signalement`
  const introduction = commentaire.estReponse
    ? `${commentaire.auteur} a répondu à votre commentaire sur ce signalement :`
    : `${commentaire.auteur} a laissé un commentaire sur votre signalement :`

  await envoyerEmail({
    to: emailAuteur,
    subject: objet,
    text: [
      introduction,
      `${signalement.categorie} — ${signalement.commune}`,
      '',
      `« ${extrait} »`,
      '',
      `Répondre ou voir le signalement : ${lienDetail}`
    ].join('\n'),
    html: gabarit({
      titre: commentaire.estReponse ? 'Nouvelle réponse' : 'Nouveau commentaire',
      sousTitre: `${signalement.categorie} — ${signalement.commune}`,
      apercu: extrait.slice(0, 120),
      contenu: `
        ${paragraphe(`<strong style="color:#0f172a;">${echapperHtml(commentaire.auteur)}</strong> ${commentaire.estReponse ? 'a répondu à votre commentaire' : 'a réagi à votre signalement'} :`)}
        ${citation(extrait)}
        ${bouton(lienDetail, 'Voir et répondre')}
      `
    })
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
    html: gabarit({
      titre: 'Confirmez votre adresse email',
      apercu: `Votre code : ${code}`,
      contenu: `
        ${paragraphe(`Bonjour ${echapperHtml(nom)},`)}
        ${paragraphe('Bienvenue sur Signale Mayotte ! Saisissez ce code sur le site pour confirmer votre adresse :')}
        <div style="margin:0 0 8px; padding:20px; background:#f0fdf4; border:2px dashed #86efac; border-radius:12px; text-align:center; font-size:34px; font-weight:800; letter-spacing:10px; color:#166534; font-family:'Courier New', monospace;">${echapperHtml(code)}</div>
        ${note("Ce code expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.")}
      `
    })
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
    html: gabarit({
      titre: 'Choisissez un nouveau mot de passe',
      apercu: 'Ce lien est valable 1 heure.',
      contenu: `
        ${paragraphe(`Bonjour ${echapperHtml(nom)},`)}
        ${paragraphe('Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :')}
        ${bouton(lienReinitialisation, 'Choisir un nouveau mot de passe')}
        ${note(`Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe restera inchangé.<br><br>Le bouton ne marche pas ? Copiez cette adresse dans votre navigateur :<br><a href="${lienReinitialisation}" style="color:#64748b; word-break:break-all;">${lienReinitialisation}</a>`)}
      `
    })
  })
}

// Prévient l'association qu'un contenu a été signalé comme abusif, pour qu'il ne
// reste pas en ligne jusqu'à la prochaine visite de l'onglet Modération.
export async function envoyerAlerteContenuAbusif({ type, signalementId, extrait, motif }) {
  const lienDetail = `${SITE_URL}/signalements/${signalementId}`
  const lienModeration = `${SITE_URL}/admin`
  const libelle = type === 'commentaire' ? 'Un commentaire' : 'Un signalement'

  await envoyerEmail({
    to: destinataire,
    subject: `[Modération] ${libelle} a été signalé comme abusif`,
    text: [
      `${libelle} a été signalé comme abusif.`,
      extrait ? `Contenu : ${extrait}` : '',
      `Motif : ${motif || 'non précisé'}`,
      `Voir le signalement : ${lienDetail}`,
      `Espace de modération : ${lienModeration}`
    ]
      .filter(Boolean)
      .join('\n'),
    html: gabarit({
      titre: 'Contenu signalé comme abusif',
      couleur: COULEURS.rouge,
      apercu: `${libelle} a été signalé par un utilisateur.`,
      contenu: `
        ${paragraphe(`<strong style="color:#0f172a;">${libelle}</strong> a été signalé par un utilisateur.`)}
        ${fiche([
          ['Contenu', extrait],
          ['Motif', motif || 'non précisé']
        ])}
        ${bouton(lienDetail, 'Voir le signalement', COULEURS.rouge)}
        ${note(`Décision à prendre dans l'onglet Modération : <a href="${lienModeration}" style="color:#64748b;">${lienModeration}</a>`)}
      `
    })
  })
}

export async function envoyerMessageContact({ nom, email, sujet, message }) {
  await envoyerEmail({
    to: destinataire,
    replyTo: email,
    subject: `[Contact] ${sujet} — ${nom}`,
    text: [`De : ${nom} <${email}>`, `Sujet : ${sujet}`, '', message].join('\n'),
    html: gabarit({
      titre: 'Nouveau message de contact',
      couleur: COULEURS.bleu,
      apercu: `${sujet} — ${nom}`,
      contenu: `
        ${fiche([
          ['De', `${nom} (${email})`],
          ['Sujet', sujet]
        ])}
        ${citation(message, COULEURS.bleu)}
        ${note('Répondez directement à cet email : la réponse partira vers la personne qui vous a écrit.')}
      `
    })
  })
}
