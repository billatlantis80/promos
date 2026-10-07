import fs from 'node:fs';
import { sansAccents } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const autre = d.offres.filter((o) => (o.categorie || 'autre') === 'autre');
for (const mot of process.argv.slice(2)) {
  const m = sansAccents(mot).toLowerCase();
  const hits = autre.filter((o) => sansAccents(String(o.titre || '')).toLowerCase().includes(m));
  console.log(`\n=== « ${mot} » : ${hits.length} offres en Autres ===`);
  for (const o of hits.slice(0, 40)) console.log(`  [${o.pays}/${o.categorieSource}] ${String(o.titre).slice(0, 95)}`);
}
