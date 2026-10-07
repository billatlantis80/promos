import { classerOffre as avant } from '../.avant-collecteur.mjs';
import { classerOffre as apres, FAMILLES, MARQUES, sansAccents, sansNegations, retirerTrompeurs, exigeFrontiere } from '../collecteur.mjs';
const t = 'Bosch Professional: narzędzie wielofunkcyjne Multi-Cutter GOP 40-30 (400 W, 10 brzeszczotów BIM, walizka, L-Boxx)';
console.log('avant:', avant({titre:t, categorieSource:'vente flash', pays:'PL'}));
console.log('apres:', apres({titre:t, categorieSource:'vente flash', pays:'PL'}));
const bas = retirerTrompeurs(sansNegations(sansAccents(t).toLowerCase()));
console.log('bas:', bas);
for (const [f, mots] of Object.entries(FAMILLES)) {
  const all = [...mots, ...(MARQUES[f]||[])];
  const t2 = all.filter(m => { const mm = sansAccents(m).toLowerCase(); return exigeFrontiere(mm) ? new RegExp('(^|[^a-zà-ÿ])'+mm+'([^a-zà-ÿ]|$)','i').test(bas) : bas.includes(mm); });
  if (t2.length) console.log('  FORT/NEW', f, JSON.stringify(t2));
}
