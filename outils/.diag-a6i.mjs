import fs from 'node:fs';
import { classerOffre, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs } from '../collecteur.mjs';
const d = JSON.parse(fs.readFileSync('docs/offres.json', 'utf8'));
const offres = Array.isArray(d) ? d : d.offres;
const M = Object.fromEntries(Object.entries(MOTS_FORTS).map(([f, mots]) => [f, mots.map((m) => sansAccents(m).toLowerCase())]));
function forts(titre) {
  const bas = retirerTrompeurs(sansNegations(sansAccents(String(titre)).toLowerCase()));
  const out = {};
  for (const [f, mots] of Object.entries(M)) {
    const t = mots.filter((m) => bas.includes(m));
    if (t.length) out[f] = t;
  }
  return out;
}
for (const o of offres.filter((o) => /Radiateur|Plumeau/i.test(String(o.titre)))) {
  console.log(`\n[${o.categorie}] ${o.titre}`);
  console.log('  FORTS:', JSON.stringify(forts(o.titre)));
}
