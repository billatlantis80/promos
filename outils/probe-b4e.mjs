/**
 * SONDE B4-e — STABILITÉ : deux relevés par source trouvée (règle « une source
 * n'est câblée que si elle rend la même chose DEUX fois de suite »). Chaque
 * relevé fait tourner le vrai lecteur `offresEnseigne` et compte les offres à
 * deux prix réels (15–90 %). On compare les ENSEMBLES de titres, pas les
 * comptes, pour ne pas confondre un même total avec un même contenu.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const CANDIDATS = [
  ['BE', 'coolblue.be/fr/offres', 'https://www.coolblue.be/fr/offres', 'fr'],
  ['NL', 'coolblue.nl/aanbieding', 'https://www.coolblue.nl/aanbieding', 'nl'],
  ['NL', 'coolblue.nl/aanbieding?p2', 'https://www.coolblue.nl/aanbieding?page=2', 'nl'],
  ['NL', 'coolblue.nl/aanbieding?p3', 'https://www.coolblue.nl/aanbieding?page=3', 'nl'],
  ['DE', 'coolblue.de/angebot', 'https://www.coolblue.de/angebot', 'de'],
  ['DE', 'coolblue.de/angebot?p2', 'https://www.coolblue.de/angebot?page=2', 'de'],
  ['DE', 'coolblue.de/angebot?p3', 'https://www.coolblue.de/angebot?page=3', 'de'],
  ['DE', 'zooplus.de/hund', 'https://www.zooplus.de/shop/hunde/sonderangebote_hund', 'de'],
  ['DE', 'zooplus.de/katze', 'https://www.zooplus.de/shop/katzen/sonderangebote_katze', 'de'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '18', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `b4e-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });

function mesure(url, langue, pays, nom) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  return { n: propres.length, lues: offres.length, titres: propres.map((o) => o.titre).sort(), ex: propres.slice(0, 3) };
}

console.log('pays  page                            R1  R2  identiques  exemples (R1)');
for (const [pays, nom, url, langue] of CANDIDATS) {
  const a = mesure(url, langue, pays, nom);
  await dormir(3000);
  const b = mesure(url, langue, pays, nom);
  const identique = JSON.stringify(a.titres) === JSON.stringify(b.titres);
  const ex = a.ex.map((o) => `${o.remise}% ${o.titre.slice(0, 34)}`).join(' | ') || '—';
  console.log(`${pays.padEnd(5)} ${nom.padEnd(31)} ${String(a.n).padStart(2)}  ${String(b.n).padStart(2)}  ${(identique ? 'oui ✔' : 'NON').padEnd(10)} ${ex}`);
  await dormir(1200);
}
