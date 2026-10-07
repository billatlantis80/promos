import fs from 'node:fs';
import { classerOffre, FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs, compterMots, categorieDeSource, destinationEtrangere, estForfaitVoyage } from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync('data/offres.json', 'utf8'));
const offres = d.offres || [];
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
const motsV = [...MOTS_FORTS.voyages, ...FAMILLES.voyages].map((x) => sansAccents(x).toLowerCase());
let n = 0;
const parSource = {};
for (const o of offres) {
  if (classerOffre(o) !== 'voyages') continue;
  n += 1;
  const t = bas(o);
  const src = categorieDeSource(o.categorieSource);
  const hits = motsV.filter((m) => compterMots([m], t) > 0);
  const dest = destinationEtrangere(t, o.pays);
  const cl = `${o.categorieSource || '(sans)'} -> ${src || '-'}`;
  parSource[cl] = (parSource[cl] || 0) + 1;
  const flag = (src === 'voyages') ? 'SRC' : (hits.length || dest || estForfaitVoyage(t) ? 'TITRE' : '?');
  if (flag !== 'SRC') console.log(`${flag} [${o.pays}] src=${o.categorieSource} dest=${dest || '-'} forfait=${estForfaitVoyage(t)} mots=[${hits.join(',')}] :: ${String(o.titre).slice(0, 70)}`);
}
console.log('TOTAL voyages', n);
console.log('par source:', JSON.stringify(parSource, null, 1));
