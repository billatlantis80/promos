import fs from 'node:fs';
import { classerOffre } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
for (const o of offres) {
  if (/Union Kino|Tom Cruise/.test(String(o.titre || ''))) {
    console.log('TITRE COMPLET:', String(o.titre));
    console.log('cat=', classerOffre(o), 'src=', o.categorieSource);
  }
}
