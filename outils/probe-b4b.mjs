/**
 * SONDE B4-b — pages de PROMOTION (pas les accueils). Passe 1 a montré que
 * les racines de domaine ne portent aucun produit lisible ; on vise donc les
 * pages « offres / acties / Angebote / promocje / deals » des enseignes, plus
 * quelques flux publics. Lecteur réel `offresEnseigne`, deux prix réels.
 *
 * Usage : node outils/probe-b4b.mjs
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresEnseigne } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// [pays, nom, url, langue]
const CANDIDATS = [
  ['--', 'NEG-inexistant', 'https://www.inexistant-b4b-xyzzy.example/offres', 'fr'],
  ['BE', 'POS-coolblue-be', 'https://www.coolblue.be/fr/offres', 'fr'],
  // Coolblue : le motif JSON-LD qui MARCHE en BE, rejoué dans ses autres pays.
  ['NL', 'coolblue.nl', 'https://www.coolblue.nl/aanbiedingen', 'nl'],
  ['DE', 'coolblue.de', 'https://www.coolblue.de/angebote', 'de'],
  ['FR', 'coolblue.fr', 'https://www.coolblue.fr/offres', 'fr'],
  // Électro / high-tech, pages de promo
  ['BE', 'vandenborre.be', 'https://www.vandenborre.be/fr/promotions', 'fr'],
  ['BE', 'krefel.be', 'https://www.krefel.be/fr/promotions', 'fr'],
  ['NL', 'mediamarkt.nl', 'https://www.mediamarkt.nl/nl/shop/aanbiedingen.html', 'nl'],
  ['DE', 'mediamarkt.de', 'https://www.mediamarkt.de/de/shop/angebote.html', 'de'],
  ['AT', 'mediamarkt.at', 'https://www.mediamarkt.at/de/shop/angebote.html', 'de'],
  ['PL', 'mediamarkt.pl', 'https://www.mediamarkt.pl/promocje', 'pl'],
  ['FR', 'fnac.com', 'https://www.fnac.com/promotions', 'fr'],
  ['FR', 'boulanger.com', 'https://www.boulanger.com/promos', 'fr'],
  ['FR', 'cdiscount.com', 'https://www.cdiscount.com/promos.html', 'fr'],
  ['PL', 'x-kom.pl', 'https://www.x-kom.pl/promocje', 'pl'],
  ['PL', 'morele.net', 'https://www.morele.net/promocje/', 'pl'],
  ['IT', 'mediaworld.it', 'https://www.mediaworld.it/promozioni', 'it'],
  ['IT', 'unieuro.it', 'https://www.unieuro.it/online/promozioni', 'it'],
  ['PT', 'worten.pt', 'https://www.worten.pt/promocoes', 'pt'],
  ['SE', 'elgiganten.se', 'https://www.elgiganten.se/erbjudanden', 'sv'],
  ['GB', 'currys.co.uk', 'https://www.currys.co.uk/deals', 'en'],
  ['GB', 'ao.com', 'https://ao.com/l/offers', 'en'],
  ['IE', 'harveynorman.ie', 'https://www.harveynorman.ie/sale', 'en'],
  // Meubles
  ['BE', 'jysk.be', 'https://jysk.be/fr/offres', 'fr'],
  ['DE', 'jysk.de', 'https://jysk.de/angebote', 'de'],
  ['NL', 'jysk.nl', 'https://jysk.nl/aanbiedingen', 'nl'],
  ['FR', 'jysk.fr', 'https://jysk.fr/promotions', 'fr'],
  ['PL', 'jysk.pl', 'https://jysk.pl/promocje', 'pl'],
  ['SE', 'jysk.se', 'https://jysk.se/erbjudanden', 'sv'],
  ['NL', 'leenbakker.nl', 'https://www.leenbakker.nl/aanbiedingen', 'nl'],
  ['FR', 'maisonsdumonde.com', 'https://www.maisonsdumonde.com/FR/fr/promotions', 'fr'],
  // Animaux (animaleries)
  ['BE', 'zooplus.be', 'https://www.zooplus.be/deals', 'fr'],
  ['NL', 'zooplus.nl', 'https://www.zooplus.nl/deals', 'nl'],
  ['DE', 'zooplus.de', 'https://www.zooplus.de/deals', 'de'],
  ['FR', 'zooplus.fr', 'https://www.zooplus.fr/deals', 'fr'],
  ['ES', 'zooplus.es', 'https://www.zooplus.es/deals', 'es'],
  ['IT', 'zooplus.it', 'https://www.zooplus.it/deals', 'it'],
  ['PL', 'zooplus.pl', 'https://www.zooplus.pl/deals', 'pl'],
  ['SE', 'zooplus.se', 'https://www.zooplus.se/deals', 'sv'],
  ['BE', 'bitiba.be', 'https://www.bitiba.be/', 'fr'],
  ['DE', 'fressnapf.de', 'https://www.fressnapf.de/angebote', 'de'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-fsS', '-L', '--compressed', '--max-time', '15', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch { return ''; }
}

const source = (pays, nom, url, langue) => ({ id: `b4b-${pays}-${nom}`, nom, type: 'enseigne', pays, langue, url });
const jsonLd = (html) => (html.match(/application\/ld\+json/gi) || []).length;
const prixDevise = (html) => (html.match(/\d{1,4}(?:[.,]\d{2})?\s?(?:€|EUR|zł|kr|£)/g) || []).length;
const marqueurs2 = (html) => (html.match(/original-price|listPrice|highPrice|priceSpecification|statt|au lieu|"was"|avant|oldPrice/gi) || []).length;

console.log('pays  nom                 octets    ld   prix  marq2  lues  2prix  exemple');
const resultats = [];
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  const offres = html ? offresEnseigne(html, source(pays, nom, url, langue)) : [];
  await dormir(1200);
  const propres = offres.filter((o) => o.remise != null && o.remise >= 15 && o.remise <= 90);
  const ex = propres[0] ? `${propres[0].remise}% ${propres[0].titre.slice(0, 42)}`
    : (offres[0] ? `(1 prix) ${offres[0].titre.slice(0, 36)}` : '—');
  resultats.push({ pays, nom, url, langue, n1: propres.length, lues: offres.length, octets: html.length });
  console.log(`${pays.padEnd(5)} ${nom.padEnd(19)} ${String(html.length).padStart(7)} ${String(jsonLd(html)).padStart(4)} ` +
    `${String(prixDevise(html)).padStart(5)} ${String(marqueurs2(html)).padStart(5)} ${String(offres.length).padStart(5)} ${String(propres.length).padStart(5)}  ${ex}`);
}
process.stdout.write('\nJSON:' + JSON.stringify(resultats) + '\n');
