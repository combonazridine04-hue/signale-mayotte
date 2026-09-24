/**
 * Génère les trois parties du dossier de projet DWWM au format Word.
 * Usage : node docs/generer-docx.cjs
 */
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, Footer, PageNumber, PageBreak
} = require('docx')
const fs = require('fs')
const path = require('path')

// --- Charte graphique : bleu foncé + bleu clair, comme le cahier des charges de référence ---
const MARINE = '1F4E79'
const BLEU = '2E75B6'
const DORE = BLEU // conservé pour les scripts qui l'importent encore
const GRIS = '7F7F7F'
const BORDURE = 'BFBFBF'
const LARGEUR = 9300 // DXA utilisables entre les marges A4

const police = 'Calibri'

// Titres relevés au fil de la construction, pour le plan de la page de garde et le sommaire
const sommaire = []
let garde = null

// Titre de section : bandeau bleu foncé, texte blanc
function titre1(texte) {
  sommaire.push({ niveau: 1, texte })
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: MARINE },
    children: [new TextRun({ text: texte, bold: true, size: 30, color: 'FFFFFF', font: police })]
  })
}

function titre2(texte) {
  sommaire.push({ niveau: 2, texte })
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: texte, bold: true, size: 26, color: BLEU, font: police })]
  })
}

function titre3(texte) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: texte, bold: true, size: 22, color: '000000', font: police })]
  })
}

// Texte avec **gras** interprété
function runs(texte, options = {}) {
  return texte.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((bout) => {
    const gras = bout.startsWith('**') && bout.endsWith('**')
    return new TextRun({
      text: gras ? bout.slice(2, -2) : bout,
      bold: gras || options.bold,
      italics: options.italics,
      color: options.color || '000000',
      size: options.size || 22,
      font: police
    })
  })
}

function p(texte, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, line: 300 },
    alignment: options.alignment,
    children: runs(texte, options)
  })
}

function puce(texte) {
  return new Paragraph({
    numbering: { reference: 'puces', level: 0 },
    spacing: { after: 60, line: 276 },
    children: runs(texte)
  })
}

// Encadré pour les points importants (rouge pour les emplacements à compléter)
function encadre(texte, couleur = MARINE) {
  return new Paragraph({
    spacing: { before: 160, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: couleur === 'C00000' ? 'FDECEC' : 'EAF1F8' },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: couleur, space: 8 } },
    indent: { left: 120, right: 120 },
    children: runs(texte)
  })
}

function cellule(texte, { entete = false, largeur } = {}) {
  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: entete ? MARINE : 'FFFFFF' },
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 252 },
        children: runs(String(texte), {
          bold: entete,
          color: entete ? 'FFFFFF' : '000000',
          size: 20
        })
      })
    ]
  })
}

function tableau(entetes, lignes, proportions) {
  const largeurs = proportions.map((x) => Math.round(LARGEUR * x))
  // Ajuste l'arrondi pour que la somme fasse exactement LARGEUR
  largeurs[largeurs.length - 1] += LARGEUR - largeurs.reduce((a, b) => a + b, 0)
  const trait = { style: BorderStyle.SINGLE, size: 4, color: BORDURE }

  return new Table({
    columnWidths: largeurs,
    width: { size: LARGEUR, type: WidthType.DXA },
    borders: {
      top: trait, bottom: trait, left: trait, right: trait,
      insideHorizontal: trait, insideVertical: trait
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: entetes.map((t, i) => cellule(t, { entete: true, largeur: largeurs[i] }))
      }),
      ...lignes.map((ligne) =>
        // cantSplit : une ligne ne doit jamais être coupée en deux pages. Sans ça, une
        // règle de gestion se retrouvait à cheval, la moitié de sa phrase sur la page
        // suivante, sans sa référence — illisible.
        new TableRow({
          cantSplit: true,
          children: ligne.map((t, i) => cellule(t, { largeur: largeurs[i] }))
        })
      )
    ]
  })
}

function espace(taille = 160) {
  return new Paragraph({ spacing: { after: taille }, children: [] })
}

function code(lignes) {
  return lignes.map(
    (l) =>
      new Paragraph({
        spacing: { after: 0, line: 240 },
        shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
        indent: { left: 200, right: 120 },
        children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18, color: '1F1F1F' })]
      })
  )
}

// --- Page de garde ---
// Retient seulement le titre : la page est construite par document(), une fois
// tous les titres connus, pour pouvoir afficher le plan et le sommaire.
function pageDeGarde(numero, sousTitre) {
  garde = { numero, sousTitre }
  return []
}

function centre(texte, run, after = 80) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after },
    children: [new TextRun({ text: texte, font: police, ...run })]
  })
}

function construireGarde() {
  const { numero, sousTitre } = garde
  return [
    espace(2000),
    centre(`DOSSIER DE PROJET — PARTIE ${numero}`, { size: 20, color: GRIS, characterSpacing: 40 }, 120),
    centre(sousTitre.toUpperCase(), { bold: true, size: 56, color: MARINE }, 120),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLEU, space: 10 } },
      children: [new TextRun({ text: 'Signale Mayotte', size: 32, color: BLEU, font: police })]
    }),
    centre('Plateforme citoyenne de signalement — https://signale-mayotte.onrender.com', { italics: true, size: 24 }, 1800),
    centre('Plan du document', { bold: true, size: 22, color: MARINE }, 60),
    ...sommaire.filter((t) => t.niveau === 1).map((t) => centre(t.texte, { size: 22 }, 20)),
    espace(1600),
    centre('Réalisé par : ……………………………………', { size: 20 }, 40),
    centre('Formation Développeur Web et Web Mobile — Promotion 2026', { size: 22 }, 0),
    new Paragraph({ children: [new PageBreak()] })
  ]
}

function construireSommaire() {
  return [
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Sommaire', bold: true, size: 36, color: MARINE, font: police })]
    }),
    ...sommaire.map((t) =>
      t.niveau === 1
        ? new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [new TextRun({ text: t.texte, bold: true, size: 24, color: MARINE, font: police })]
          })
        : new Paragraph({
            spacing: { after: 20 },
            indent: { left: 900 },
            children: [new TextRun({ text: t.texte, size: 22, font: police })]
          })
    ),
    new Paragraph({ children: [new PageBreak()] })
  ]
}

function document(enfants) {
  const titreDoc = garde ? `Dossier de projet — Partie ${garde.numero} — ${garde.sousTitre}` : 'Dossier de projet'
  const debut = garde ? [...construireGarde(), ...construireSommaire()] : []
  return new Document({
    numbering: {
      config: [
        {
          reference: 'puces',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } }
            }
          ]
        }
      ]
    },
    styles: { default: { document: { run: { font: police, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${titreDoc}    |    Page `, size: 16, color: GRIS, font: police }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS, font: police })
                ]
              })
            ]
          })
        },
        children: [...debut, ...enfants]
      }
    ]
  })
}

async function ecrire(nom, doc) {
  const buffer = await Packer.toBuffer(doc)
  const chemin = path.join(__dirname, nom)
  fs.writeFileSync(chemin, buffer)
  console.log('écrit :', chemin)
}

module.exports = { titre1, titre2, titre3, p, puce, encadre, tableau, espace, code, pageDeGarde, document, ecrire, MARINE, BLEU, DORE }
