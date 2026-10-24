/* Contrôle de l'unité E7 — les DEUX nouvelles rubriques MEUBLES et NOURRITURE.
 *
 *  E7 ne crée rien : il VÉRIFIE ce qu'E6 a posé, et il le vérifie sur les
 *  données publiées, classement rejoué. Trois obligations, tirées du plan :
 *    1. compter chaque rubrique et citer 5 exemples ;
 *    2. vérifier qu'aucun meuble n'est resté en Maison et qu'aucun aliment
 *       ne traîne en « Autres » ;
 *    3. vérifier qu'aucun REPAS PRIS DEHORS (restaurant, hamburger, brunch,
 *       menu, buffet, à emporter) n'est tombé en « Nourriture » — il doit être
 *       en Activité (point 22).
 *  Et la mesure de la baisse du taux de « Autres ».
 *
 *  ⚠ Un chiffre sans commande ne vaut rien : tout ce qui s'affiche ici est
 *  calculé, jamais recopié. La baisse de « Autres » se mesure par un
 *  CONTRECOUP : on reclasse les MÊMES offres avec le collecteur d'AVANT E6
 *  (fichier passé en 2e argument) et on compare. C'est la seule façon honnête
 *  de dire « combien d'offres E6 a retirées de Autres » dans la même session.
 *
 *  Usage : node outils/mesure-e7.mjs [data/offres.json] [pre-e6.mjs]
 */
import fs from 'node:fs';
import {
  classerOffre, FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs,
  compterMots, estRepasDehors, preuveEpicerie,
} from '../collecteur.mjs';

const CHEMIN = process.argv[2] || 'data/offres.json';
const PRE_E6 = process.argv[3] || null;

const d = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
const offres = d.offres || [];
const classes = offres.map((o) => ({ o, cat: classerOffre(o) }));
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
const par = (cat) => classes.filter((x) => x.cat === cat);
const m = par('meubles');
const n = par('nourriture');
const autre = par('autre');
const ex = (arr, k = 5) => arr.slice(0, k)
  .map((x) => `  [${x.o.pays}] ${String(x.o.titre).slice(0, 78)}   (${x.o.categorieSource})`)
  .join('\n');

console.log(`Contrôle E7 — ${offres.length} offres publiées (${CHEMIN}), classement rejoué\n`);
console.log(`MEUBLES   : ${m.length}`);
console.log(`NOURRITURE: ${n.length}`);
console.log(`AUTRES    : ${autre.length}  (${(autre.length / offres.length * 100).toFixed(1)} %)\n`);

console.log('— 5 exemples MEUBLES —');
console.log(ex(m));
console.log('\n— 5 exemples NOURRITURE —');
console.log(ex(n));

// Contrôle 1 : un meuble resté en Maison (le mot fort aurait dû le sortir).
const motsM = MOTS_FORTS.meubles.map((x) => sansAccents(x).toLowerCase());
const resteMaison = par('maison').filter((x) => compterMots(motsM, bas(x.o)) > 0);
console.log(`\n— CONTRÔLE 1 : MEUBLE resté en MAISON : ${resteMaison.length}${resteMaison.length ? '' : '  ✔'}`);
for (const x of resteMaison.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Contrôle 2 : un aliment ou un meuble encore en « Autres » alors que le mot
// de la famille est dans le titre.
const motsN = FAMILLES.nourriture.map((x) => sansAccents(x).toLowerCase());
const motsMF = FAMILLES.meubles.map((x) => sansAccents(x).toLowerCase());
const resteAutre = autre.filter((x) => compterMots(motsN, bas(x.o)) > 0 || compterMots(motsMF, bas(x.o)) > 0);
console.log(`\n— CONTRÔLE 2 : aliment/meuble resté en AUTRES : ${resteAutre.length}${resteAutre.length ? '' : '  ✔'}`);
for (const x of resteAutre.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Contrôle 3 : REPAS DEHORS tombé en « Nourriture » SANS preuve d'épicerie.
// C'est la faute grave (point 22). Avec preuve d'épicerie (lot, kg, surgelé…),
// l'offre est du cabas : on la CITE quand même plutôt que de la cacher.
const faute = n.filter((x) => estRepasDehors(bas(x.o)) && !preuveEpicerie(bas(x.o)));
const cite = n.filter((x) => estRepasDehors(bas(x.o)) && preuveEpicerie(bas(x.o)));
console.log(`\n— CONTRÔLE 3 : REPAS DEHORS en NOURRITURE sans preuve d'épicerie : ${faute.length}${faute.length ? '' : '  ✔'}`);
for (const x of faute.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);
console.log(`  (cités, tolérés : NOURRITURE avec mot de repas dehors MAIS preuve d'épicerie = ${cite.length})`);
for (const x of cite.slice(0, 6)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Contrôle 4 : les repas dehors correctement en Activité (échantillon).
const repasAct = par('activite').filter((x) => estRepasDehors(bas(x.o)) && !preuveEpicerie(bas(x.o)));
console.log(`\n— CONTRÔLE 4 (positif) : REPAS DEHORS en ACTIVITÉ (point 22) : ${repasAct.length}`);
for (const x of repasAct.slice(0, 8)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// Baisse de « Autres » par contre-coup sur le MÊME jeu d'offres.
if (PRE_E6) {
  const avant = await import(PRE_E6);
  const autreAvant = offres.filter((o) => avant.classerOffre(o) === 'autre').length;
  console.log(`\n— BAISSE DE « AUTRES » (même jeu, ${offres.length} offres) —`);
  console.log(`  collecteur AVANT E6 : ${autreAvant}  (${(autreAvant / offres.length * 100).toFixed(1)} %)`);
  console.log(`  collecteur APRÈS E6 : ${autre.length}  (${(autre.length / offres.length * 100).toFixed(1)} %)`);
  console.log(`  retirées de « Autres » : ${autreAvant - autre.length}`);
} else {
  console.log('\n— BAISSE DE « AUTRES » : non mesurée (passer un collecteur pré-E6 en 2e argument) —');
}

// Couverture par pays : on NOMME les pays vides au lieu de les taire.
const pays = [...new Set(offres.map((o) => o.pays))].sort();
const videsM = [], videsN = [];
console.log('\n— COUVERTURE PAR PAYS (Meubles / Nourriture) —');
for (const p of pays) {
  const cm = m.filter((x) => x.o.pays === p).length;
  const cn = n.filter((x) => x.o.pays === p).length;
  if (!cm) videsM.push(p);
  if (!cn) videsN.push(p);
  console.log(`  ${String(p).padEnd(4)} Meubles ${String(cm).padStart(3)}   Nourriture ${String(cn).padStart(3)}`);
}
console.log(`  Pays SANS Meubles   : ${videsM.join(' ') || 'aucun'}`);
console.log(`  Pays SANS Nourriture: ${videsN.join(' ') || 'aucun'}`);
