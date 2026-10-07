import fs from 'node:fs';
import { classerOffre } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
for (const o of offres) {
  if (classerOffre(o) !== 'voyages') continue;
  const t = String(o.titre || '');
  if (/Bokserki|Sonicare|Chauffe-Biberon|Reisvacuum|Reisvacuu/.test(t)) {
    console.log(JSON.stringify({ pays: o.pays, cat: classerOffre(o), src: o.categorieSource, imp: o.categorieImposee, titre: t }, null, 1));
  }
}
