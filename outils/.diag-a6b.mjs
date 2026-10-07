import fs from 'node:fs';
import { classerOffre, sansAccents, sansNegations, retirerTrompeurs } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;

const norm = (t) => retirerTrompeurs(sansNegations(sansAccents(String(t || '')).toLowerCase()));

const MOTIFS = ['brico', 'pila', 'scie', 'akku', 'farg', 'ladder', 'tools', 'sega', 'figur', 'baby', 'configur'];

console.log(`offres: ${offres.length}`);
for (const m of MOTIFS) {
  const hits = offres.filter((o) => norm(o.titre).includes(m));
  const parRub = {};
  for (const o of hits) { const r = o.categorie || '??'; parRub[r] = (parRub[r] || 0) + 1; }
  // sous-chaîne pure ?
  const pur = hits.filter((o) => !new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(norm(o.titre)));
  console.log(`\n=== « ${m} » : ${hits.length} offres | répartition ${JSON.stringify(parRub)} | sous-chaîne pure: ${pur.length}`);
  for (const o of pur.slice(0, 30)) console.log(`   [${o.categorie}] src=${o.categorieSource || '-'} | ${String(o.titre).slice(0, 82)}`);
}
