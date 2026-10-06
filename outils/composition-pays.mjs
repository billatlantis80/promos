/** Composition du mélange pour UN pays — ce que verra un habitant de ce pays. */
import fs from 'node:fs';
import vm from 'node:vm';

const paysVoulu = process.argv[2] || 'BE';
const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const d = js.indexOf('const REMISE_MIN');
const f = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(d, f)}
  ;({ estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonneAffaire, estBonnePromo, dedoublonner, melanger })`, ctx);

const cmp = (a, b) => (R.estPromoVerifiee(b) ? 1 : 0) - (R.estPromoVerifiee(a) ? 1 : 0)
  || (b.remise || 0) - (a.remise || 0) || (b.temperature || 0) - (a.temperature || 0);

const du = offres.filter((o) => (o.pays || 'FR') === paysVoulu && R.estBonnePromo(o));
const melange = R.melanger(R.dedoublonner(du), cmp);
const nAmz = melange.filter(R.estAmazon).length;
const autres = melange.filter((o) => !R.estAmazon(o));
const cat = (o) => (R.estPromoVerifiee(o) ? 'promo à deux prix (remise CALCULÉE)'
  : (R.estOffreEnseigne(o) ? 'enseigne — prix réel affiché'
    : (R.estBonPlanPresse(o) ? 'presse — article chiffré' : 'bonne affaire — AUCUN prix')));
const c = {};
for (const o of autres) c[cat(o)] = (c[cat(o)] || 0) + 1;

console.log(`${paysVoulu} — ${melange.length} lignes affichées (sur ${du.length} retenues avant mélange)`);
console.log(`   ${nAmz} Amazon (${(nAmz / melange.length * 100).toFixed(0)} %) · ${autres.length} autres (${(autres.length / melange.length * 100).toFixed(0)} %)`);
console.log('');
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(4)}  ${k}`);
console.log('');
console.log('marchands non-Amazon visibles :');
const m = {};
for (const o of autres) m[o.marchand] = (m[o.marchand] || 0) + 1;
for (const [k, v] of Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`   ${String(v).padStart(4)} ${k}`);
console.log('');
const aff = autres.filter(R.estBonneAffaire);
if (aff.length) {
  console.log('bonnes affaires (aucun prix affiché) :');
  for (const o of aff.slice(0, 10)) console.log(`   ${o.marchand} — ${o.temperature}° — ${String(o.titre).slice(0, 58)}`);
} else {
  console.log('bonnes affaires : AUCUNE pour ce pays.');
}
