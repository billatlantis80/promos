/**
 * Forme EXACTE du bloc `prices` : Belgique (qui marche) contre France et
 * Allemagne (qui rendent 0). On imprime le JSON entier — tronqué, on avait
 * déjà failli conclure à tort.
 */
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const page = (u) => execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA,
  '-H', 'Accept-Language: fr,en;q=0.8', u], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const extraire = (html) => {
  const bloc = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  return bloc ? JSON.parse(bloc[1]) : null;
};

for (const [pays, url] of [
  ['BE (marche)', 'https://www.groupon.be/fr/landing/sale'],
  ['FR (0 offre)', 'https://www.groupon.fr/bon-plan'],
  ['DE (0 offre)', 'https://www.groupon.de/gutscheine'],
]) {
  let data; try { data = extraire(page(url)); } catch (e) { console.log(pays, 'JSON KO', e.message); continue; }
  if (!data) { console.log(`${pays} : pas de __NEXT_DATA__`); continue; }
  let carte = null;
  (function p(o) {
    if (carte || !o || typeof o !== 'object') return;
    if (o.__typename === 'StandardDealCard') { carte = o; return; }
    for (const v of Object.values(o)) p(v);
  })(data);
  console.log(`\n===== ${pays}`);
  console.log('titre  :', JSON.stringify(carte && carte.title));
  console.log('prices :', JSON.stringify(carte && carte.prices));
  // Le champ `amount` est-il présent quelque part ?
  const s = JSON.stringify(carte && carte.prices || {});
  console.log('contient "amount" ?', s.includes('amount'), '| contient "strikeThroughPrice" ?', s.includes('strikeThroughPrice'));
}
