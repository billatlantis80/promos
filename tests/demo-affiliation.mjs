/**
 * Démonstration sur les VRAIES offres : combien d'offres Amazon par marché,
 * et que devient le lien avec un identifiant par pays.
 * Identifiants FACTICES — rien n'est publié, on regarde seulement l'effet.
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/affiliation.js', import.meta.url), 'utf8');
const TAGS = {
  'amazon.fr': 'demo-fr-21', 'amazon.de': 'demo-de-21', 'amazon.it': 'demo-it-21',
  'amazon.es': 'demo-es-21', 'amazon.nl': 'demo-nl-21', 'amazon.com.be': 'demo-be-21',
  'amazon.co.uk': 'demo-uk-21', 'amazon.ie': 'demo-ie-21',
  'amazon.se': 'demo-se-21', 'amazon.pl': 'demo-pl-21',
};
const code = SRC
  .replace(/export const AMAZON_TAGS = \{[\s\S]*?\n\};/, 'export const AMAZON_TAGS = ' + JSON.stringify(TAGS) + ';')
  .replace(/\bexport\s+/g, '');
const m = new Function(code + '\nreturn { lienAffilie, marcheDe };')();

const brut = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = brut.offres || brut;

const parMarche = new Map();
let amazonTotal = 0;
let exemple = null;

for (const o of offres) {
  const estAmazon = /amazon/i.test(o.marchand || '') || /amazon\./i.test(o.lienMarchand || '');
  if (!estAmazon) continue;
  amazonTotal++;
  const url = o.lienMarchand || o.lienPage || '';
  const dom = m.marcheDe(url) || '(marché non reconnu)';
  parMarche.set(dom, (parMarche.get(dom) || 0) + 1);
  if (!exemple && dom !== '(marché non reconnu)') {
    exemple = { avant: url, apres: m.lienAffilie(url, o.marchand || 'Amazon'), titre: o.titre };
  }
}

console.log('Offres totales dans offres.json :', offres.length);
console.log('Offres Amazon                   :', amazonTotal);
console.log();
console.log('Répartition par marché Amazon :');
for (const [d, n] of [...parMarche.entries()].sort((a, b) => b[1] - a[1])) {
  const tag = TAGS[d] || '(pas d\'identifiant)';
  console.log(`  ${String(n).padStart(5)}  ${d.padEnd(18)} → tag ${tag}`);
}
console.log();
if (exemple) {
  console.log('Exemple concret :', exemple.titre);
  console.log('  AVANT :', exemple.avant);
  console.log('  APRÈS :', exemple.apres);
}
