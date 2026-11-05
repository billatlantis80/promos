/**
 * Mesure du mélange 60/40 sur les données RÉELLES.
 *
 * On réutilise les fonctions de app.js (extraction du même bloc que les tests),
 * pour que le chiffre annoncé soit produit par le code qui affiche — pas par
 * une réécriture qui pourrait diverger.
 *
 *   node outils/mesure-melange.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';

const js = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const debut = js.indexOf('const REMISE_MIN');
const fin = js.indexOf('/** Combien de bonnes promotions par pays');
const ctx = vm.createContext({});
const R = vm.runInContext(`${js.slice(debut, fin)}
  ;({ estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonnePromo, dedoublonner, melanger })`, ctx);

const brut = JSON.parse(fs.readFileSync(new URL('../docs/offres.json', import.meta.url), 'utf8'));
const offres = Array.isArray(brut) ? brut : brut.offres;
const pays = (o) => o.pays || 'FR';

// PAS de dédoublonnage global ici : l'application dédoublonne APRÈS avoir
// découpé par pays (voir offresDuPays). Dédoublonner avant faisait disparaître
// les Amazon espagnols, réclamés plus tôt par le Portugal — qui partage
// amazon.es, donc les mêmes titres. L'outil mesurait alors un 0 % Amazon en
// Espagne que l'application n'a jamais produit.
const bonnes = offres.filter(R.estBonnePromo);
const verifiees = bonnes.filter(R.estPromoVerifiee);
const enseignes = bonnes.filter((o) => R.estOffreEnseigne(o) && !R.estPromoVerifiee(o));
const presse = bonnes.filter((o) => R.estBonPlanPresse(o) && !R.estPromoVerifiee(o) && !R.estOffreEnseigne(o));

const melange = R.melanger(R.dedoublonner(bonnes));
const nAmz = melange.filter(R.estAmazon).length;

console.log(`Catalogue : ${offres.length} offres`);
console.log(`Bonnes promos (étage 1 + étage 2) : ${bonnes.length}`);
console.log(`  dont promos à deux prix réels : ${verifiees.length}`);
console.log(`  dont offres d'enseignes        : ${enseignes.length}`);
console.log(`  dont bons plans de presse      : ${presse.length}`);
console.log(`MÉLANGE AFFICHÉ : ${melange.length} lignes — ${nAmz} Amazon (${(nAmz / melange.length * 100).toFixed(0)} %) · ${melange.length - nAmz} autres enseignes (${(100 - nAmz / melange.length * 100).toFixed(0)} %)`);
console.log('');
console.log('PAYS          promos  affichées  Amazon  autres  part Amazon');
const parPays = {};
for (const o of bonnes) (parPays[pays(o)] = parPays[pays(o)] || []).push(o);
for (const p of Object.keys(parPays).sort((a, b) => parPays[b].length - parPays[a].length)) {
  const l = R.melanger(R.dedoublonner(parPays[p]));
  const a = l.filter(R.estAmazon).length;
  console.log(`${p.padEnd(12)} ${String(parPays[p].length).padStart(6)} ${String(l.length).padStart(10)} ${String(a).padStart(7)} ${String(l.length - a).padStart(7)} ${(a / l.length * 100).toFixed(0).padStart(8)} %`);
}
console.log('');
console.log('Enseignes affichées, les plus présentes :');
const c = {};
for (const o of melange.filter((x) => !R.estAmazon(x))) c[o.marchand] = (c[o.marchand] || 0) + 1;
for (const [k, v] of Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 20)) console.log(`   ${String(v).padStart(4)} ${k}`);
