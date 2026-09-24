/**
 * Dossier projet complet (parties I à III) au format Word, charte vert lagon / orange.
 * Usage : node docs/dossier-complet.cjs
 * Les schémas sont dessinés en SVG puis convertis en PNG par sharp.
 */
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow,
  TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber,
  PageBreak, TableOfContents, ImageRun
} = require('docx')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const VERT = '0F766E'
const ORANGE = 'C2410C'
const ENCRE = '1F2937'
const GRIS = '64748B'
const FOND_LIBELLE = 'F1F5F9'
const FOND_NOTE = 'ECFDF5'
const BORDURE = 'CBD5E1'
const LARGEUR = 9600
const police = 'Arial'

// ---------- Briques de mise en page ----------

function runs(texte, o = {}) {
  return String(texte).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((b) => {
    const gras = b.startsWith('**') && b.endsWith('**')
    return new TextRun({
      text: gras ? b.slice(2, -2) : b,
      bold: gras || o.bold,
      italics: o.italics,
      color: o.color || ENCRE,
      size: o.size || 21,
      font: police
    })
  })
}

const p = (t, o = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 140, line: 300 }, children: runs(t, o) })

const puce = (t) => new Paragraph({ numbering: { reference: 'puces', level: 0 }, spacing: { after: 60, line: 276 }, children: runs(t) })
const numero = (t) => new Paragraph({ numbering: { reference: 'numeros', level: 0 }, spacing: { after: 60, line: 276 }, children: runs(t) })

function partie(numeroRomain, titre) {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: `PARTIE ${numeroRomain}`, bold: true, size: 20, color: ORANGE, font: police })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: titre })] })
  ]
}
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] })
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t })] })

// Encadré « En bref » : ce qu'il faut retenir, en langage simple
function enBref(lignes) {
  const bord = { style: BorderStyle.SINGLE, size: 24, color: VERT, space: 8 }
  return [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: FOND_NOTE },
      border: { left: bord },
      indent: { left: 120, right: 120 },
      spacing: { before: 120, after: 40 },
      children: [new TextRun({ text: 'En bref', bold: true, color: VERT, size: 22, font: police })]
    }),
    ...lignes.map((l, i) =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: FOND_NOTE },
        border: { left: bord },
        indent: { left: 120, right: 120 },
        spacing: { after: i === lignes.length - 1 ? 240 : 30, line: 276 },
        children: runs('•  ' + l)
      })
    )
  ]
}

// Citation ou remarque, en italique avec filet vert
const citation = (t) =>
  new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: FOND_NOTE },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: VERT, space: 8 } },
    indent: { left: 120, right: 120 },
    spacing: { before: 80, after: 200, line: 276 },
    children: runs(t, { italics: true, color: VERT })
  })

const note = (t) => new Paragraph({ spacing: { before: 80, after: 200, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: runs(t, { italics: true, color: GRIS }) })

const trait = { style: BorderStyle.SINGLE, size: 4, color: BORDURE }
const bordures = { top: trait, bottom: trait, left: trait, right: trait, insideHorizontal: trait, insideVertical: trait }

function cellule(contenu, { largeur, entete = false, libelle = false } = {}) {
  const lignes = Array.isArray(contenu) ? contenu : [contenu]
  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: entete ? VERT : libelle ? FOND_LIBELLE : 'FFFFFF' },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: lignes.map((l) =>
      Array.isArray(contenu) && lignes.length > 1
        ? new Paragraph({ numbering: { reference: 'puces', level: 0 }, spacing: { after: 20, line: 252 }, children: runs(l, { size: 19 }) })
        : new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(l, { bold: entete || libelle, color: entete ? 'FFFFFF' : ENCRE, size: 19 }) })
    )
  })
}

function largeursDe(proportions) {
  const l = proportions.map((x) => Math.round(LARGEUR * x))
  l[l.length - 1] += LARGEUR - l.reduce((a, b) => a + b, 0)
  return l
}

function tableau(entetes, lignes, proportions) {
  const l = largeursDe(proportions)
  return [
    new Table({
      columnWidths: l,
      width: { size: LARGEUR, type: WidthType.DXA },
      borders: bordures,
      rows: [
        new TableRow({ tableHeader: true, children: entetes.map((t, i) => cellule(t, { entete: true, largeur: l[i] })) }),
        ...lignes.map((ligne) => new TableRow({ children: ligne.map((t, i) => cellule(t, { largeur: l[i] })) }))
      ]
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] })
  ]
}

// Fiche d'un besoin fonctionnel : titre orange + tableau à libellés grisés
function besoin(ref, titre, { acteur, description, deroulement, regles, priorite }) {
  const l = largeursDe([0.22, 0.78])
  const ligne = (libelle, valeur) =>
    new TableRow({ cantSplit: true, children: [cellule(libelle, { libelle: true, largeur: l[0] }), cellule(valeur, { largeur: l[1] })] })
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({ text: `${ref} — `, bold: true, color: ORANGE, size: 21, font: police }),
        new TextRun({ text: titre, bold: true, color: ENCRE, size: 21, font: police })
      ]
    }),
    new Table({
      columnWidths: l,
      width: { size: LARGEUR, type: WidthType.DXA },
      borders: bordures,
      rows: [
        ligne('Acteur', acteur),
        ligne('Description', description),
        ligne('Déroulement / données', deroulement),
        ligne('Règles de gestion', regles),
        ligne('Priorité', priorite)
      ]
    })
  ]
}

function figure(png, largeurPx, hauteurPx, legende) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: png, transformation: { width: largeurPx, height: hauteurPx } })]
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: runs(legende, { italics: true, color: GRIS, size: 18 }) })
  ]
}

// ---------- Schémas (SVG → PNG) ----------

