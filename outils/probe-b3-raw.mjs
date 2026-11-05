/**
 * SONDE B3-bis — les prix sont-ils SEULEMENT absents du JSON-LD, ou absents
 * de la page entière ? Distingue « lecteur inadapté » de « site illisible ».
 *
 * Pour chaque page : compte les prix en devise, les marqueurs de « au lieu de »,
 * et détecte les charges lisibles sans JS (__NEXT_DATA__, __NUXT__, Nuxt, JSON).
 * Contrôle négatif inclus.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const CANDIDATS = [
  ['--', 'NEG', 'https://www.inexistant-b3-xyzzy-test.example/x', 'fr'],
  ['NL', 'actievandedag.nl', 'https://www.actievandedag.nl/', 'nl'],
  ['NL', 'socialdeal.nl', 'https://www.socialdeal.nl/', 'nl'],
  ['GB', 'wowcher.co.uk', 'https://www.wowcher.co.uk/', 'en'],
  ['GB', 'travelzoo.com', 'https://www.travelzoo.com/uk/', 'en'],
  ['ES', 'letsbonus.com', 'https://www.letsbonus.com/', 'es'],
  ['ES', 'atrapalo.com', 'https://www.atrapalo.com/', 'es'],
  ['FR', 'wonderbox.fr', 'https://www.wonderbox.fr/', 'fr'],
  ['FR', 'billetreduc.com', 'https://www.billetreduc.com/', 'fr'],
  ['FR', 'veepee.fr', 'https://www.veepee.fr/', 'fr'],
  ['IT', 'groupalia.it', 'https://www.groupalia.it/', 'it'],
  ['BE', 'bongo.be', 'https://www.bongo.be/', 'fr'],
  ['DE', 'keeplearning?', 'https://www.dealabs.de/', 'de'],
];

function page(url, langue) {
  try {
    return execFileSync('curl', ['-sL', '--max-time', '20', '-A', UA,
      '-H', `Accept-Language: ${langue},en;q=0.8`, url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return ''; }
}

const compte = (s, re) => (String(s).match(re) || []).length;

console.log('pays  plateforme            octets   prix€  au-lieu  next  nuxt  api  json+ld');
for (const [pays, nom, url, langue] of CANDIDATS) {
  const html = page(url, langue);
  await dormir(1200);
  const prix = compte(html, /(?:\d{1,4}[.,]\d{2})\s?(?:€|£|EUR|GBP)|(?:€|£)\s?\d{1,4}/gi);
  const auLieu = compte(html, /au lieu de|instead of|en vez de|in plaats van|statt\b|van €|desde €|régulier|rabatt|% off|-?\d{1,2}\s?%/gi);
  const next = /__NEXT_DATA__/.test(html) ? 'oui' : '-';
  const nuxt = /__NUXT__|window\.__NUXT/.test(html) ? 'oui' : '-';
  const api = /\/api\/|\/graphql|\.json\?/.test(html) ? 'oui' : '-';
  const ld = compte(html, /application\/ld\+json/gi);
  console.log(`${pays.padEnd(5)} ${nom.padEnd(20)} ${String(html.length).padStart(7)} ${String(prix).padStart(6)} ${String(auLieu).padStart(7)}  ${next.padEnd(4)} ${nuxt.padEnd(4)} ${api.padEnd(4)} ${ld}`);
}
