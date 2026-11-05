import fs from 'node:fs';
import { classerOffre as avant } from '../.avant-collecteur.mjs';
import { classerOffre as apres } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('docs/offres.json','utf8'));
const offres = Array.isArray(d)?d:d.offres;
for (const o of offres.filter(o=>/gillette/i.test(String(o.titre)) )) {
  const a=avant(o), b=apres(o);
  console.log(`${a===b?'= ':'≠ '}[${o.categorie}] avant=${a} apres=${b} | ${String(o.titre).slice(0,80)}`);
}
