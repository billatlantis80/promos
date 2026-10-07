import fs from 'node:fs';
import { classerOffre as apres } from '../collecteur.mjs';
import { classerOffre as avant } from '../.avant-a7-collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
for (const o of d.offres) {
  const a = avant(o), b = apres(o);
  if (a !== b && a !== 'autre' && b !== 'autre') {
    console.log(`[${o.pays}/${o.categorieSource}] ${a} → ${b}  « ${String(o.titre).slice(0, 110)} »`);
  }
}
