import fs from 'node:fs';
import { classerOffre } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
for (const o of d.offres) {
  const a = o.categorie || 'autre';
  const b = classerOffre(o);
  if (a !== b && a !== 'autre' && b !== 'autre') {
    console.log(`[${o.pays}/${o.categorieSource}] ${a} → ${b}  « ${String(o.titre).slice(0, 100)} »`);
  }
  if (a !== b && b === 'autre' && a !== 'autre') {
    console.log(`RÉGRESSION [${o.pays}/${o.categorieSource}] ${a} → ${b}  « ${String(o.titre).slice(0, 100)} »`);
  }
}
