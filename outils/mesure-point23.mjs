/**
 * MESURE DU POINT 23 ÉTENDU — « dès qu'il y a jouet / pour enfant / garçon /
 * fille / une tranche d'âge d'enfant, l'offre va en Jeux & jouets — dans TOUTES
 * les catégories et pour TOUS les pays ».
 *
 * On mesure la POPULATION VISÉE : les offres publiées qui NE SONT PAS en jouets
 * et dont le titre porte un marqueur enfant, hors JEU NUMÉRIQUE (qui reste un
 * logiciel). C'est exactement ce que la règle déplace.
 */
import fs from 'node:fs';
import { marqueurEnfant, estJeuNumerique, sansAccents } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const norm = (o) => sansAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();

const cible = offres.filter((o) => (o.categorie || 'autre') !== 'jouets'
  && marqueurEnfant(norm(o)) && !estJeuNumerique(norm(o)));

const parCat = {};
for (const o of cible) parCat[o.categorie || 'autre'] = (parCat[o.categorie || 'autre'] || 0) + 1;
const parPays = {};
for (const o of cible) parPays[o.pays || '?'] = (parPays[o.pays || '?'] || 0) + 1;

console.log(`offres publiées                     : ${offres.length}`);
console.log(`en jouets                           : ${offres.filter((o) => (o.categorie || '') === 'jouets').length}`);
console.log(`DÉPLACÉES vers jouets par la règle  : ${cible.length}`);
console.log('  d\'où elles viennent :', JSON.stringify(parCat));
console.log('  par pays          :', JSON.stringify(parPays));
console.log('\n— 25 exemples réels —');
for (const o of cible.slice(0, 25)) {
  console.log(`  [${o.pays || '?'}] ${String(o.categorie || 'autre').padEnd(14)} « ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 62).trim()} »`);
}
