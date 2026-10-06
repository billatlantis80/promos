/**
 * Le rattachement « pays de la boutique » changerait-il quelque chose ?
 *
 * On construit la table marchand → pays à partir des données, puis on compte
 * combien d'offres changeraient de pays. Réponse possible : aucune.
 *   node outils/test-rattachement-pays.mjs
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
  ;({ MARCHANDS_NON_BOUTIQUE, REDACTIONS })`, ctx);

// Table : marchand → ensemble des pays où on l'a vu.
const table = {};
for (const o of offres) {
  const m = String(o.marchand || '').trim();
  if (!m) continue;
  (table[m] = table[m] || new Set()).add(o.pays || 'FR');
}

let change = 0;
let mono = 0;
const exemples = [];
for (const o of offres) {
  const m = String(o.marchand || '').trim();
  const pays = table[m];
  if (!pays || pays.size !== 1) continue;        // multi-pays : non rattachable
  mono += 1;
  const unique = [...pays][0];
  if ((o.pays || 'FR') !== unique) {             // changerait de pays
    change += 1;
    if (exemples.length < 10) exemples.push(`${m} : ${o.pays} → ${unique} · ${String(o.titre).slice(0, 50)}`);
  }
}
console.log(`Offres dont le marchand est mono-pays : ${mono} / ${offres.length}`);
console.log(`Offres qui CHANGERAIENT de pays si on rattachait à la boutique : ${change}`);
for (const e of exemples) console.log(`   ${e}`);
console.log('');
console.log('Boutiques multi-pays (donc NON rattachables sans deviner) :');
const multi = Object.entries(table).filter(([, p]) => p.size > 1 && offres.filter((o) => o.marchand === '') .length >= 0);
const gros = Object.entries(table)
  .map(([m, p]) => [m, p.size, offres.filter((o) => o.marchand === m).length])
  .filter(([, taille, n]) => taille > 1 && n >= 10)
  .sort((a, b) => b[2] - a[2]);
for (const [m, taille, n] of gros.slice(0, 15)) console.log(`   ${String(n).padStart(5)} offres · ${taille} pays · ${m}`);
console.log('');
// Cas belge : quel marchand NOMMÉ est rattaché à BE, et par quelle source ?
const be = {};
for (const o of offres) {
  if ((o.pays || 'FR') !== 'BE') continue;
  const m = String(o.marchand || '').trim();
  if (!m || R.MARCHANDS_NON_BOUTIQUE.test(m) || R.REDACTIONS.test(m)) continue;
  be[m] = be[m] || { n: 0, prix: 0, chaud: 0 };
  be[m].n += 1;
  if (o.prix != null) be[m].prix += 1;
  if (o.temperature >= 100) be[m].chaud += 1;
}
console.log('Marchands nommés déjà rattachés à la Belgique :');
for (const [m, e] of Object.entries(be).sort((a, b) => b[1].n - a[1].n).slice(0, 20)) {
  console.log(`   ${String(e.n).padStart(3)} offres · ${e.prix} avec prix · ${e.chaud} chaudes · ${m}`);
}
