#!/usr/bin/env node
/* =============================================================================
   FAIT ENTRER LES FEUILLES DE STYLE DANS index.html.

   POURQUOI. Constat B, 08/10/2026 : sur son PC, le site s'affichait SANS son
   habillage — logo géant, images invisibles, cartes sans cadre — alors que le
   panneau /admin/ s'affichait parfaitement. Mesures faites depuis :
     • les données et le programme passent (les offres s'affichent) ;
     • app.css est SAIN et servi correctement (200, text/css, 203 accolades) ;
     • l'admin, lui, écrit son style DANS la page — et il fonctionne ;
     • le défaut se reproduit en navigation privée, donc ni cache ni extension.
   Il ne reste qu'une explication : un filtre SUR LE POSTE (antivirus à
   inspection HTTPS, bloqueur de contenu, proxy) coupe les fichiers .css
   externes. On ne peut pas le corriger depuis ici — mais on peut rendre le site
   indifférent : en écrivant la feuille DANS la page, comme l'admin.

   Ce que ça change : plus aucun appel .css externe, donc plus rien à couper.
   Et un aller-retour réseau de moins (le poids total est identique : le HTML
   grossit de ce que le .css faisait).

   NE PAS ÉDITER LE BLOC À LA MAIN : éditer public/app.css, puis relancer
   « node bin/inliner-css.mjs ». Le test tests/css-en-ligne.test.mjs échoue si
   le bloc et les fichiers divergent.
   ============================================================================= */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const cheminHtml = join(racine, 'public', 'index.html');

const DEBUT = '<!-- DEBUT-FEUILLE-EN-LIGNE -->';
const FIN = '<!-- FIN-FEUILLE-EN-LIGNE -->';

const feuilles = [
  { fichier: 'fonts.css', titre: 'fonts.css — les polices de l’identité, servies en local' },
  { fichier: 'app.css', titre: 'app.css — tout l’habillage du site' },
];

function construireBloc() {
  const corps = feuilles.map(({ fichier, titre }) => {
    const css = readFileSync(join(racine, 'public', fichier), 'utf8');
    // Une balise </style> dans le CSS fermerait le bloc par accident : on refuse.
    if (/<\/style/i.test(css)) {
      throw new Error(`${fichier} contient « </style » : impossible à poser en ligne tel quel.`);
    }
    return `/* ========== ${titre} ========== */\n${css.trimEnd()}\n`;
  }).join('\n');

  return [
    DEBUT,
    '<!--',
    '     FEUILLE DE STYLE EN LIGNE — écrite par bin/inliner-css.mjs.',
    '',
    '     Elle n’est PAS appelée en fichier externe, volontairement : le 08/10/2026',
    '     le site s’affichait sans habillage sur le PC de B parce que les fichiers',
    '     .css étaient coupés en chemin (antivirus, bloqueur, proxy) — alors que le',
    '     panneau /admin/, qui écrit son style dans sa page, s’affichait bien.',
    '     Écrite ici, la feuille ne peut plus être coupée. Total identique : le HTML',
    '     grossit de ce que le fichier .css pesait, et un aller-retour disparaît.',
    '',
    '     Ne pas modifier à la main : éditer public/app.css ou public/fonts.css,',
    '     puis relancer « node bin/inliner-css.mjs ». Le test',
    '     tests/css-en-ligne.test.mjs échoue si ce bloc et les fichiers divergent.',
    '-->',
    '<style>',
    corps,
    '</style>',
    FIN,
  ].join('\n');
}

let html = readFileSync(cheminHtml, 'utf8');
const avant = html;

if (html.includes(DEBUT) && html.includes(FIN)) {
  // Déjà posé une fois : on remplace entre les bornes (idempotent).
  html = html.slice(0, html.indexOf(DEBUT)) + construireBloc()
       + html.slice(html.indexOf(FIN) + FIN.length);
} else {
  // Premier passage : on remplace le commentaire et les deux <link>.
  const motif = /<!-- Polices de[\s\S]*?<link rel="stylesheet" href="app\.css">/;
  if (!motif.test(html)) {
    throw new Error('Les deux <link rel="stylesheet"> attendus sont introuvables : index.html a changé de forme.');
  }
  html = html.replace(motif, construireBloc());
}

if (html === avant) {
  console.log('Feuille en ligne : déjà à jour, rien à faire.');
} else {
  writeFileSync(cheminHtml, html);
  const ko = (n) => (n / 1024).toFixed(1).replace('.', ',');
  console.log(`index.html mis à jour : ${ko(avant.length)} Ko → ${ko(html.length)} Ko.`);
}
