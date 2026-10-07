import fs from 'node:fs';
import { classerOffre, sansAccents, sansNegations, retirerTrompeurs, destinationEtrangere, estForfaitVoyage } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
let i = 0;
for (const o of offres) {
  if (classerOffre(o) !== 'voyages') continue;
  i += 1;
  const t = bas(o);
  const kind = destinationEtrangere(t, o.pays) ? 'DEST' : (estForfaitVoyage(t) ? 'FORFAIT' : 'NU');
  console.log(`${String(i).padStart(3)} [${o.pays}] ${kind.padEnd(7)} ${String(o.categorieSource).padEnd(11)} ${String(o.titre).slice(0, 95)}`);
}
console.log('TOTAL', i);
