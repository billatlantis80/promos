import { FAMILLES, MARQUES, MOTS_A_FRONTIERE, sansAccents, sansNegations, retirerTrompeurs, exigeFrontiere } from '../collecteur.mjs';
const t = "Bosch Professional: narzędzie wielofunkcyjne Multi-Cutter GOP 40-30 (400 W, 10 brzeszczotów BIM, 1 płyta szlifierska, 5 papierów ściernych, walizka L-BOXX)";
const bas = retirerTrompeurs(sansNegations(sansAccents(t).toLowerCase()));
for (const f of ['bricolage']) {
  const all = [...FAMILLES[f], ...(MARQUES[f]||[])];
  console.log('--- ' + f + ' : mots qui matchent en SOUS-CHAINE (ancien comportement) ---');
  for (const m of all) { const mm = sansAccents(m).toLowerCase(); if (bas.includes(mm)) console.log('   ', JSON.stringify(m), 'frontiere=', exigeFrontiere(mm), 'aFrontiere=', MOTS_A_FRONTIERE.has(mm)); }
}
