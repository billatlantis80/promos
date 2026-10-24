/* Contrôle de l'unité E8 — les DEUX nouvelles rubriques ANIMAUX et VOYAGES.
 *
 *  E8 crée deux rubriques et un partage GÉOGRAPHIQUE avec « Activité » :
 *    1. compter chaque rubrique et citer 5 exemples ;
 *    2. vérifier qu'aucun produit ANIMALIER n'est tombé en « Nourriture »
 *       (réservée à l'alimentation HUMAINE, point 18) ;
 *    3. vérifier qu'aucun VOYAGE nommé n'est resté en Activité (points 19 et 21) ;
 *    4. compter les offres dont la DESTINATION n'est PAS identifiable — le
 *       principal gisement d'erreurs — et CITER les cas ambigus (un zoo à
 *       l'étranger, un hôtel sans destination) au lieu de les taire ;
 *    5. mesurer la CASSE : ce qu'E8 a déplacé, par un CONTRECOUP honnête — on
 *       reclasse les MÊMES offres avec le collecteur d'AVANT E8 (passé en 2e
 *       argument) et on compare, transition par transition.
 *
 *  ⚠ Un chiffre sans commande ne vaut rien : tout ce qui s'affiche est calculé,
 *  jamais recopié.
 *
 *  Usage : node outils/mesure-e8.mjs [data/offres.json] [pre-e8.mjs]
 */
import fs from 'node:fs';
import {
  classerOffre, FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs,
  compterMots, estRepasDehors, preuveEpicerie, destinationEtrangere, estForfaitVoyage,
} from '../collecteur.mjs';

const CHEMIN = process.argv[2] || 'data/offres.json';
const PRE_E8 = process.argv[3] || null;

const d = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
const offres = d.offres || [];
const classes = offres.map((o) => ({ o, cat: classerOffre(o) }));
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
const par = (cat) => classes.filter((x) => x.cat === cat);
const animaux = par('animaux');
const voyages = par('voyages');
const activite = par('activite');
const nourriture = par('nourriture');
const autre = par('autre');
const ex = (arr, k = 5) => arr.slice(0, k)
  .map((x) => `  [${x.o.pays}] ${String(x.o.titre).slice(0, 80)}   (${x.o.categorieSource})`)
  .join('\n');

console.log(`Contrôle E8 — ${offres.length} offres (${CHEMIN}), classement rejoué\n`);
console.log(`ANIMAUX   : ${animaux.length}`);
console.log(`VOYAGES   : ${voyages.length}`);
console.log(`ACTIVITÉ  : ${activite.length}`);
console.log(`NOURRITURE: ${nourriture.length}`);
console.log(`AUTRES    : ${autre.length}  (${(autre.length / offres.length * 100).toFixed(1)} %)\n`);

console.log('— 5 exemples ANIMAUX —');
console.log(ex(animaux));
console.log('\n— 5 exemples VOYAGES —');
console.log(ex(voyages));

