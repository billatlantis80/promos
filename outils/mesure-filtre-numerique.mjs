/**
 * Mesure l'effet du durcissement du filtre « jeu numérique » (estJeuNumerique)
 * et du retrait du mot nu « band », SANS toucher au réseau.
 *
 * Rejoue `famille()` sur les titres réellement publiés et compare à la rubrique
 * enregistrée. Sortie : le delta par famille, et la liste nominative des offres
 * qui changent — c'est cette liste qu'on lit, jamais un total seul.
 */
import fs from 'node:fs';
import { famille } from '../collecteur.mjs';

const f = 'data/offres.json';
const brut = JSON.parse(fs.readFileSync(f, 'utf8'));
const offres = Array.isArray(brut) ? brut : (brut.offres || []);

const change = [];
const avant = {}, apres = {};
for (const o of offres) {
  const c0 = o.categorie || 'autre';
  const c1 = famille(o.titre, o.categorieSource);
  avant[c0] = (avant[c0] || 0) + 1;
  apres[c1] = (apres[c1] || 0) + 1;
  if (c0 !== c1) change.push({ t: String(o.titre || '').slice(0, 72), pays: o.pays, de: c0, vers: c1 });
}

console.log(`offres lues : ${offres.length}   |   changent de rubrique : ${change.length}\n`);
for (const c of change) console.log(`  ${c.pays}  ${c.de} → ${c.vers}   « ${c.t} »`);

console.log('\n— Total par famille (recalcul vs enregistré) —');
for (const k of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
  const d = (apres[k] || 0) - (avant[k] || 0);
  console.log(`  ${k.padEnd(10)} ${String(avant[k] || 0).padStart(5)} → ${String(apres[k] || 0).padStart(5)}  ${d ? (d > 0 ? '+' : '') + d : ''}`);
}

// Combien d'offres LEGO et combien d'offres auto, dans les deux états.
const familyOf = (o) => famille(o.titre, o.categorieSource);
const lego = offres.filter((o) => /\blego\b/i.test(String(o.titre || '')));
const autoAvant = offres.filter((o) => (o.categorie || 'autre') === 'auto');
const autoApres = offres.filter((o) => familyOf(o) === 'auto');
const legoJouets = lego.filter((o) => familyOf(o) === 'jouets').length;
console.log(`\n— Contrôles ciblés —`);
console.log(`  LEGO : ${lego.length} offres, ${legoJouets} en jouets après recalcul (${lego.length - legoJouets} ailleurs)`);
for (const o of lego.filter((x) => familyOf(x) !== 'jouets')) {
  console.log(`     reste ailleurs → ${familyOf(o)}  « ${String(o.titre).slice(0, 70)} »`);
}
console.log(`  auto : ${autoAvant.length} offres enregistrées, ${autoApres.length} après recalcul`);
