/**
 * Le lecteur jette des cartes POURTANT valides (22 %, 58 %, 44 %…). Où ?
 * Il exige un titre ET un lien : `c.title` et `c.url`. Si la France nomme le
 * lien autrement, toutes les cartes sont écartées en silence. On compare donc
 * les CLÉS d'une carte française à celles d'une carte belge qui, elle, passe.
 */
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const page = (u) => execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA,
  '-H', 'Accept-Language: fr,en;q=0.8', u], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const premiere = (url) => {
  const html = page(url);
  const bloc = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!bloc) return null;
  const data = JSON.parse(bloc[1]);
  let c = null;
  (function p(o) {
    if (c || !o || typeof o !== 'object') return;
    if (o.__typename === 'StandardDealCard') { c = o; return; }
    for (const v of Object.values(o)) p(v);
  })(data);
  return c;
};

for (const [pays, url] of [
  ['BE (passe)', 'https://www.groupon.be/fr/landing/sale'],
  ['FR (jetée)', 'https://www.groupon.fr/bon-plan'],
]) {
  const c = premiere(url);
  if (!c) { console.log(`${pays} : pas de carte`); continue; }
  const clefs = Object.keys(c);
  const liens = clefs.filter((k) => /url|lien|link|slug|seo|web|path/i.test(k));
  console.log(`\n=== ${pays}`);
  console.log('  clés du lien :', liens.map((k) => `${k}=${JSON.stringify(c[k]).slice(0, 60)}`).join('  |  ') || 'AUCUNE');
  console.log('  a "url" ?', Object.prototype.hasOwnProperty.call(c, 'url'), '| a "title" ?', Object.prototype.hasOwnProperty.call(c, 'title'));
  console.log('  toutes les clés :', clefs.join(', '));
}