function echapper(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function acteurSvg(x, y, nom, sous) {
  return `
  <g stroke="#475569" stroke-width="2" fill="none">
    <circle cx="${x}" cy="${y}" r="11"/>
    <line x1="${x}" y1="${y + 11}" x2="${x}" y2="${y + 44}"/>
    <line x1="${x - 20}" y1="${y + 22}" x2="${x + 20}" y2="${y + 22}"/>
    <line x1="${x}" y1="${y + 44}" x2="${x - 16}" y2="${y + 68}"/>
    <line x1="${x}" y1="${y + 44}" x2="${x + 16}" y2="${y + 68}"/>
  </g>
  <text x="${x}" y="${y + 88}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1f2937">${nom}</text>
  <text x="${x}" y="${y + 104}" text-anchor="middle" font-size="11" fill="#64748b">${sous}</text>`
}

function schemaCasUtilisation() {
  const visiteur = [
    'Consulter et filtrer la liste', 'Consulter la carte', "Consulter la fiche d'un signalement",
    'Consulter la page Transparence', "Contacter l'association", 'Créer un compte'
  ]
  const citoyen = [
    'Se connecter / confirmer son e-mail', 'Signaler un problème', 'Corriger ou supprimer son signalement',
    'Soutenir un signalement', 'Commenter / répondre', 'Signaler un contenu abusif',
    'Recevoir des notifications', 'Gérer son profil'
  ]
  const admin = [
    "S'authentifier (espace admin)", 'Consulter le tableau de bord', 'Changer le statut (+ photo)',
    'Publier une mise à jour officielle', 'Modérer les contenus', 'Lire les messages de contact',
    'Exporter les signalements (CSV)', 'Gérer les comptes admin'
  ]
  const W = 1000, pas = 40, y0 = 70, cxG = 350, cxD = 660, rx = 128, ry = 16
  const H = y0 + pas * 14 + 64
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="205" y="20" width="600" height="${H - 64}" rx="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
  <text x="505" y="46" text-anchor="middle" font-size="15" font-weight="bold" fill="#0f766e">Système « Signale Mayotte »</text>`

  const ellipse = (cx, cy, texte, couleur) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" stroke="${couleur}" stroke-width="1.8"/>
     <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="#1f2937">${echapper(texte)}</text>`

  const ax = 95, avy = 120, acy = 400
  visiteur.forEach((t, i) => {
    const cy = y0 + i * pas
    s += `<line x1="${ax + 22}" y1="${avy + 25}" x2="${cxG - rx}" y2="${cy}" stroke="#94a3b8" stroke-width="1"/>`
    s += ellipse(cxG, cy, t, '#0f766e')
  })
  citoyen.forEach((t, i) => {
    const cy = y0 + (i + 6) * pas
    s += `<line x1="${ax + 22}" y1="${acy + 25}" x2="${cxG - rx}" y2="${cy}" stroke="#94a3b8" stroke-width="1"/>`
    s += ellipse(cxG, cy, t, '#c2410c')
  })
  const adx = 910, ady = 200
  admin.forEach((t, i) => {
    const cy = y0 + (i + 1) * pas
    s += `<line x1="${adx - 22}" y1="${ady + 25}" x2="${cxD + rx}" y2="${cy}" stroke="#94a3b8" stroke-width="1"/>`
    s += ellipse(cxD, cy, t, '#1d4ed8')
  })

  // Héritage : le citoyen inscrit peut tout ce que fait le visiteur
  s += `<line x1="${ax}" y1="${acy - 12}" x2="${ax}" y2="${avy + 128}" stroke="#475569" stroke-width="1.5"/>
        <polygon points="${ax - 9},${avy + 128} ${ax + 9},${avy + 128} ${ax},${avy + 112}" fill="#ffffff" stroke="#475569" stroke-width="1.5"/>`
  s += acteurSvg(ax, avy - 10, 'Visiteur', '(sans compte)')
  s += acteurSvg(ax, acy, 'Citoyen inscrit', '(compte gratuit)')
  s += acteurSvg(adx, ady - 10, 'Administrateur', "(l'association)")

  // Service e-mail externe
  const by = y0 + 11 * pas
  s += `<rect x="830" y="${by}" width="160" height="50" rx="6" fill="#ffffff" stroke="#475569" stroke-width="1.5"/>
        <text x="910" y="${by + 20}" text-anchor="middle" font-size="10" fill="#64748b">«système externe»</text>
        <text x="910" y="${by + 37}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2937">Service e-mail (Brevo)</text>
        <line x1="${cxG + rx}" y1="${y0 + 12 * pas}" x2="830" y2="${by + 25}" stroke="#94a3b8" stroke-dasharray="5,4"/>
        <line x1="${cxD + rx}" y1="${y0 + 3 * pas}" x2="890" y2="${by}" stroke="#94a3b8" stroke-dasharray="5,4"/>`

  // Légende
  const ly = H - 12
  s += `<text x="215" y="${ly - 4}" font-size="11" fill="#0f766e">● Visiteur</text>
        <text x="300" y="${ly - 4}" font-size="11" fill="#c2410c">● Citoyen inscrit</text>
        <text x="420" y="${ly - 4}" font-size="11" fill="#1d4ed8">● Administrateur</text>`
  return { svg: s + '</svg>', W, H }
}

function schemaArchitecture() {
  const W = 1000, H = 430
  const boite = (x, y, w, h, titre, sous, couleur = '#475569') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="${couleur}" stroke-width="1.8"/>
     <text x="${x + w / 2}" y="${y + h / 2 - 4}" text-anchor="middle" font-size="14" font-weight="bold" fill="#1f2937">${titre}</text>
     <text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="11" fill="#64748b">${sous}</text>`
  const fleche = (x1, y1, x2, y2, texte, tx, ty) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#475569" stroke-width="1.6" marker-end="url(#f)"/>
     <text x="${tx}" y="${ty}" font-size="11" fill="#c2410c">${texte}</text>`
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, sans-serif">
  <defs><marker id="f" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0,0 10,4 0,8" fill="#475569"/></marker></defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="300" y="20" width="250" height="390" rx="12" fill="#ecfdf5" stroke="#0f766e" stroke-dasharray="6,4" stroke-width="1.5"/>
  <text x="425" y="44" text-anchor="middle" font-size="13" font-weight="bold" fill="#0f766e">Hébergement Render</text>
  <text x="425" y="60" text-anchor="middle" font-size="10" fill="#64748b">(un seul service Node.js)</text>
  ${boite(30, 90, 200, 70, 'Navigateur', 'smartphone / ordinateur')}
  ${boite(320, 80, 210, 90, 'Front-end compilé', 'Vue 3 · Vue Router · Pinia', '#0f766e')}
  ${boite(320, 270, 210, 90, 'API REST', 'Node.js · Express 5', '#0f766e')}
  ${boite(30, 290, 200, 70, 'MapTiler', 'fonds de carte (Leaflet)')}
  ${boite(700, 170, 270, 80, 'Supabase', 'PostgreSQL · Storage (photos)', '#1d4ed8')}
  ${boite(700, 310, 270, 70, 'Brevo', "envoi des e-mails (API HTTPS)", '#c2410c')}
  ${fleche(230, 125, 318, 125, 'HTTPS', 250, 116)}
  ${fleche(425, 170, 425, 268, 'requêtes JSON', 432, 225)}
  ${fleche(130, 160, 130, 288, 'tuiles de carte', 138, 230)}
  ${fleche(530, 300, 698, 215, 'SQL / fichiers', 590, 245)}
  ${fleche(530, 330, 698, 345, 'e-mails', 600, 355)}
  </svg>`
  return { svg: s, W, H }
}

async function enPng({ svg }) {
  return sharp(Buffer.from(svg), { density: 192 }).png().toBuffer()
}

// ---------- Contenu ----------

async function construire() {
  const cu = schemaCasUtilisation()
  const ar = schemaArchitecture()
  const pngCu = await enPng(cu)
  const pngAr = await enPng(ar)
  const largeurFig = 620

  const garde = [
    new Paragraph({ spacing: { before: 3200, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Signale Mayotte', bold: true, size: 76, color: VERT, font: police })] }),
    p('Plateforme citoyenne de signalement des problèmes du quotidien', { center: true, size: 26, color: GRIS, after: 900 }),
    p('Dossier projet — Cahier des charges', { center: true, size: 26, after: 40 }),
    p('Projet fil rouge — Formation Développeur Web & Web Mobile', { center: true, size: 21, color: GRIS, after: 1200 }),
    p('**I. Présentation   ·   II. Expression des besoins   ·   III. Environnement technique**', { center: true, color: ORANGE, size: 21, after: 200 }),
    p('Application en ligne : https://signale-mayotte.onrender.com', { center: true, size: 19, color: GRIS, after: 40 }),
    p('Mayotte (976) — septembre 2026', { center: true, size: 19, color: GRIS, after: 1200 }),
    p('Réalisé par : ……………………………………', { center: true, size: 20 })
  ]

  const sommaire = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Sommaire', bold: true, size: 44, color: VERT, font: police })] }),
    new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-2' }),
    note("Si le sommaire apparaît vide ou sans numéros de page : dans Word, clic droit dessus → « Mettre à jour les champs » → « Mettre à jour toute la table »."),
    h3('Comment lire ce dossier'),
    p("Chaque partie commence par un encadré **« En bref »** qui résume l'essentiel en quelques lignes. Les besoins sont numérotés (**BF-xx** pour les besoins fonctionnels, **RG-xx** pour les règles de gestion) afin de pouvoir passer facilement d'un besoin à la règle qui l'encadre, puis à la mesure technique qui l'applique (partie III). Un **glossaire** en fin de document explique les termes techniques.")
  ]

  // ===== PARTIE I =====
  const p1 = [
    ...partie('I', 'Présentation du projet'),
    ...enBref([
      "**Quoi ?** Un site web où les habitants de Mayotte signalent les problèmes de leur quartier (déchets, voirie, éclairage, eau), avec photos et position sur une carte.",
      "**Pour qui ?** Tous les habitants pour consulter ; les habitants inscrits (compte gratuit) pour signaler ; l'association pour traiter.",
      "**Pourquoi ?** Aujourd'hui, les signalements se perdent (appels sans trace, messages dispersés sur les réseaux sociaux)."
    ]),
    h2('1.1 Le projet « Signale Mayotte »'),
    p("Signale Mayotte est une application web qui permet à n'importe quel habitant de Mayotte de signaler, en quelques clics, un problème du quotidien constaté dans sa commune : dépôt sauvage de déchets, dégradation de la voirie, panne d'éclairage public ou problème d'eau. Chaque signalement est accompagné de photos et d'une localisation sur la carte. Il est ensuite suivi publiquement jusqu'à sa résolution par l'association chargée de faire le lien avec les communes."),
    p("**Tout le monde peut consulter** les signalements sans créer de compte. Pour **signaler, soutenir ou commenter**, il faut un compte gratuit, créé en moins d'une minute avec une adresse e-mail **ou** un simple numéro de téléphone."),
    citation("Positionnement : « La plateforme citoyenne pour signaler les problèmes du quotidien — déchets, voirie, éclairage, eau — dans toutes les communes de Mayotte. »"),
    p("Le nom associe un verbe d'action (« Signale ») au territoire (« Mayotte ») : il dit immédiatement ce que fait le site et où il agit. Le logo reprend un repère de localisation sur un dégradé allant du vert-turquoise du lagon à l'orange des couchers de soleil."),

    h2('1.2 Contexte'),
    p("Mayotte, 101e département français depuis 2011, compte environ 320 000 habitants répartis sur 17 communes et 374 km². C'est le département le plus jeune de France et, hors Île-de-France, le plus densément peuplé. Cette croissance rapide, avec une urbanisation souvent non planifiée, met sous tension les infrastructures publiques, alors que les collectivités disposent de moyens limités pour repérer tous les dysfonctionnements."),
    h3('Les quatre problématiques traitées'),
    ...tableau(['Catégorie', 'Constat'], [
      ['Dépôt sauvage / déchets', 'Dépôts sauvages récurrents (bords de route, ravines, abords des marchés), avec un impact sanitaire et environnemental sur les mangroves et le lagon.'],
      ['Voirie', 'Nids-de-poule, affaissements, glissements de terrain en saison des pluies ; usure accélérée par le climat et le trafic.'],
      ['Éclairage public', 'Pannes électriques ou vandalisme, avec un impact direct sur le sentiment de sécurité le soir.'],
      ['Eau', 'Crises hydriques, coupures, fuites localisées et problèmes de pression, mal signalés faute de canal adapté.']
    ], [0.26, 0.74]),
    p("Une cinquième catégorie, **« Autre »**, accueille les problèmes qui n'entrent dans aucune des quatre précédentes."),
    h3('Les limites des canaux actuels'),
    ...tableau(['Canal existant', 'Limite constatée'], [
      ['Appel téléphonique à la mairie', "Pas de trace écrite ni de photo, dépend des horaires d'ouverture."],
      ['Réseaux sociaux (groupes Facebook)', 'Information dispersée, jamais transmise formellement aux services compétents.'],
      ['Courrier ou passage en mairie', "Délai long, déplacement obligatoire, inadapté à l'urgence."],
      ['Aucun canal', "Le problème n'est jamais signalé."]
    ], [0.36, 0.64]),

    h2('1.3 Le client (fictif)'),
    note("Conformément au cadre de l'exercice, le client est fictif."),
    ...tableau(['Élément', 'Détail'], [
      ['Nom', 'Association Maécha Salama (« bon voisinage » en shimaoré)'],
      ['Statut', 'Association loi 1901, à but non lucratif'],
      ['Activité', 'Médiation citoyenne et cadre de vie'],
      ["Zone d'intervention", 'Les 17 communes de Mayotte'],
      ['Organisation', 'Une présidente, une chargée de mission « numérique et médiation », un réseau de correspondants bénévoles']
    ], [0.3, 0.7]),
    p("Jusqu'ici, l'association suivait les remontées dans un tableur partagé rempli à la main : pas de photo fiable, pas de localisation, aucun moyen de savoir si un problème était déjà signalé, pas de statistiques à présenter aux communes, et une charge de saisie trop lourde."),
    h3('Attentes du client'),
    numero('Un outil accessible à tous, utilisable sur ordinateur et smartphone : **consultation libre**, et **inscription gratuite et rapide** (e-mail ou téléphone) pour signaler.'),
    numero('Un espace de gestion sécurisé pour suivre et faire évoluer les signalements.'),
    numero('De la transparence envers les habitants sur les signalements en cours et résolus.'),
    numero('Une solution durable et peu coûteuse à faire fonctionner.'),
    h3('Pourquoi un compte pour signaler ?'),
    p("La première version autorisait le signalement sans compte. Le compte a été rendu obligatoire pour signaler, pour quatre raisons :"),
    puce("**limiter les abus** : un signalement est rattaché à une personne, ce qui décourage les faux signalements et le spam ;"),
    puce("**tenir l'auteur informé** : les notifications arrivent dans son espace, même sans adresse e-mail ;"),
    puce("**lui permettre d'agir sur son signalement** : le corriger ou le supprimer ;"),
    puce("**garder l'accès simple** : un numéro de téléphone suffit, ce qui convient au public qui n'utilise pas l'e-mail."),
    p("L'identité réelle n'est **jamais affichée publiquement** : seul un pseudo ou un nom abrégé (« Prénom N. ») apparaît."),

    h2('1.4 Objectifs du projet'),
    p("**Objectif général** : doter les habitants de Mayotte d'un outil simple et gratuit pour signaler les problèmes de leur cadre de vie, et donner à l'association les moyens de suivre et traiter ces signalements de façon transparente."),
    ...tableau(['Objectif', 'Traduction concrète'], [
      ['Réduire la friction du signalement', 'Inscription par téléphone ou e-mail, puis signalement en moins de deux minutes'],
      ['Fiabiliser la preuve', "Jusqu'à 5 photos par signalement et une position sur la carte"],
      ['Éviter la dispersion et les doublons', 'Base unique consultable par tous ; proposition automatique des signalements proches (moins de 400 m) ; bouton « Je soutiens »'],
      ['Rendre le traitement visible', 'Statuts publics, mises à jour officielles, photo de résolution, notifications'],
      ["Outiller l'administration", 'Tableau de bord, modération, export CSV, statistiques par commune'],
      ['Maîtriser les coûts', 'Hébergement et services dans leur offre gratuite']
    ], [0.36, 0.64])
  ]

  // ===== PARTIE II =====
  const pl = (...l) => l
  const p2 = [
    ...partie('II', 'Expression des besoins — Cahier des charges'),
    ...enBref([
      "**3 acteurs** : le Visiteur (consulte), le Citoyen inscrit (signale, soutient, commente) et l'Administrateur (traite et modère).",
      "**24 besoins fonctionnels** (BF-01 à BF-24) décrivent ce que chacun doit pouvoir faire.",
      "**26 règles de gestion** (RG-01 à RG-26) fixent les contraintes que l'application doit toujours respecter."
    ]),
    p("Cette partie traduit les attentes du client en besoins précis. Elle identifie d'abord les acteurs du système, puis détaille les besoins fonctionnels de chacun, les règles de gestion qui s'y appliquent, et enfin les besoins non fonctionnels et le périmètre."),

    h2('2.1 Les acteurs du système'),
    h3('Acteurs principaux'),
    ...tableau(['Acteur', 'Qui ?', 'Accès', 'Rôle dans le système'], [
      ['Visiteur', 'Tout habitant de Mayotte (ou internaute)', 'Site public, sans compte', "Consulte la liste, la carte, les fiches et les statistiques ; contacte l'association ; peut créer un compte."],
      ['Citoyen inscrit', 'Visiteur qui a créé un compte gratuit', 'E-mail ou téléphone + mot de passe', 'Signale un problème, soutient, commente, corrige ou supprime ses signalements, reçoit des notifications.'],
      ['Administrateur', "Membre de l'association (chargée de mission, correspondants)", "Espace d'administration séparé, identifiant + mot de passe", 'Traite les signalements, publie les mises à jour, modère, gère les comptes admin, exporte les données.']
    ], [0.16, 0.24, 0.25, 0.35]),
    note("Le Citoyen inscrit est un cas particulier du Visiteur : il peut faire tout ce que fait un visiteur, avec en plus les actions qui demandent un compte."),
    h3('Acteurs secondaires'),
    ...tableau(['Acteur', 'Rôle'], [
      ['Service e-mail Brevo (système externe)', "Envoie les e-mails automatiques : code de confirmation à l'inscription, réinitialisation du mot de passe, confirmation de dépôt, changement de statut, alerte à l'association à chaque nouveau signalement."],
      ['Communes de Mayotte', "N'ont pas d'accès direct dans cette version. Elles reçoivent les exports CSV et s'appuient sur la page Transparence lors des réunions avec l'association."]
    ], [0.32, 0.68]),
    h3("Diagramme de cas d'utilisation"),
    ...figure(pngCu, largeurFig, Math.round((largeurFig * cu.H) / cu.W), "Figure 1 — Cas d'utilisation par acteur"),

    h2('2.2 Besoins fonctionnels'),
    p("Chaque besoin est identifié (BF-xx), rattaché à un acteur, décrit, et relié aux règles de gestion (RG-xx) détaillées en 2.3. **Priorité** : *Indispensable* (obligatoire dans cette version) ou *Important* (prévu, mais non bloquant)."),
    h3('A. Besoins du Visiteur'),
    ...besoin('BF-01', 'Consulter la liste des signalements', {
      acteur: 'Visiteur',
      description: "Parcourir tous les signalements publiés pour voir ce qui a déjà été signalé près de chez soi.",
      deroulement: pl('Affichage en cartes : photo, catégorie, commune, extrait, statut, date, nombre de soutiens.', 'Filtres cumulables : commune, catégorie, statut, urgence.', 'Tri : plus récents, plus anciens, plus soutenus.', 'Recherche par mot-clé ; pagination.', 'Clic sur un signalement → fiche détaillée.'),
      regles: 'RG-06, RG-17, RG-18', priorite: 'Indispensable'
    }),
    ...besoin('BF-02', 'Consulter la carte interactive', {
      acteur: 'Visiteur',
      description: "Visualiser sur une carte de Mayotte l'ensemble des signalements localisés.",
      deroulement: pl('Carte centrée sur Mayotte (Grande-Terre et Petite-Terre).', 'Un marqueur par signalement localisé.', 'Clic sur un marqueur → aperçu puis accès à la fiche.'),
      regles: 'RG-05', priorite: 'Indispensable'
    }),
    ...besoin('BF-03', "Consulter la fiche d'un signalement", {
      acteur: 'Visiteur',
      description: 'Voir le détail complet d\'un signalement et son avancement.',
      deroulement: pl('Catégorie, commune, date, description complète, mention « urgent » le cas échéant.', 'Photos du problème et, une fois résolu, photo de résolution.', 'Frise du statut : Signalé → En cours → Résolu.', "Mises à jour officielles publiées par l'association.", 'Commentaires et réponses ; compteur de soutiens.'),
      regles: 'RG-11, RG-18', priorite: 'Indispensable'
    }),
    ...besoin('BF-04', 'Consulter la page Transparence', {
      acteur: 'Visiteur',
      description: 'Accéder à des statistiques publiques sur le traitement des signalements.',
      deroulement: pl('Nombre de signalements par statut, par commune et par catégorie.', 'Part des signalements résolus et délai moyen de résolution (en jours).'),
      regles: 'RG-24', priorite: 'Important'
    }),
    ...besoin('BF-05', "Contacter l'association", {
      acteur: 'Visiteur',
      description: "Envoyer un message à l'association via un formulaire de contact.",
      deroulement: pl('Saisie du nom, de l\'adresse e-mail, du sujet et du message.', "Confirmation d'envoi affichée à l'écran."),
      regles: 'RG-22, RG-26', priorite: 'Important'
    }),
    ...besoin('BF-06', 'Créer un compte', {
      acteur: 'Visiteur',
      description: 'Devenir citoyen inscrit pour pouvoir signaler, soutenir et commenter.',
      deroulement: pl('Saisie du nom, d\'un e-mail et/ou d\'un numéro de téléphone, et d\'un mot de passe.', 'Indication de la force du mot de passe pendant la frappe.', 'Si un e-mail est saisi : envoi d\'un code de confirmation à 6 chiffres.'),
      regles: 'RG-07, RG-08, RG-09, RG-22', priorite: 'Indispensable'
    }),

    h3('B. Besoins du Citoyen inscrit'),
    ...besoin('BF-07', 'Se connecter et sécuriser son compte', {
      acteur: 'Citoyen inscrit',
      description: 'Accéder à son compte et le garder sous contrôle.',
      deroulement: pl('Connexion avec e-mail ou téléphone + mot de passe ; déconnexion.', 'Confirmation de l\'adresse e-mail par le code à 6 chiffres.', 'Mot de passe oublié : lien de réinitialisation reçu par e-mail.'),
      regles: 'RG-07, RG-08, RG-23', priorite: 'Indispensable'
    }),
    ...besoin('BF-08', 'Signaler un problème', {
      acteur: 'Citoyen inscrit (Service e-mail en secondaire)',
      description: 'Créer un signalement décrivant un problème constaté, avec preuve photo et localisation.',
      deroulement: pl('Choisir une catégorie : Dépôt sauvage / déchets, Voirie, Éclairage public, Eau, Autre.', 'Choisir la commune parmi les 17 communes de Mayotte.', 'Saisir une description (10 à 2000 caractères).', "Ajouter jusqu'à 5 photos (fichier ou appareil photo du smartphone).", 'Placer un repère sur la carte ou utiliser la géolocalisation.', 'Cocher « urgent » en cas de danger immédiat.', 'Saisir un e-mail de suivi (facultatif).', "Avant l'envoi, les signalements similaires proches sont proposés.", 'Valider : redirection vers la fiche du signalement créé.'),
      regles: 'RG-01 à RG-06, RG-09, RG-10, RG-16, RG-17, RG-19, RG-21, RG-22', priorite: 'Indispensable'
    }),
    ...besoin('BF-09', 'Corriger son signalement', {
      acteur: 'Citoyen inscrit (auteur)',
      description: 'Rectifier une erreur (faute de frappe, mauvaise commune, photo) après l\'envoi.',
      deroulement: pl('Bouton « Modifier » sur la fiche de son signalement.', 'Possible uniquement tant que le signalement est « Signalé ».'),
      regles: 'RG-13', priorite: 'Important'
    }),
    ...besoin('BF-10', 'Supprimer son signalement', {
      acteur: 'Citoyen inscrit (auteur)',
      description: 'Retirer un signalement qu\'on a créé.',
      deroulement: pl('Depuis sa fiche, ou via le lien personnel reçu par e-mail.', 'Demande de confirmation avant suppression définitive.'),
      regles: 'RG-14', priorite: 'Important'
    }),
    ...besoin('BF-11', 'Soutenir un signalement existant', {
      acteur: 'Citoyen inscrit',
      description: "Indiquer qu'on est aussi concerné par un problème déjà signalé, au lieu de créer un doublon.",
      deroulement: pl('Bouton « Je soutiens » sur la fiche.', 'Le compteur de soutiens augmente et reste public.'),
      regles: 'RG-15', priorite: 'Indispensable'
    }),
    ...besoin('BF-12', 'Commenter et répondre', {
      acteur: 'Citoyen inscrit',
      description: 'Échanger sous un signalement (précisions, témoignages).',
      deroulement: pl('Écrire un commentaire ou répondre à un commentaire.', 'Supprimer ses propres commentaires.'),
      regles: 'RG-18, RG-20', priorite: 'Important'
    }),
    ...besoin('BF-13', 'Recevoir des notifications', {
      acteur: 'Citoyen inscrit (Service e-mail en secondaire)',
      description: "Être informé de ce qui se passe sur ses signalements.",
      deroulement: pl('Cloche de notifications dans le site : changement de statut, nouveau commentaire, réponse.', 'E-mail en complément si une adresse vérifiée ou de suivi est connue.'),
      regles: 'RG-12', priorite: 'Important'
    }),
    ...besoin('BF-14', 'Signaler un contenu abusif', {
      acteur: 'Citoyen inscrit',
      description: "Alerter l'association sur un signalement ou un commentaire inapproprié.",
      deroulement: pl('Bouton « Signaler » sur le contenu, avec un motif.', "Le contenu apparaît dans l'espace de modération de l'administrateur."),
      regles: 'RG-22', priorite: 'Important'
    }),
    ...besoin('BF-15', 'Gérer son profil et ses signalements', {
      acteur: 'Citoyen inscrit',
      description: 'Personnaliser son affichage public et retrouver ses contributions.',
      deroulement: pl('Choisir un pseudo public et une photo de profil.', 'Page « Mes signalements » : liste de ses signalements et leur statut.'),
      regles: 'RG-18', priorite: 'Important'
    }),

    h3("C. Besoins de l'Administrateur"),
    ...besoin('BF-16', "S'authentifier", {
      acteur: 'Administrateur',
      description: "Accéder à l'espace d'administration, séparé du site public.",
      deroulement: pl("Saisie de l'identifiant et du mot de passe.", "Accès au tableau de bord si les identifiants sont corrects, message d'erreur sinon.", 'Déconnexion manuelle ou automatique à expiration de la session.'),
      regles: 'RG-08, RG-23', priorite: 'Indispensable'
    }),
    ...besoin('BF-17', 'Consulter le tableau de bord', {
      acteur: 'Administrateur',
      description: "Avoir une vue d'ensemble de l'activité de la plateforme.",
      deroulement: pl('Nombre de signalements par statut (Signalé, En cours, Résolu).', 'Liste de tous les signalements avec filtres.', 'Accès aux onglets de modération, messages et comptes.'),
      regles: 'RG-24', priorite: 'Indispensable'
    }),
    ...besoin('BF-18', "Changer le statut d'un signalement", {
      acteur: 'Administrateur (Service e-mail en secondaire)',
      description: 'Faire avancer un signalement dans son cycle de traitement.',
      deroulement: pl('Passage de « Signalé » à « En cours », puis à « Résolu ».', 'Au passage à « Résolu » : ajout possible d\'une photo attestant la résolution.', "Enregistrement de la date de résolution et notification de l'auteur."),
      regles: 'RG-11, RG-12', priorite: 'Indispensable'
    }),
    ...besoin('BF-19', 'Publier une mise à jour officielle', {
      acteur: 'Administrateur',
      description: "Informer publiquement de l'avancement (ex. : « Travaux prévus le 15 septembre »).",
      deroulement: pl("Saisie d'un message sur la fiche d'un signalement.", 'Le message est daté et affiché publiquement ; il peut être supprimé.'),
      regles: 'RG-11', priorite: 'Important'
    }),
    ...besoin('BF-20', 'Modérer les contenus', {
      acteur: 'Administrateur',
      description: "Retirer ce qui est faux, en double ou inapproprié.",
      deroulement: pl('Consulter la liste des contenus signalés par les citoyens.', 'Supprimer un signalement ou un commentaire (avec confirmation).'),
      regles: 'RG-14, RG-20', priorite: 'Indispensable'
    }),
    ...besoin('BF-21', 'Consulter les messages de contact', {
      acteur: 'Administrateur',
      description: 'Lire les messages envoyés depuis le formulaire de contact.',
      deroulement: pl('Liste des messages : expéditeur, e-mail, sujet, date, contenu.', 'Marquer comme lu ; supprimer.'),
      regles: 'RG-26', priorite: 'Important'
    }),
    ...besoin('BF-22', 'Exporter les signalements (CSV)', {
      acteur: 'Administrateur',
      description: 'Obtenir un fichier tableur de tous les signalements pour les réunions avec les communes.',
      deroulement: pl("Bouton d'export dans l'espace d'administration.", 'Colonnes : identifiant, catégorie, commune, description, statut, urgent, dates, coordonnées GPS, soutiens, coordonnées de l\'auteur.'),
      regles: 'RG-25', priorite: 'Important'
    }),
    ...besoin('BF-23', 'Gérer les comptes administrateurs', {
      acteur: 'Administrateur',
      description: 'Créer un compte distinct pour chaque membre, au lieu de partager un identifiant.',
      deroulement: pl('Création d\'un compte (identifiant + mot de passe).', 'Liste et suppression des comptes existants.', 'Changement de son propre mot de passe.'),
      regles: 'RG-08', priorite: 'Important'
    }),
    ...besoin('BF-24', 'Être alerté des nouveaux signalements', {
      acteur: 'Administrateur (Service e-mail en secondaire)',
      description: "Recevoir un e-mail à chaque nouveau signalement, pour qu'aucune remontée ne passe inaperçue.",
      deroulement: pl("Envoi automatique à l'adresse de l'association dès la création.", 'Le message résume le signalement et renvoie vers sa fiche.'),
      regles: 'RG-21', priorite: 'Important'
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    h3('Matrice acteurs / besoins'),
    ...tableau(['Besoins', 'Visiteur', 'Citoyen inscrit', 'Administrateur'], [
      ['BF-01 à BF-06 (consulter, contacter, créer un compte)', '✓', '✓ (hérite du Visiteur)', ''],
      ['BF-07 à BF-15 (signaler, soutenir, commenter, notifications, profil)', '', '✓', ''],
      ['BF-16 à BF-24 (administration)', '', '', '✓']
    ], [0.46, 0.14, 0.22, 0.18]),

    h2('2.3 Règles de gestion'),
    p("Les règles de gestion fixent les contraintes métier que l'application doit respecter, quelle que soit l'interface. Elles servent de base au modèle de données et **sont toutes contrôlées côté serveur** : même si quelqu'un contourne le formulaire, la règle s'applique."),
    ...tableau(['N°', 'Sujet', 'Règle'], [
      ['RG-01', 'Catégorie', 'Un signalement appartient à une et une seule catégorie parmi : Dépôt sauvage / déchets, Voirie, Éclairage public, Eau, Autre.'],
      ['RG-02', 'Commune', 'Un signalement est rattaché à une et une seule commune parmi les 17 communes de Mayotte. Une commune peut avoir 0 ou plusieurs signalements.'],
      ['RG-03', 'Description', 'La description est obligatoire et contient entre 10 et 2000 caractères.'],
      ['RG-04', 'Photos', 'Un signalement comporte de 0 à 5 photos. Seules les images sont acceptées (le format SVG est refusé car il peut contenir du code). Chaque photo est réencodée et analysée avant publication ; une photo inappropriée fait refuser l\'envoi.'],
      ['RG-05', 'Localisation', "Le formulaire demande une position (repère sur la carte ou géolocalisation). Un signalement sans position n'apparaît pas sur la carte."],
      ['RG-06', 'Accès', 'Consulter ne nécessite aucun compte. Signaler, soutenir, commenter et signaler un abus nécessitent un compte citoyen.'],
      ['RG-07', 'Compte', "Un compte possède au moins un moyen de contact : e-mail ou téléphone. Un même e-mail ou numéro ne peut servir qu'à un seul compte. Le numéro est enregistré sous une forme unique (10 chiffres, sans espaces)."],
      ['RG-08', 'Mots de passe', "8 caractères minimum, refus des mots de passe trop courants (ex. « 12345678 »). Stockés hachés avec bcrypt, jamais en clair. Valable pour les citoyens comme pour les administrateurs."],
      ['RG-09', 'E-mail confirmé', "Si le compte a été créé avec un e-mail, celui-ci doit être confirmé (code à 6 chiffres, valable 30 minutes) avant d'envoyer un signalement."],
      ['RG-10', 'Création', "À sa création, un signalement reçoit un identifiant unique, le statut « Signalé », la date du jour et un jeton secret de suppression."],
      ['RG-11', 'Cycle des statuts', "Statuts possibles : Signalé → En cours → Résolu. Seul un administrateur peut changer le statut ou publier une mise à jour officielle. Une photo de résolution, facultative, peut être jointe au passage à « Résolu »."],
      ['RG-12', 'Notifications', "Chaque changement de statut, nouveau commentaire ou réponse notifie l'auteur concerné dans le site. Un e-mail est envoyé seulement à une adresse de suivi ou à une adresse de compte vérifiée."],
      ['RG-13', 'Correction', "L'auteur peut corriger son signalement tant qu'il est « Signalé ». Dès qu'il passe « En cours », seul un administrateur peut le modifier."],
      ['RG-14', 'Suppression', "Un signalement peut être supprimé par son auteur, par le détenteur du lien de suppression reçu par e-mail, ou par un administrateur. Ses photos sont supprimées avec lui."],
      ['RG-15', 'Soutien', 'Un citoyen ne peut soutenir qu\'une seule fois le même signalement. Le nombre de soutiens est public.'],
      ['RG-16', 'Doublons', "Avant l'envoi, les signalements non résolus de même catégorie situés à moins de 400 m sont proposés (3 au maximum). C'est une suggestion : l'envoi n'est jamais bloqué."],
      ['RG-17', 'Urgence', "Un signalement marqué « urgent » est affiché avant les autres, quel que soit le tri choisi."],
      ['RG-18', 'Identité protégée', "Le nom réel, l'e-mail et le téléphone ne sont jamais affichés publiquement : on affiche le pseudo, ou à défaut le nom abrégé (« Zakaria Bacar » → « Zakaria B. »)."],
      ['RG-19', 'Vie privée des photos', 'Les métadonnées EXIF (dont la position GPS du téléphone) sont supprimées des photos avant publication.'],
      ['RG-20', 'Commentaires', "Un commentaire contient entre 3 et 1000 caractères. Les réponses n'ont qu'un seul niveau. Supprimer un commentaire supprime ses réponses."],
      ['RG-21', 'Alerte association', "Chaque nouveau signalement déclenche l'envoi d'un e-mail à l'association."],
      ['RG-22', 'Anti-spam', 'Les formulaires publics comportent un champ piège invisible : s\'il est rempli, l\'envoi est ignoré. Le nombre d\'envois est limité dans le temps (par exemple 5 signalements par heure).'],
      ['RG-23', 'Sessions', 'Les tentatives de connexion sont limitées (10 par quart d\'heure). Une session expire automatiquement au bout de 12 heures.'],
      ['RG-24', 'Statistiques', 'Taux de résolution = signalements « Résolu » / total des signalements. Délai moyen = moyenne (date de résolution − date de création) des signalements résolus, en jours.'],
      ['RG-25', 'Export', "L'export CSV est réservé aux administrateurs authentifiés (il contient des données personnelles des auteurs)."],
      ['RG-26', 'Messages de contact', 'Nom (2 caractères min.), e-mail valide, sujet et message (10 caractères min.) sont obligatoires. Les messages ne sont visibles que par les administrateurs.']
    ], [0.1, 0.2, 0.7]),

    h2('2.4 Besoins non fonctionnels'),
    p("Les besoins non fonctionnels ne décrivent pas **ce que** fait l'application, mais **comment** elle doit le faire : sécurité, rapidité, facilité d'utilisation…"),
    ...tableau(['Domaine', 'Exigence'], [
      ['Sécurité', 'Mots de passe hachés, limitation des tentatives de connexion, protection anti-spam des formulaires, contrôle strict des fichiers envoyés, en-têtes HTTP de sécurité, requêtes SQL paramétrées.'],
      ['Performance', "Pages légères, temps de chargement maîtrisé même sur une connexion mobile modeste ; reprise automatique si le serveur est en train de redémarrer."],
      ['Ergonomie', "Conception « mobile d'abord » ; bouton « Signaler un problème » visible dès le premier écran ; barre de navigation en bas de l'écran, à portée du pouce ; vocabulaire simple ; signalement possible en moins de 2 minutes."],
      ['Responsive', "Utilisable de 360 px de large (petit smartphone) jusqu'au grand écran, sans défilement horizontal."],
      ['Accessibilité', 'Interface en français, libellés explicites, contrastes lisibles, libellés pour les lecteurs d\'écran ; adaptée aux personnes peu à l\'aise avec le numérique.'],
      ['Fiabilité', "Photos stockées dans un service dédié, indépendant du serveur applicatif, pour ne pas être perdues lors d'un redéploiement."],
      ['Confidentialité (RGPD)', "Identité jamais publique ; données GPS retirées des photos ; page « Confidentialité » expliquant l'usage des données."],
      ['Compatibilité', 'Navigateurs récents : Chrome, Firefox, Safari, Edge.'],
      ['Coût', 'Hébergement et services annexes à coût nul pour la phase de lancement.']
    ], [0.24, 0.76]),

    h2('2.5 Contraintes et périmètre'),
    h3('Contraintes'),
    puce('Application accessible depuis un navigateur, sans installation.'),
    puce('Base de données relationnelle.'),
    puce('Respect du RGPD : la plateforme enregistre des noms, e-mails et numéros de téléphone.'),
    puce("Budget nul : aucun service payant."),
    puce('Délai : projet fil rouge mené en parallèle de la formation.'),
    h3('Inclus dans cette version'),
    puce('Comptes citoyens (e-mail ou téléphone), confirmation d\'e-mail, mot de passe oublié, profil.'),
    puce('Parcours complet de signalement avec photos, position, urgence et détection des doublons.'),
    puce('Consultation, filtres, recherche, carte interactive et page Transparence.'),
    puce('Soutiens, commentaires et réponses, notifications dans le site et par e-mail.'),
    puce("Espace d'administration : statuts, mises à jour, modération, messages, comptes, export CSV."),
    h3('Exclus de cette version (évolutions possibles)'),
    ...tableau(['Fonctionnalité', 'Raison'], [
      ['Notifications par SMS', 'Coût par message, incompatible avec un budget nul.'],
      ['Application mobile installable', 'Le site responsive couvre le besoin.'],
      ['Comptes « correspondant communal » limités à leur commune', "Nécessite un partenariat avec les communes, non établi à ce stade."],
      ['Remplissage automatique de la commune depuis la position', "Le service de carte gratuit utilisé ne fournit pas cette fonction."],
      ['Paiement en ligne', 'Sans objet : le service est gratuit.']
    ], [0.42, 0.58])
  ]

  // ===== PARTIE III =====
  const p3 = [
    ...partie('III', 'Environnement technique'),
    ...enBref([
      "**Front-end** (ce que voit l'utilisateur) : Vue 3, dans le navigateur.",
      "**Back-end** (le serveur) : Node.js + Express, qui applique les règles de gestion.",
      "**Données** : base PostgreSQL et photos chez Supabase ; e-mails envoyés par Brevo ; le tout hébergé gratuitement sur Render."
    ]),
    h2('3.1 Architecture générale'),
    p("L'application suit une architecture **client / serveur**. Le front-end, une application Vue 3, s'exécute dans le navigateur de l'utilisateur. Il communique avec une **API REST** en Node.js / Express, qui porte la logique métier et les règles de gestion. Les données sont stockées dans une base PostgreSQL et les photos dans un espace de stockage dédié, tous deux hébergés sur Supabase. Les e-mails sont envoyés par l'API de Brevo."),
    p("En production, **un seul service** hébergé sur Render sert à la fois l'API et les fichiers du front-end : les deux partagent la même adresse, ce qui simplifie le déploiement."),
    ...figure(pngAr, largeurFig, Math.round((largeurFig * ar.H) / ar.W), 'Figure 2 — Architecture technique'),
    h3("Exemple : ce qui se passe quand on envoie un signalement"),
    numero("Le navigateur envoie le formulaire (texte + photos) à l'API."),
    numero("L'API vérifie que l'utilisateur est connecté et qu'il n'a pas dépassé la limite d'envois."),
    numero('Elle contrôle les données (RG-01 à RG-04) puis analyse et nettoie les photos (RG-04, RG-19).'),
    numero('Elle envoie les photos à Supabase Storage et enregistre le signalement dans PostgreSQL.'),
    numero("Elle demande à Brevo d'envoyer l'alerte à l'association (RG-21) et, si besoin, la confirmation à l'auteur."),
    numero('Elle répond au navigateur, qui affiche la fiche du nouveau signalement.'),

    h2('3.2 Technologies utilisées'),
    ...tableau(['Couche', 'Technologie', 'Rôle'], [
      ['Front-end', 'Vue 3', "Framework JavaScript de l'interface (composants réactifs)"],
      ['', 'Vue Router', 'Navigation entre les pages sans rechargement ; protection des pages réservées aux comptes'],
      ['', 'Pinia', 'Gestion de l\'état partagé (session, signalements, notifications)'],
      ['', 'Bootstrap 5', 'Grille responsive, formulaires et boutons'],
      ['', 'Vite', 'Serveur de développement et compilation pour la production'],
      ['Cartographie', 'Leaflet + MapTiler (OpenStreetMap)', "Carte interactive, marqueurs, choix d'un point"],
      ['Back-end', 'Node.js + Express 5', 'API REST, validation des données, règles de gestion, authentification'],
      ['', 'bcryptjs · helmet · express-rate-limit', 'Hachage des mots de passe · en-têtes de sécurité · limitation du nombre de requêtes'],
      ['', 'multer · sharp · nsfwjs', 'Réception des photos · redimensionnement et suppression EXIF · détection des images inappropriées'],
      ['Base de données', 'PostgreSQL (Supabase), pilote pg', 'Comptes, signalements, soutiens, commentaires, notifications, messages'],
      ['Stockage', 'Supabase Storage', 'Photos des signalements, de résolution et de profil'],
      ['E-mails', 'Brevo (API HTTPS)', 'Codes de confirmation, notifications, alertes'],
      ['Hébergement', 'Render', "Mise en ligne de l'application, redéploiement automatique depuis GitHub"]
    ], [0.18, 0.34, 0.48]),

    h2('3.3 Hébergement et services'),
    p('Pour respecter la contrainte budgétaire du client, tous les services sont utilisés dans leur **offre gratuite** :'),
    puce("**Render** : héberge l'application ; chaque envoi de code sur GitHub déclenche un redéploiement. Contrepartie : le serveur se met en veille après environ 15 minutes sans visite et met jusqu'à une minute à se réveiller. Le site réessaie alors automatiquement et affiche un message d'attente."),
    puce('**Supabase** : base PostgreSQL et stockage de fichiers persistants, administrables depuis une console web.'),
    puce("**Brevo** : envoi d'e-mails par API. Gmail a d'abord été envisagé, mais Render bloque les connexions SMTP sortantes : les e-mails ne partaient pas. Le passage par une API HTTPS a résolu le problème."),
    puce("**MapTiler** : fonds de carte, avec une clé limitée au domaine du site."),

    h2('3.4 Outils de développement et de test'),
    ...tableau(['Besoin', 'Outil'], [
      ['Versionnage du code', 'Git, dépôt distant GitHub'],
      ['Développement', 'Visual Studio Code, Node.js et npm en local'],
      ['Tests de l\'API', 'Module de tests intégré à Node.js (node --test)'],
      ['Tests de parcours (navigateur)', 'Playwright'],
      ['Débogage et responsive', 'Outils de développement du navigateur'],
      ['Déploiement continu', 'Render connecté au dépôt GitHub'],
      ['Suivi de la base de données', "Console d'administration Supabase"]
    ], [0.4, 0.6]),

    h2('3.5 Sécurité mise en œuvre'),
    ...tableau(['Mesure', 'Règles couvertes'], [
      ['Hachage des mots de passe avec bcrypt, refus des mots de passe courants', 'RG-08'],
      ['Limitation des tentatives de connexion et sessions de 12 h', 'RG-23'],
      ['Champ piège (honeypot) et limitation des envois', 'RG-22'],
      ['Contrôle du type des fichiers, analyse du contenu, suppression des données EXIF', 'RG-04, RG-19'],
      ['Vérification que seul l\'auteur ou un admin modifie / supprime ; jeton de suppression', 'RG-13, RG-14'],
      ['Validation de toutes les données côté serveur', 'RG-01 à RG-03, RG-07'],
      ['Identité jamais renvoyée dans les pages publiques', 'RG-18'],
      ['Requêtes SQL paramétrées (protection contre l\'injection SQL)', '—'],
      ['En-têtes HTTP de sécurité (helmet)', '—']
    ], [0.74, 0.26]),

    h2('3.6 Arborescence du site'),
    ...tableau(['Espace', 'Pages'], [
      ['Site public', 'Accueil · Signaler un problème · Fiche d\'un signalement · Carte · Transparence · Contact · Confidentialité'],
      ['Compte citoyen', 'Inscription · Connexion · Vérifier son e-mail · Mot de passe oublié · Réinitialiser le mot de passe · Mes signalements · Profil'],
      ['Espace administrateur', 'Connexion · Tableau de bord (signalements, modération, messages, comptes)']
    ], [0.26, 0.74]),

    h2('Glossaire'),
    ...tableau(['Terme', 'Explication simple'], [
      ['Front-end / Back-end', "Le front-end est la partie visible, qui tourne dans le navigateur. Le back-end est le serveur, qui applique les règles et parle à la base de données."],
      ['API REST', 'Ensemble d\'adresses (routes) que le front-end appelle pour lire ou envoyer des données, au format JSON. Ex. : GET /api/signalements.'],
      ['Framework', 'Boîte à outils qui structure le code. Vue 3 (front) et Express (back) en sont deux.'],
      ['Base de données relationnelle', 'Données rangées dans des tables liées entre elles (un signalement est lié à son auteur, ses soutiens…). Ici : PostgreSQL.'],
      ['Session / jeton', "Après la connexion, le serveur donne un code secret (jeton) que le navigateur renvoie à chaque requête pour prouver qui il est."],
      ['Hachage (bcrypt)', "Transformation irréversible du mot de passe : on peut vérifier qu'un mot de passe est bon, mais on ne peut pas le retrouver."],
      ['Limitation de débit', "Nombre maximum de requêtes autorisées dans un temps donné, pour bloquer les robots et les attaques par essais répétés."],
      ['Honeypot (champ piège)', "Champ invisible pour un humain. Un robot le remplit : on sait alors que ce n'est pas un vrai utilisateur."],
      ['EXIF', "Informations cachées dans une photo (date, modèle du téléphone, position GPS). On les supprime pour protéger la vie privée."],
      ['CSV', 'Fichier texte ouvrable dans Excel, une ligne par signalement.'],
      ['Responsive', "Mise en page qui s'adapte à la taille de l'écran (téléphone, tablette, ordinateur)."],
      ['Déploiement continu', 'Chaque modification envoyée sur GitHub est mise en ligne automatiquement.'],
      ['RGPD', 'Règlement européen sur la protection des données personnelles.']
    ], [0.26, 0.74])
  ]

  return new Document({
    features: { updateFields: true },
    numbering: {
      config: [
        { reference: 'puces', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] },
        { reference: 'numeros', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 300 } } } }] }
      ]
    },
    styles: {
      default: { document: { run: { font: police, size: 21, color: ENCRE } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: police, size: 44, bold: true, color: VERT }, paragraph: { spacing: { before: 0, after: 240 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: police, size: 30, bold: true, color: VERT }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERT, space: 4 } } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: police, size: 23, bold: true, color: ORANGE }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1150, right: 1150 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Signale Mayotte — Dossier projet  ·  ', size: 16, color: GRIS, font: police }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS, font: police })
            ]
          })]
        })
      },
      children: [...garde, ...sommaire, ...p1, ...p2, ...p3]
    }]
  })
}

construire()
  .then((doc) => Packer.toBuffer(doc))
  .then((buffer) => {
    const chemin = path.join(__dirname, 'Dossier Signale Mayotte - Cahier des charges.docx')
    fs.writeFileSync(chemin, buffer)
    console.log('écrit :', chemin)
  })