// Contrôle 1 : nourriture ANIMALE tombée en « Nourriture » (point 18).
const motsAnimaux = [...MOTS_FORTS.animaux, ...FAMILLES.animaux].map((x) => sansAccents(x).toLowerCase());
const animaleEnNourriture = nourriture.filter((x) => compterMots(motsAnimaux, bas(x.o)) > 0);
console.log(`\n— CONTRÔLE 1 : nourriture/accessoire ANIMAL en NOURRITURE : ${animaleEnNourriture.length}${animaleEnNourriture.length ? '' : '  ✔'}`);
for (const x of animaleEnNourriture.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Contrôle 2 : un VOYAGE nommé resté en Activité (points 19 et 21).
const voyageEnActivite = activite.filter((x) => estForfaitVoyage(bas(x.o)) || destinationEtrangere(bas(x.o), x.o.pays));
console.log(`\n— CONTRÔLE 2 : VOYAGE (forfait/destination étrangère) resté en ACTIVITÉ : ${voyageEnActivite.length}${voyageEnActivite.length ? '' : '  ✔'}`);
for (const x of voyageEnActivite.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Contrôle 3 : partage géographique — parmi les voyages, combien ont une
// destination ÉTRANGÈRE identifiable, combien viennent d'un FORFAIT nommé, et
// combien n'ont AUCUNE destination identifiable (le gisement d'erreurs).
const vDest = [], vForfait = [], vNu = [];
for (const x of voyages) {
  const t = bas(x.o);
  if (destinationEtrangere(t, x.o.pays)) vDest.push(x);
  else if (estForfaitVoyage(t)) vForfait.push(x);
  else vNu.push(x);
}
console.log(`\n— PARTAGE GÉOGRAPHIQUE (point 21) —`);
console.log(`  destination étrangère identifiable : ${vDest.length}`);
console.log(`  forfait nommé, sans destination     : ${vForfait.length}`);
console.log(`  SANS destination ni forfait         : ${vNu.length}`);
console.log(`  → offres à destination NON identifiable : ${vForfait.length + vNu.length}`);
console.log('  (citées, non tues — ce sont elles que E9 devra arbitrer) :');
for (const x of [...vForfait, ...vNu].slice(0, 14)) console.log(`    [${x.o.pays}] ${String(x.o.titre).slice(0, 82)}`);

// Contrôle 4 : cas ambigus NOMMÉS — destination étrangère mais prestation qui
// ressemble à une SORTIE locale (zoo, parc…), et hôtels sans destination.
const sortieEtrangere = voyages.filter((x) => destinationEtrangere(bas(x.o), x.o.pays)
  && /\b(zoo|parc|parque|spa|restaurant|concerto|concert|oper|opera|theatre|théâtre|musee|musée)\b/.test(bas(x.o)));
console.log(`\n— CONTRÔLE 4 : cas AMBIGUS (destination étrangère + allure de SORTIE) : ${sortieEtrangere.length}`);
for (const x of sortieEtrangere.slice(0, 12)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Casse : comparaison honnête avec le collecteur d'AVANT E8.
if (PRE_E8) {
  const avant = await import(PRE_E8);
  const av = offres.map((o) => avant.classerOffre(o));
  const transitions = {};
  for (let i = 0; i < offres.length; i++) {
    if (av[i] !== classes[i].cat) {
      const k = `${av[i]} → ${classes[i].cat}`;
      transitions[k] = (transitions[k] || 0) + 1;
    }
  }
  const bouge = Object.values(transitions).reduce((a, b) => a + b, 0);
  console.log(`\n— CASSE E8 (même jeu de ${offres.length} offres, collecteur pré-E8 en 2e argument) —`);
  console.log(`  offres changées de rubrique : ${bouge}`);
  for (const [k, n] of Object.entries(transitions).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(22)} ${n}`);
  const autreAvant = av.filter((c) => c === 'autre').length;
  console.log(`  AUTRES : ${autreAvant} (${(autreAvant / offres.length * 100).toFixed(1)} %) → ${autre.length} (${(autre.length / offres.length * 100).toFixed(1)} %)`);
} else {
  console.log('\n— CASSE E8 : non mesurée (passer un collecteur pré-E8 en 2e argument) —');
}

// Couverture par pays : on NOMME les pays vides au lieu de les taire.
const pays = [...new Set(offres.map((o) => o.pays))].sort();
const videsA = [], videsV = [];
console.log('\n— COUVERTURE PAR PAYS (Animaux / Voyages) —');
for (const p of pays) {
  const ca = animaux.filter((x) => x.o.pays === p).length;
  const cv = voyages.filter((x) => x.o.pays === p).length;
  if (!ca) videsA.push(p);
  if (!cv) videsV.push(p);
  console.log(`  ${String(p).padEnd(4)} Animaux ${String(ca).padStart(3)}   Voyages ${String(cv).padStart(3)}`);
}
console.log(`  Pays SANS Animaux : ${videsA.join(' ') || 'aucun'}`);
console.log(`  Pays SANS Voyages : ${videsV.join(' ') || 'aucun'}`);
