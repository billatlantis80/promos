/**
 * SONDE B4-c — le motif JSON-LD qui MARCHE (Coolblue BE /fr/offres) rejoué
 * chez Coolblue dans ses AUTRES pays, plus quelques enseignes JSON-LD
 * candidates. Lecteur réel `offresEnseigne`, deux prix réels.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const CANDIDATS = [
  ['--', 'NEG-inexistant', 'https://www.inexistant-b4c-xyzzy.example/deals', 'fr'],
  ['BE', 'POS-coolblue-be-fr', 'https://www.coolblue.be/fr/offres', 'fr'],
  ['BE', 'coolblue-be-nl', 'https://www.coolblue.be/nl/aanbiedingen', 'nl'],
  ['NL', 'coolblue-nl', 'https://www.coolblue.nl/aanbieding', 'nl'],
  ['DE', 'coolblue-de', 'https://www.coolblue.de/angebot', 'de'],
  ['NL', 'coolblue-nl-2', 'https://www.coolblue.nl/aanbieding?page=2', 'nl'],
  ['DE', 'coolblue-de-2', 'https://www.coolblue.de/angebot?page=2', 'de'],
  ['DE', 'galaxus-de', 'https://www.galaxus.de/de/aktionen', 'de'],
  ['AT', 'galaxus-at', 'https://www.galaxus.at/de/aktionen', 'de'],
  ['NL', 'bcc-nl', 'https://www.bcc.nl/', 'nl'],
  ['DE', 'alza-de', 'https://www.alza.de/', 'de'],
  ['BE', 'zooplus-be', 'https://www.zooplus.be/shop/deals', 'fr'],
  ['DE', 'zooplus-de', 'https://www.zooplus.de/shop/deals', 'de'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '15', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `b4c-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });
const jsonLd = (html) => (html.match(/application\/ld\+json/gi) || []).length;

console.log('pays  nom                 octets    ld   lues  2prix  exemple');
const resultats = [];
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  await dormir(1500);
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].titre.slice(0, 46)}`
    : (offres[0] ? `(1 prix) ${offres[0].titre.slice(0, 40)}` : '—');
  resultats.push({ pays, nom, url, langue, n1: propres.length, lues: offres.length });
  console.log(`${pays.padEnd(5)} ${nom.padEnd(19)} ${String(html.length).padStart(7)} ${String(jsonLd(html)).padStart(4)} ${String(offres.length).padStart(5)} ${String(propres.length).padStart(5)}  ${ex}`);
}
process.stdout.write('\nJSON:' + JSON.stringify(resultats) + '\n');
