/** SONDE B4-g — stabilité (2 relevés) des pages Zooplus retenues par pays. */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const CANDIDATS = [
  ['FR', 'zooplus.fr/chiens', 'https://www.zooplus.fr/shop/chiens/offres_promotionnelles_chien', 'fr'],
  ['IT', 'zooplus.it/gatti', 'https://www.zooplus.it/shop/gatti/offerte_speciali_gatti', 'it'],
  ['ES', 'zooplus.es/gatos', 'https://www.zooplus.es/shop/tienda_gatos/ofertas_especiales_gatos', 'es'],
  ['SE', 'zooplus.se/katt', 'https://www.zooplus.se/specials/katt/specialerbjudanden/kattmat/81531', 'sv'],
];
function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '18', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}
const source = (pays, nom, url, langue) => ({ id: `b4g-${pays}`, nom, type: 'enseigne', pays, langue, url });
const mesure = (url, langue, pays) => {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, 'Zooplus', url, langue)) : [];
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  return { n: propres.length, titres: propres.map((o) => o.titre).sort(), ex: propres.slice(0, 2) };
};
console.log('pays  page                R1  R2  identiques  exemples');
for (const [pays, nom, url, langue] of CANDIDATS) {
  const a = mesure(url, langue, pays); await dormir(3000);
  const b = mesure(url, langue, pays);
  const ok = JSON.stringify(a.titres) === JSON.stringify(b.titres);
  console.log(`${pays.padEnd(5)} ${nom.padEnd(18)} ${String(a.n).padStart(2)}  ${String(b.n).padStart(2)}  ${(ok ? 'oui ✔' : 'NON').padEnd(10)} ${a.ex.map((o) => `${o.remise}% ${o.titre.slice(0, 30)}`).join(' | ')}`);
  await dormir(1200);
}
