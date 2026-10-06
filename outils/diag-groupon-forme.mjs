/**
 * Pourquoi FR, DE, IT et IE rendent 0 offre alors que leurs pages contiennent
 * des `StandardDealCard` et des `strikeThroughPrice` ?
 *
 * On regarde la FORME réelle des données, pas nos hypothèses : quels
 * `__typename` de carte existent, et à quoi ressemble le bloc `prices` d'une
 * carte sur ces pages-là.
 */
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const page = (u) => {
  try { return execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA, u], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return ''; }
};

for (const [pays, url] of [
  ['FR', 'https://www.groupon.fr/bon-plan'],
  ['DE', 'https://www.groupon.de/gutscheine'],
  ['IT', 'https://www.groupon.it/offerte'],
  ['IE', 'https://www.groupon.ie/vouchers'],
  ['NL', 'https://www.groupon.nl/'],          // référence qui MARCHE
]) {
  const html = page(url);
  const bloc = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!bloc) { console.log(`${pays} : PAS de __NEXT_DATA__`); continue; }
  let data; try { data = JSON.parse(bloc[1]); } catch (e) { console.log(`${pays} : JSON invalide (${e.message})`); continue; }

  // Quels types de carte existent ?
  const types = new Map();
  const exemples = [];
  (function p(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.__typename === 'string' && /card|deal/i.test(o.__typename)) {
      types.set(o.__typename, (types.get(o.__typename) || 0) + 1);
      if (o.prices && exemples.length < 2) exemples.push(o);
    }
    for (const v of Object.values(o)) p(v);
  })(data);

  console.log(`\n=== ${pays}  ${url}`);
  console.log('   types de carte :', [...types].map(([t, n]) => `${t}×${n}`).join(', ') || 'aucun');
  for (const ex of exemples) console.log('   prices :', JSON.stringify(ex.prices).slice(0, 200));
}
