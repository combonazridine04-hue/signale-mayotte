/**
 * Génère les trois parties du dossier de projet DWWM au format Word.
 * Usage : node docs/generer-docx.cjs
 */
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, convertInchesToTwip
} = require('docx')
const fs = require('fs')
const path = require('path')

// --- Charte graphique : bleu marine + doré, comme les supports de formation ---
const MARINE = '1F3864'
const BLEU = '2E74B5'
const DORE = 'B8860B'
const GRIS = '44546A'
const FOND_TABLE = 'EDF2F9'
const LARGEUR = 9000 // DXA utilisables entre les marges A4

const police = 'Calibri'

function titre1(texte) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: DORE, space: 6 } },
    children: [new TextRun({ text: texte, bold: true, size: 32, color: MARINE, font: police })]
  })
}

function titre2(texte) {
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
    children: [new TextRun({ text: texte, bold: true, size: 23, color: MARINE, font: police })]
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
      color: options.color || '262626',
      size: options.size || 22,
      font: police
    })
  })
}

function p(texte, options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 120, line: 276 },
    alignment: options.alignment,
    children: runs(texte, options)
  })
}

function puce(texte) {
  return new Paragraph({
    numbering: { reference: 'puces', level: 0 },
    spacing: { after: 80, line: 276 },
    children: runs(texte)
  })
}

// Encadré coloré pour les points importants
function encadre(texte, couleur = DORE) {
  return new Paragraph({
    spacing: { before: 160, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: 'FFF8E7' },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: couleur, space: 8 } },
    indent: { left: 120, right: 120 },
    children: runs(texte, { color: '3D2E00' })
  })
}

function cellule(texte, { entete = false, largeur, fond } = {}) {
  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: entete ? MARINE : fond || 'FFFFFF' },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 252 },
        children: runs(String(texte), {
          bold: entete,
          color: entete ? 'FFFFFF' : '262626',
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

  return new Table({
    columnWidths: largeurs,
    width: { size: LARGEUR, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'B4C6E7' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B4C6E7' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'B4C6E7' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'B4C6E7' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'B4C6E7' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'B4C6E7' }
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: entetes.map((t, i) => cellule(t, { entete: true, largeur: largeurs[i] }))
      }),
      ...lignes.map((ligne, n) =>
        new TableRow({
          children: ligne.map((t, i) =>
            cellule(t, { largeur: largeurs[i], fond: n % 2 ? FOND_TABLE : 'FFFFFF' })
          )
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
        shading: { type: ShadingType.CLEAR, fill: 'F4F6F8' },
        indent: { left: 200, right: 120 },
        children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18, color: '1B3A57' })]
      })
  )
}

// --- Page de garde ---
function pageDeGarde(numero, sousTitre) {
  return [
    espace(1400),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: 'DOSSIER DE PROJET', bold: true, size: 26, color: DORE, font: police, characterSpacing: 60 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `PARTIE ${numero}`, bold: true, size: 64, color: MARINE, font: police })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: DORE, space: 12 } },
      children: [new TextRun({ text: sousTitre, bold: true, size: 32, color: BLEU, font: police })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'Signale Mayotte', bold: true, size: 28, color: MARINE, font: police })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'Plateforme citoyenne de signalement — projet fil rouge', size: 22, color: GRIS, italics: true, font: police })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Titre Professionnel Développeur Web et Web Mobile', size: 22, color: GRIS, font: police })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'https://signale-mayotte.onrender.com', size: 20, color: BLEU, font: police })]
    })
  ]
}

function document(enfants) {
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
              style: { paragraph: { indent: { left: 400, hanging: 200 } } }
            }
          ]
        }
      ]
    },
    styles: { default: { document: { run: { font: police, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
        children: enfants
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
