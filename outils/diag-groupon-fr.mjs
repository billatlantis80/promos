/**
 * On rejoue EXACTEMENT les étapes de `offresGroupon` sur la page française et
 * on imprime, carte par carte, où chacune s'arrête. Sans cela on devine ; avec
 * cela on sait.
 */
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const html = execFileSync('curl', ['-sL', '--max-time', '25', '-A', UA,
  '-H', 'Accept-Language: fr,en;q=0.8', 'https://www.groupon.fr/bon-plan'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const bloc = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
const data = JSON.parse(bloc[1]);
const cartes = [];
(function p(o) {
  if (!o || typeof o !== 'object') return;
  if (o.__typename === 'StandardDealCard') cartes.push(o);
  for (const v of Object.values(o)) p(v);
})(data);

const centimes = (o) => (o && Number.isFinite(o.amount) ? Math.round(o.amount) / 100 : null);

console.log('cartes StandardDealCard :', cartes.length);
for (const c of cartes.slice(0, 12)) {
  const p = centimes(c.prices && c.prices.price);
  const a = centimes(c.prices && c.prices.strikeThroughPrice);
  const ref = (a != null && p != null && p > 0 && a > p && a < p * 5) ? a : null;
  const pct = ref ? Math.round(((ref - p) / ref) * 100) : null;
  console.log(
    `  prix=${String(p).padStart(6)}  avant=${String(a).padStart(6)}  remise=${String(pct).padStart(4)}%  `
    + `amountBrut(prix)=${JSON.stringify(c.prices?.price?.amount)}  amountBrut(avant)=${JSON.stringify(c.prices?.strikeThroughPrice?.amount)}  `
    + `${String(c.title || '').slice(0, 40)}`,
  );
}
