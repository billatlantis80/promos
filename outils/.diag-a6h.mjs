import { FAMILLES, MARQUES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs, exigeFrontiere, compterMots } from '../collecteur.mjs';

const FN = Object.fromEntries(Object.entries(FAMILLES).map(([f, mots]) => [f, [...mots, ...(MARQUES[f] || [])].map((m) => sansAccents(m).toLowerCase())]));
function scores(titre) {
  const bas = retirerTrompeurs(sansNegations(sansAccents(String(titre)).toLowerCase()));
  const out = {};
  for (const [f, mots] of Object.entries(FN)) {
    const t = mots.filter((m) => (exigeFrontiere(m) ? new RegExp('(^|[^a-zà-ÿ])' + m + '([^a-zà-ÿ]|$)', 'i').test(bas) : bas.includes(m)));
    if (t.length) out[f] = t;
  }
  return { bas, out };
}
const cas = [
  'Upto 50% off Character Clothing Incl. Bluey, Disney, Paw Patrol, Hot Wheels, K-Pop + Extra 10% off',
  'Pack de 5 coches Hot Wheels - Mattel 1806 Varios modelos',
  'Lot de 5 voitures miniatures Hot Wheels Ferrari - échelle 1/64',
  'Brosse Nettoyage Radiateur 117cm I Plumeau Radiateur Longue Fine',
];
for (const t of cas) {
  const { bas, out } = scores(t);
  console.log(`\n### ${t.slice(0, 80)}`);
  console.log('   bas:', bas.slice(0, 110));
  for (const [f, m] of Object.entries(out)) console.log(`   ${f}: ${JSON.stringify(m)}`);
}
