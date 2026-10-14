/** Quelles sont les adresses Amazon NON reconnues par la table des marchés ? */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/affiliation.js', import.meta.url), 'utf8');
const code = SRC.replace(/\bexport\s+/g, '');
const m = new Function(code + '\nreturn { marcheDe, AMAZON_TAGS };')();

const brut = JSON.parse(readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = brut.offres || brut;

const motifs = new Map();
const exemples = [];

for (const o of offres) {
  const estAmazon = /amazon/i.test(o.marchand || '') || /amazon\./i.test(o.lienMarchand || '');
  if (!estAmazon) continue;
  const url = o.lienMarchand || o.lienPage || '';
  if (m.marcheDe(url)) continue;             // reconnue
  let cle = '(vide)';
  if (url) {
    try {
      const h = new URL(url).hostname.toLowerCase();
      cle = h;
    } catch { cle = 'adresse illisible : ' + url.slice(0, 60); }
  }
  motifs.set(cle, (motifs.get(cle) || 0) + 1);
  if (exemples.length < 12 && !exemples.some((e) => e.url === url)) {
    exemples.push({ url, marchand: o.marchand, pays: o.pays });
  }
}

console.log('Hôtes NON reconnus (les plus fréquents) :');
for (const [h, n] of [...motifs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(5)}  ${h}`);
}
console.log();
console.log('Exemples d\'adresses :');
for (const e of exemples) console.log(`  [${e.pays}] ${e.marchand} → ${e.url}`);
