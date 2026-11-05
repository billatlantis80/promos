/**
 * Ce que l'étage « bonne affaire » change — mesuré sur les données publiées.
 *   node outils/mesure-bonnes-affaires.mjs
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
  ;({ estAmazon, estPromoVerifiee, estOffreEnseigne, estBonPlanPresse, estBonneAffaire, estBonnePromo, dedoublonner, melanger })`, ctx);

const bonnes = offres.filter(R.estBonnePromo);
// On trie les deux camps comme le fait l'application (remise, puis chaleur) pour
// que la position mesurée soit celle de l'écran, pas celle du fichier.
const cmp = (a, b) => (R.estPromoVerifiee(b) ? 1 : 0) - (R.estPromoVerifiee(a) ? 1 : 0)
  || (b.remise || 0) - (a.remise || 0) || (b.temperature || 0) - (a.temperature || 0);
const melange = R.melanger(R.dedoublonner(bonnes), cmp);
const nAmz = melange.filter(R.estAmazon).length;
const autres = melange.filter((o) => !R.estAmazon(o));
const cat = (o) => (R.estPromoVerifiee(o) ? 'promo 2 prix' : (R.estOffreEnseigne(o) ? 'enseigne (prix réel)' : (R.estBonPlanPresse(o) ? 'presse' : 'bonne affaire')));
const c = {};
for (const o of autres) c[cat(o)] = (c[cat(o)] || 0) + 1;

console.log(`Catalogue : ${offres.length} offres · retenues : ${bonnes.length}`);
console.log(`AFFICHÉ : ${melange.length} lignes — ${nAmz} Amazon (${(nAmz / melange.length * 100).toFixed(0)} %) · ${autres.length} autres (${(autres.length / melange.length * 100).toFixed(0)} %)`);
console.log('');
console.log('Décomposition du camp des 40 % :');
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(4)}  ${k}`);
console.log('');
console.log('Sans prix affiché :', autres.filter((o) => o.prix == null).length, 'cartes (aucun prix, aucun pourcentage)');
console.log('');
const aff = autres.filter((o) => R.estBonneAffaire(o));
const parM = {};
for (const o of aff) parM[o.marchand] = (parM[o.marchand] || 0) + 1;
console.log(`Enseignes rendues visibles par le nouvel étage (${Object.keys(parM).length} marchands) :`);
for (const [k, v] of Object.entries(parM).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`   ${String(v).padStart(3)} ${k}`);
console.log('');
console.log('Avec visuel :', aff.filter((o) => o.image).length, '/', aff.length);
const parPays = {};
for (const o of aff) parPays[o.pays || '?'] = (parPays[o.pays || '?'] || 0) + 1;
console.log('par pays :', Object.entries(parPays).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('');
console.log('exemples de cartes telles qu’elles s’afficheront :');
for (const o of aff.slice(0, 6)) {
  console.log(`   [${o.pays}] ${o.marchand} — ${o.temperature}° — ${String(o.titre).slice(0, 62)}`);
  console.log(`        visuel ${o.image ? 'oui' : 'NON'} · prix : aucun · lien : ${String(o.lienPage).slice(0, 58)}`);
}
