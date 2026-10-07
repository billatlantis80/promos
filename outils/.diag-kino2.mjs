import { FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs, compterMots, categorieDeSource, estRepasDehors, preuveEpicerie } from '../collecteur.mjs';
const t = 'Union Kino Ludwigsburg feiert 75. Geburtstag - u.a. Digger mit Tom Cruise am 12.10.2026 für 75 Cent';
const bas = retirerTrompeurs(sansNegations(sansAccents(t).toLowerCase()));
console.log('bas=', bas);
for (const [f, mots] of Object.entries(FAMILLES)) {
  const m = mots.filter((x) => compterMots([sansAccents(x).toLowerCase()], bas) > 0);
  if (m.length) console.log('FAMILLE', f, m);
}
for (const [f, mots] of Object.entries(MOTS_FORTS)) {
  const m = mots.filter((x) => compterMots([sansAccents(x).toLowerCase()], bas) > 0);
  if (m.length) console.log('MOTFORT', f, m);
}
console.log('src=', categorieDeSource('Kultur & Freizeit'), 'repas=', estRepasDehors(bas), 'epicerie=', preuveEpicerie(bas));
