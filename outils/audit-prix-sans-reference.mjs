/** Que contient exactement le magasin : offres AVEC un prix mais SANS prix de
 *  référence ? Ce sont elles que la règle « une promotion sans deuxième prix
 *  n'est pas une promotion » doit écarter. On mesure AVANT de purger, par type
 *  et par marchand, pour ne rien emporter de légitime. Lecture seule. */
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('data/offres.json', 'utf8'));
const o = d.offres || d;
const orphelines = o.filter((x) => x.prix != null && !x.prixAvant);
console.log(`total ${o.length} — avec prix mais sans 2e prix : ${orphelines.length}`);
const parType = {};
for (const x of orphelines) {
  const k = `${x.type} / ${x.marchand || '—'}`;
  parType[k] = (parType[k] || 0) + 1;
}
console.log('\npar type / marchand :');
for (const [k, v] of Object.entries(parType).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log('\ncontrôle : y en a-t-il qui portent une remise écrite ou calculée ?');
const avecRemise = orphelines.filter((x) => x.remise != null);
console.log(`  ${avecRemise.length} sur ${orphelines.length}`);
for (const x of avecRemise.slice(0, 8)) console.log(`   remise ${x.remise}% | ${x.prix} € | ${(x.titre || '').slice(0, 70)}`);
console.log('\n8 exemples les plus chers :');
for (const x of orphelines.slice().sort((a, b) => b.prix - a.prix).slice(0, 8)) {
  console.log(`  ${String(x.prix).padStart(8)} € | ${x.type} | ${x.marchand || '—'} | ${(x.titre || '').slice(0, 62)}`);
}
