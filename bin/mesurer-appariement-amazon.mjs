/* MESURE DE L'APPARIEMENT AMAZON MULTI-PLACES — avant et après la règle.
 *
 * Question posée : le test attend 200 produits présents sur plusieurs places et
 * en trouve 139. Est-ce une RÉGRESSION de l'appariement, ou le seuil est-il
 * simplement trop haut pour un catalogue devenu deux fois plus petit ?
 *
 * On mesure donc EXACTEMENT ce que le test mesure, avec le même code extrait de
 * app.js (jamais une recopie), sur deux catalogues :
 *   • celui d'AUJOURD'HUI (docs/offres.json) ;
 *   • celui d'AVANT la règle des cinq jours, que git garde (commit 9226ca06).
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const app = fs.readFileSync('public/app.js', 'utf8');
const debut = app.indexOf('const DEVISE_PAR_PAYS = {');
const fin = app.indexOf('function ilYA(');
const extrait = app.slice(debut, fin);
const M = await import('data:text/javascript;base64,' + Buffer.from(
  extrait + '\nexport { deviseDe, indexerProduits, autresPlaces, asinDe, placeAmazon, nomPlace, estPlaceAmazon, lienDe };'
).toString('base64'));
const { indexerProduits, asinDe, placeAmazon, estPlaceAmazon, lienDe } = M;

const AVANT = '9226ca06';

function analyse(nom, offres) {
  const idx = indexerProduits(offres);
  let groupes = 0, lignes = 0;
  const tailles = {};
  for (const [, l] of idx) {
    const places = new Set(l.map((o) => placeAmazon(o)).filter(Boolean));
    if (places.size > 1) { groupes++; lignes += l.length; tailles[places.size] = (tailles[places.size] || 0) + 1; }
  }
  // Le diagnostic : ce qui EMPÊCHE l'appariement, chiffre par chiffre.
  const amazon = offres.filter((o) => estPlaceAmazon(o));
  const asin = amazon.filter((o) => asinDe(o));
  console.log(`\n=== ${nom} ===`);
  console.log(`  offres au total          : ${offres.length}`);
  console.log(`  offres Amazon (place)    : ${amazon.length}`);
  console.log(`  dont ASIN lisible        : ${asin.length}  (illisible : ${amazon.length - asin.length})`);
  console.log(`  ASIN distincts           : ${idx.size}`);
  console.log(`  GROUPES multi-places     : ${groupes}   (lignes concernées : ${lignes})`);
  console.log(`  répartition par nb de places : ${JSON.stringify(tailles)}`);
  return { amazon, asin, idx, groupes };
}

const auj = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8')).offres;
const avant = JSON.parse(execSync(`git show ${AVANT}:docs/offres.json`, { maxBuffer: 400 * 1024 * 1024 })).offres;

const R1 = analyse("AUJOURD'HUI (après la règle des cinq jours)", auj);
analyse(`AVANT LA RÈGLE (commit ${AVANT})`, avant);

// --- LE DIAGNOSTIC QUI DÉCIDE : pourquoi un lien Amazon ne donne-t-il pas d'ASIN ?
const sansAsin = R1.amazon.filter((o) => !asinDe(o));
const motifs = {};
for (const o of sansAsin) {
  const u = String(lienDe(o)).replace(/^https?:\/\/(?:www\.)?/i, '');
  const motif = u.match(/^amazon\.[a-z.]{2,7}\/[^/?#]*/i) ? u.replace(/^amazon\.[a-z.]{2,7}/i, '').split(/[/?#]/).slice(0, 2).join('/') : '(forme inattendue)';
  motifs[motif] = (motifs[motif] || 0) + 1;
}
console.log(`\n--- LIENS AMAZON SANS ASIN (${sansAsin.length}) : d'où vient la perte ---`);
for (const [m, n] of Object.entries(motifs).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${n.toString().padStart(5)}  ${m}`);
console.log('\n  exemples :');
for (const o of sansAsin.slice(0, 5)) console.log(`   · ${lienDe(o)}`);
