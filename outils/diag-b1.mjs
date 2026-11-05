/**
 * DIAGNOSTIC B1 — pourquoi la page française rend 0 offre alors qu'elle en
 * contient.
 *
 * Ce que l'on savait avant : `offresGroupon()` tire 0 offre de
 * `groupon.fr/bon-plan`, alors que la page contient 5 remises valides.
 * Ce que l'on ne savait pas : la PAGE existe en DEUX rendus différents, servis
 * au hasard par le même domaine.
 *
 *   · rendu « Next.js »     → <script id="__NEXT_DATA__">, JSON valide,
 *                             lisible par `offresGroupon()`
 *   · rendu « TanStack »    → <script class="$tsr"> et hydratation
 *                             `Object.assign(Object.create(null),{…})` avec
 *                             des références `$R[n]` : ce n'est PAS du JSON,
 *                             et il n'y a AUCUN `__NEXT_DATA__`.
 *
 * Le lecteur ne connaît que le premier : à la ligne « if (!bloc) return out; »
 * il jette la page entière, donc les 9 cartes, sans le dire. C'est la ligne
 * qui « jette les cartes ».
 *
 * Usage : node outils/diag-b1.mjs [relevés par site]
 * Politesse : 3 s entre deux requêtes vers un même domaine.
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresGroupon, remiseCredibleSource } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = Number(process.argv[2] || 4);

const SITES = [
  ['FR', 'Groupon', 'https://www.groupon.fr/bon-plan'],
  ['BE', 'Groupon', 'https://www.groupon.be/fr/landing/sale'],
];

function lire(url, langue = 'fr-BE,fr;q=0.9') {
  // EXACTEMENT l'appel du collecteur (lireParCurl) : mêmes drapeaux, mêmes
  // en-têtes. Sinon on mesurerait un autre client que celui de production.
  return execFileSync('curl', [
    '-fsS', '-L', '--compressed', '--max-time', '25',
    '-A', UA, '-H', `Accept-Language: ${langue}`, url,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const centimes = (o) => (o && Number.isFinite(o.amount) ? Math.round(o.amount) / 100 : null);

/** Rejoue `offresGroupon` carte par carte et dit, POUR CHACUNE, où elle tombe. */
function detailCartes(html) {
  const bloc = String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!bloc) return null;
  let data;
  try { data = JSON.parse(bloc[1]); } catch { return 'JSON illisible'; }
  const cartes = [];
  (function p(o) {
    if (!o || typeof o !== 'object') return;
    if (o.__typename === 'StandardDealCard') cartes.push(o);
    for (const v of Object.values(o)) p(v);
  })(data);
  return cartes.map((c) => {
    const prix = centimes(c.prices && c.prices.price);
    const avant = centimes(c.prices && c.prices.strikeThroughPrice);
    const ok = remiseCredibleSource(prix, avant);
    const pct = ok ? Math.round(((avant - prix) / avant) * 100) : null;
    const motif = ok ? null
      : (avant == null ? 'l.2697 : aucun prix de référence'
        : (avant <= prix ? 'l.2697 : référence ≤ prix'
          : (avant >= prix * 5 ? `l.2697 : référence ≥ 5× le prix (${avant}/${prix})`
            : 'l.2698 : remise hors [15 % ; 90 %]')));
    return { titre: String(c.title || '').slice(0, 46), prix, avant, pct, motif };
  });
}

for (const [pays, nom, url] of SITES) {
  console.log(`\n=== ${pays} — ${url} ===`);
  const source = { id: `diag-${pays}`, nom, type: 'groupon', pays, langue: 'fr', categorieImposee: 'activite', url };
  let tous = null;
  for (let i = 1; i <= N; i++) {
    let html;
    try { html = lire(url); } catch (e) {
      console.log(`  relevé ${i} : ERREUR curl — ${String(e.message).split('\n')[0].slice(0, 70)}`);
      await dormir(3000); continue;
    }
    const nextdata = /<script id="__NEXT_DATA__"/.test(html);
    const tsr = /class="\$tsr"/.test(html) || /\$tsr-stream-barrier/.test(html);
    const rendu = (html.match(/data-renderer="([^"]+)"/) || [])[1] || 'next';
    const cartesNext = (html.match(/__typename:"StandardDealCard"/g) || []).length
      + (html.match(/"__typename":"StandardDealCard"/g) || []).length;
    const offres = offresGroupon(html, source);
    console.log(`  relevé ${i} : rendu=${rendu.padEnd(7)} __NEXT_DATA__=${nextdata ? 'OUI' : 'non'} $tsr=${tsr ? 'OUI' : 'non'} `
      + `cartes=${String(cartesNext).padStart(2)} octets=${html.length} → offresGroupon=${offres.length}`);
    if (nextdata) tous = detailCartes(html);
    await dormir(3000);
  }
  if (tous) {
    console.log('  détail des cartes du relevé Next.js (où chacune tombe) :');
    for (const c of tous) {
      console.log(`    ${c.motif ? '✗ ' + c.motif.padEnd(42) : '✓ retenue ' + String(c.pct).padStart(3) + '%'.padEnd(6)}` + `  ${c.titre}`);
    }
  }
}
