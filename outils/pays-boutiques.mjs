/**
 * Quelles boutiques sont rattachables à UN pays ?
 * On croise chaque marchand avec les pays des sources qui le relaient.
 *   node outils/pays-boutiques.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estBonnePromo, estBonneAffaire, MARCHANDS_NON_BOUTIQUE, REDACTIONS })`, ctx);

const parMarchand = {};
for (const o of offres) {
  const m = String(o.marchand || '').trim();
  if (!m || R.MARCHANDS_NON_BOUTIQUE.test(m) || R.REDACTIONS.test(m)) continue;
  const e = (parMarchand[m] = parMarchand[m] || { n: 0, pays: new Set(), sansPrix: 0, chaud: 0 });
  e.n += 1;
  e.pays.add(o.pays || 'FR');
  if (o.prix == null) e.sansPrix += 1;
  if (o.temperature >= 100) e.chaud += 1;
}

const mono = [];
const multi = [];
for (const [m, e] of Object.entries(parMarchand)) {
  if (e.n < 2) continue;
  (e.pays.size === 1 ? mono : multi).push([m, e]);
}
console.log(`Marchands vus : ${Object.keys(parMarchand).length} · mono-pays : ${mono.length} · multi-pays : ${multi.length}`);
console.log('');
console.log('=== MONO-PAYS (rattachables sans risque), les plus fournis ===');
for (const [m, e] of mono.sort((a, b) => b[1].n - a[1].n).slice(0, 40)) {
  console.log(`   ${String(e.n).padStart(5)} offres · sans prix ${String(e.sansPrix).padStart(4)} · <>100° ${String(e.chaud).padStart(4)} · [${[...e.pays]}] ${m}`);
}
console.log('');
console.log('=== MULTI-PAYS (à NE PAS rattacher : on garderait le pays de la source) ===');
for (const [m, e] of multi.sort((a, b) => b[1].n - a[1].n).slice(0, 20)) {
  console.log(`   ${String(e.n).padStart(5)} · [${[...e.pays].join(',')}] ${m}`);
}
console.log('');
const be = Object.entries(parMarchand).filter(([, e]) => e.pays.size === 1 && e.pays.has('BE'));
console.log(`Marchands rattachables à la BELGIQUE : ${be.length}`);
for (const [m, e] of be.sort((a, b) => b[1].n - a[1].n).slice(0, 30)) {
  console.log(`   ${String(e.n).padStart(4)} offres · sans prix ${e.sansPrix} · <>100° ${e.chaud} · ${m}`);
}
