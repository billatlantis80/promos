/**
 * SONDE B4-d — pages de promotion DÉCOUVERTES dans le HTML des accueils
 * (zooplus, jysk, MediaMarkt PL, Fressnapf), pas devinées. Lecteur réel.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const CANDIDATS = [
  ['--', 'NEG-inexistant', 'https://www.inexistant-b4d-xyzzy.example/deals', 'fr'],
  ['BE', 'POS-coolblue-be-fr', 'https://www.coolblue.be/fr/offres', 'fr'],
  ['BE', 'zooplus-be-promo', 'https://www.zooplus.be/shop/offres_promotionnelles', 'fr'],
  ['BE', 'zooplus-be-reduced', 'https://www.zooplus.be/search/results?filters=action%3Dhas_abd%3Bprice_reduced', 'fr'],
  ['DE', 'zooplus-de-sonder-hund', 'https://www.zooplus.de/shop/hunde/sonderangebote_hund', 'de'],
  ['DE', 'zooplus-de-sonder-katze', 'https://www.zooplus.de/shop/katzen/sonderangebote_katze', 'de'],
  ['DE', 'zooplus-de-angebote', 'https://www.zooplus.de/info/about/angebote', 'de'],
  ['DE', 'jysk-de-aktion', 'https://jysk.de/aktion', 'de'],
  ['NL', 'jysk-nl-woondeals', 'https://jysk.nl/woondeals', 'nl'],
  ['PL', 'mediamarkt-pl-promocje', 'https://mediamarkt.pl/pl/campaign/promocje', 'pl'],
  ['DE', 'fressnapf-aktionen', 'https://www.fressnapf.de/aktionen-angebote/', 'de'],
  ['DE', 'fressnapf-tiefpreis', 'https://www.fressnapf.de/aktionen-angebote/tiefpreis/', 'de'],
  ['BE', 'bitiba-be-promo', 'https://www.bitiba.be/shop/chiens/offres_promotionnelles', 'fr'],
  ['DE', 'bitiba-de-promo', 'https://www.bitiba.de/shop/hunde/sonderangebote_hund', 'de'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '15', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `b4d-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });
const jsonLd = (html) => (html.match(/application\/ld\+json/gi) || []).length;

console.log('pays  nom                     octets    ld   lues  2prix  exemple');
const resultats = [];
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  await dormir(1500);
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].titre.slice(0, 46)}`
    : (offres[0] ? `(1 prix) ${offres[0].titre.slice(0, 40)}` : '—');
  resultats.push({ pays, nom, url, langue, n1: propres.length, lues: offres.length });
  console.log(`${pays.padEnd(5)} ${nom.padEnd(23)} ${String(html.length).padStart(7)} ${String(jsonLd(html)).padStart(4)} ${String(offres.length).padStart(5)} ${String(propres.length).padStart(5)}  ${ex}`);
}
process.stdout.write('\nJSON:' + JSON.stringify(resultats) + '\n');
