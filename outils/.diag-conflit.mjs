import fs from 'node:fs';
import { classerOffre, sansAccents, sansNegations, retirerTrompeurs, destinationEtrangere, estForfaitVoyage, estRepasDehors, preuveEpicerie } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
let n = 0;
for (const o of offres) {
  if (o.categorieImposee !== 'activite') continue;
  const t = bas(o);
  const voy = estForfaitVoyage(t) || destinationEtrangere(t, o.pays);
  if (!voy) continue;
  const repas = estRepasDehors(t) && !preuveEpicerie(t);
  const cat = classerOffre(o);
  n += 1;
  if (repas && cat !== 'voyages') console.log(`CONFLIT repas>voyage [${o.pays}] -> ${cat} :: ${String(o.titre).slice(0, 90)}`);
}
console.log('offres imposées activite avec voyage potentiel:', n);
