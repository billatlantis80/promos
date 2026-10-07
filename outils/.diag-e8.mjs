import { classerOffre, FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs, compterMots, destinationEtrangere, estForfaitVoyage } from '../collecteur.mjs';

const titres = [
  'DANISH ENDURANCE Bokserki Bambusowe, Oddychająca Bielizna, 6 lub 10-Pak | Bokserki',
  'Philips Sonicare 6100 Elektryczna szczoteczka do zębów, szczoteczka soniczna z 2 trybami',
  'Momcozy Chauffe-Biberon Portable 500 ml I Lait et Eau, Idéal Voyage, Vert',
  'Reisvacuümtassen met draadloze elektrische pomp, 12 stuks compressiepakketten voor',
];
for (const t of titres) {
  const bas = retirerTrompeurs(sansNegations(sansAccents(t).toLowerCase()));
  const hits = [];
  for (const [f, mots] of Object.entries(FAMILLES)) {
    const m = mots.filter((x) => compterMots([sansAccents(x).toLowerCase()], bas) > 0);
    if (m.length) hits.push(f + ':' + m.join('|'));
  }
  const fort = [];
  for (const [f, mots] of Object.entries(MOTS_FORTS)) {
    const m = mots.filter((x) => compterMots([sansAccents(x).toLowerCase()], bas) > 0);
    if (m.length) fort.push(f + ':' + m.join('|'));
  }
  console.log(JSON.stringify({ t: t.slice(0, 52), cat: classerOffre({ titre: t, pays: 'PL' }), FAMILLES: hits, MOTS_FORTS: fort, dest: destinationEtrangere(bas, 'PL'), forfait: estForfaitVoyage(bas) }, null, 1));
}
