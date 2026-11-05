#!/usr/bin/env node
/* =============================================================================
   FAIT ENTRER public/legal.css DANS CHAQUE PAGE ADMINISTRATIVE.

   Même raison, même remède que bin/inliner-css.mjs (voir son en-tête) : le
   08/10/2026, les feuilles de style EXTERNES n'arrivaient plus au navigateur de
   B sur son PC. Une page légale doit rester lisible même dans ce cas — c'est
   même la page où cela compte le plus, puisque sa fonction est d'informer.

   Le bloc est IDEMPOTENT : on remplace ce qui vit entre les deux bornes, donc
   relancer l'outil ne fait jamais grossir les pages.

   NE PAS ÉDITER LE BLOC À LA MAIN : éditer public/legal.css, puis relancer
   « node bin/inliner-legal.mjs ». tests/legal.test.mjs échoue si le bloc posé
   et le fichier divergent.
   ============================================================================= */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEBUT = '<!-- DEBUT-FEUILLE-EN-LIGNE -->';
const FIN = '<!-- FIN-FEUILLE-EN-LIGNE -->';

/** Les pages administratives habillées par legal.css.
 *
 *  Elles existent en TROIS langues. La liste est CONSTRUITE, pas recopiée : une
 *  page ajoutée sans être inscrite ici s'afficherait nue — et personne ne s'en
 *  apercevrait avant qu'un visiteur tombe dessus. Le test tests/legal.test.mjs
 *  vérifie justement que TOUTE page administrative présente dans public/ est
 *  couverte par cette liste. */
export const BASES = ['mentions-legales', 'confidentialite', 'cookies', 'cgu'];
export const LANGUES_PAGES = ['', '.nl', '.en'];
export const PAGES = BASES.flatMap((base) => LANGUES_PAGES.map((l) => `${base}${l}.html`));

function construireBloc() {
  const css = readFileSync(join(racine, 'public', 'legal.css'), 'utf8');
  if (/<\/style/i.test(css)) {
    throw new Error('legal.css contient « </style » : impossible à poser en ligne tel quel.');
  }
  return [
    DEBUT,
    '<!--',
    '     FEUILLE DE STYLE EN LIGNE — écrite par bin/inliner-legal.mjs.',
    '',
    '     Elle n’est PAS appelée en fichier externe, volontairement : sur le PC de',
    '     B, les .css externes étaient coupés en chemin (antivirus, bloqueur, proxy).',
    '     Une page d’information dont l’habillage dépendrait d’un fichier bloqué ne',
    '     remplirait pas sa fonction.',
    '',
    '     Ne pas modifier à la main : éditer public/legal.css, puis relancer',
    '     « node bin/inliner-legal.mjs ». Le test tests/legal.test.mjs échoue si ce',
    '     bloc et le fichier divergent.',
    '-->',
    '<style>',
    css.trimEnd(),
    '</style>',
    FIN,
  ].join('\n');
}

const bloc = construireBloc();
let modifies = 0;

for (const page of PAGES) {
  const chemin = join(racine, 'public', page);
  const html = readFileSync(chemin, 'utf8');
  const a = html.indexOf(DEBUT);
  const b = html.indexOf(FIN);
  if (a < 0 || b < a) {
    throw new Error(`${page} : bornes ${DEBUT} / ${FIN} introuvables — la page a changé de forme.`);
  }
  const neuf = html.slice(0, a) + bloc + html.slice(b + FIN.length);
  if (neuf !== html) { writeFileSync(chemin, neuf); modifies += 1; }
}

console.log(modifies
  ? `Feuille en ligne : ${modifies} page(s) mise(s) à jour.`
  : 'Feuille en ligne : déjà à jour, rien à faire.');
