/**
 * MESURE DU POINT 23 — « tout article à marqueur ENFANT/JOUET qui est en
 * high-tech passe en Jeux & jouets ».
 *
 * On mesure la POPULATION VISÉE : les offres publiées rangées en `tech` dont le
 * titre porte un marqueur enfant (mot d'enfant/fille/garçon/jouet, ou plage
 * d'âge d'enfant). C'est exactement ce que la règle déplace — et cela ne dépend
 * pas du tout de `famille()` sur les autres rubriques, donc la mesure est nette.
 *
 * On liste aussi les cas « de bonne foi » (montre connectée enfant, tablette
 * enfant, drone enfant…) parce que B a le droit de les voir avant de valider.
 */
import fs from 'node:fs';
import { marqueurEnfant, sansAccents } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres;
const norm = (o) => withoutAccents(String(o.titre || '').replace(/<[^>]+>/g, ' ')).toLowerCase();
function withoutAccents(s) { return sansAccents(s); }

const tech = offres.filter((o) => (o.categorie || 'autre') === 'tech');
const cible = tech.filter((o) => marqueurEnfant(norm(o)));

const parPays = {};
for (const o of cible) parPays[o.pays || '?'] = (parPays[o.pays || '?'] || 0) + 1;

console.log(`offres publiées            : ${offres.length}`);
console.log(`offres en HIGH-TECH        : ${tech.length}`);
console.log(`dont à marqueur ENFANT     : ${cible.length}   ← celles que la règle déplace`);
console.log('par pays :', JSON.stringify(parPays));
console.log('\n— 20 exemples (les vrais, pas des cas fabriqués) —');
for (const o of cible.slice(0, 20)) {
  console.log(`  [${o.pays || '?'}] ${String(o.titre).replace(/<[^>]+>/g, '').slice(0, 74)}`);
}
