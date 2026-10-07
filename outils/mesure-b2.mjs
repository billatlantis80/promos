/**
 * MESURE B2 — stabilité de la lecture Groupon, pays par pays.
 *
 * B1 a trouvé la cause du « 9 puis 0 » : la page est servie en deux RENDUS
 * (Next `__NEXT_DATA__` / TanStack `$tsr`), tirés au hasard par le même domaine.
 * B2 ajoute le second lecteur. Ce que l'on mesure ici :
 *
 *   1. pour CHAQUE pays à catalogue Groupon propre, DEUX relevés espacés ;
 *   2. le rendu servi à chaque relevé (next / tanstack) ;
 *   3. le nombre de cartes trouvées et d'offres retenues (le lecteur rend-il
 *      la même chose quand le rendu change ?) ;
 *   4. si les deux relevés rendent les MÊMES offres (titre + remise).
 *
 * Ce qui est mesuré est ce que la PRODUCTION lit : même `curl`, mêmes drapeaux
 * que `lireParCurl`. Politesse : 3 s entre deux requêtes d'un même domaine.
 *
 * Usage : node outils/mesure-b2.mjs [relevés par pays]
 */
import { execFileSync } from 'node:child_process';
import { setTimeout as dormir } from 'node:timers/promises';
import { offresGroupon } from '../collecteur.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const N = Number(process.argv[2] || 2);

// URL de catalogue PROPRE par pays (PLAN-NUIT §3). at/se → de et pt → es sont
// EXCLUS : ils redirigent, leur attribuer des offres serait faux.
const SITES = [
  ['BE', 'fr', 'https://www.groupon.be/fr/landing/sale'],
  ['FR', 'fr', 'https://www.groupon.fr/bon-plan'],
  ['DE', 'de', 'https://www.groupon.de/gutscheine'],
  ['NL', 'nl', 'https://www.groupon.nl/'],
  ['IT', 'it', 'https://www.groupon.it/offerte'],
  ['ES', 'es', 'https://www.groupon.es/ofertas'],
  ['PL', 'pl', 'https://www.groupon.pl/oferta'],
  ['GB', 'en', 'https://www.groupon.co.uk/vouchers'],
  ['IE', 'en', 'https://www.groupon.ie/vouchers'],
];

function lire(url, langue) {
  return execFileSync('curl', [
    '-fsS', '-L', '--compressed', '--max-time', '25',
    '-A', UA, '-H', `Accept-Language: ${langue}`,
    url,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const signature = (offres) => offres
  .map((o) => `${o.titre.slice(0, 40)}|${o.remise}|${o.prix}/${o.prixAvant}`)
  .sort().join('\n');

let totalPays = 0, paysStables = 0, paysMuets = 0;
for (const [pays, langue, url] of SITES) {
  console.log(`\n=== ${pays} — ${url} ===`);
  const source = { id: `mesure-${pays}`, nom: 'Groupon', type: 'groupon', pays, langue, categorieImposee: 'activite', url };
  const relevés = [];
  for (let i = 1; i <= N; i++) {
    let html;
    try { html = lire(url, `${langue}-${pays},${langue};q=0.9`); }
    catch (e) { console.log(`  relevé ${i} : ERREUR curl — ${String(e.message).split('\n')[0].slice(0, 70)}`); await dormir(3000); continue; }
    const rendu = (html.match(/data-renderer="([^"]+)"/) || [])[1] || 'next';
    const nextdata = /<script id="__NEXT_DATA__"/.test(html);
    const cartes = (html.match(/StandardDealCard"/g) || []).length;
    const offres = offresGroupon(html, source);
    relevés.push(offres);
    console.log(`  relevé ${i} : rendu=${rendu.padEnd(8)} NEXT=${nextdata ? 'oui' : 'non'} cartes~${String(cartes).padStart(3)} → offres=${String(offres.length).padStart(3)}`);
    await dormir(3000);
  }
  if (relevés.length >= 2) {
    totalPays++;
    const [a, b] = [signature(relevés[0]), signature(relevés[relevés.length - 1])];
    const identique = a === b;
    if (identique) paysStables++;
    if (relevés.every((r) => r.length === 0)) paysMuets++;
    console.log(`  → ${relevés.length} relevés, ${identique ? 'OFFRES IDENTIQUES ✔' : 'offres DIFFÉRENTES'}`);
    if (!identique) {
      const ta = new Set(relevés[0].map((o) => o.titre));
      const tb = new Set(relevés[relevés.length - 1].map((o) => o.titre));
      const comm = [...ta].filter((t) => tb.has(t)).length;
      console.log(`     titres en commun : ${comm} ; seulement relevé 1 : ${ta.size - comm} ; seulement dernier : ${tb.size - comm}`);
    }
  }
}
console.log(`\nBILAN : ${paysStables}/${totalPays} pays à deux relevés identiques ; ${paysMuets} pays muets (0 offre aux deux relevés).`);
