/**
 * SONDE B4-f — extension du filon Zooplus (Animaux) aux autres pays, avec les
 * chemins de promotion DÉCOUVERTS dans chaque accueil local. Lecteur réel.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const CANDIDATS = [
  ['--', 'NEG-inexistant', 'https://www.inexistant-b4f-xyzzy.example/deals', 'fr'],
  ['NL', 'zooplus.nl/aanbiedingen', 'https://www.zooplus.nl/info/offer/aanbiedingen', 'nl'],
  ['FR', 'zooplus.fr/chiens', 'https://www.zooplus.fr/shop/chiens/offres_promotionnelles_chien', 'fr'],
  ['FR', 'zooplus.fr/lots', 'https://www.zooplus.fr/shop/offres_promotionnelles/lots_nourriture', 'fr'],
  ['IT', 'zooplus.it/cani', 'https://www.zooplus.it/shop/cani/offerte_speciali_cani', 'it'],
  ['IT', 'zooplus.it/gatti', 'https://www.zooplus.it/shop/gatti/offerte_speciali_gatti', 'it'],
  ['ES', 'zooplus.es/gatos', 'https://www.zooplus.es/shop/tienda_gatos/ofertas_especiales_gatos', 'es'],
  ['ES', 'zooplus.es/perros', 'https://www.zooplus.es/shop/tienda_perros/ofertas_especiales_perros', 'es'],
  ['SE', 'zooplus.se/katt', 'https://www.zooplus.se/specials/katt/specialerbjudanden/kattmat/81531', 'sv'],
  ['SE', 'zooplus.se/hund', 'https://www.zooplus.se/specials/hund/specialerbjudanden/hundfoder/81515', 'sv'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '18', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `b4f-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });

console.log('pays  page                     octets    lues  2prix  exemple');
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  await dormir(1500);
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].titre.slice(0, 44)}`
    : (offres[0] ? `(1 prix) ${offres[0].titre.slice(0, 38)}` : '—');
  console.log(`${pays.padEnd(5)} ${nom.padEnd(22)} ${String(html.length).padStart(7)} ${String(offres.length).padStart(5)} ${String(propres.length).padStart(5)}  ${ex}`);
}
