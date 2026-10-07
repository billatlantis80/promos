/* Contrôle de l'unité E9 — contrôle des DEUX rubriques ANIMAUX et VOYAGES
 * (contrôle de l'unité E8) et ARBITRAGE DU SEUIL Voyages.
 *
 *  E9 est une unité de CONTRÔLE. Elle mesure, elle ne devine pas :
 *    1. compter Animaux et Voyages, CITER 5 exemples par rubrique ;
 *    2. vérifier qu'aucun produit ANIMALIER n'est tombé en « Nourriture »
 *       (réservée à l'alimentation HUMAINE, point 18) ;
 *    3. vérifier qu'aucune offre de VOYAGE n'est restée en Activité (points 19/21) ;
 *    4. citer les FAUX POSITIFS de Voyages : un produit physique (valise, sac,
 *       compresseur) ramené par un rayon « Reizen » n'est pas un voyage ;
 *    5. mesurer la baisse de « Autres » imputable aux QUATRE rubriques neuves
 *       (Meubles, Nourriture, Animaux, Voyages) par un calcul explicite, pas
 *       une recopie ;
 *    6. distribuer les REMISES des Voyages (≥ 30 %, ≥ 40 %, ≥ 50 %) et PROPOSER
 *       le seuil qui garde l'onglet utile sans déchet (point 20 de B) ;
 *    7. compter les offres dont la DESTINATION n'est PAS identifiable (le
 *       principal gisement d'erreurs) et CITER les cas ambigus.
 *
 *  ⚠ Aucune destination, aucun prix, aucune remise n'est recopiée d'un rapport :
 *  tout est recalculé ici, sur les données publiées, et affiché avec sa commande.
 *
 *  Usage : node outils/mesure-e9.mjs [data/offres.json]
 */
import fs from 'node:fs';
import {
  classerOffre, FAMILLES, MARQUES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs,
  compterMots, destinationEtrangere, estForfaitVoyage, exigeFrontiere, estRepasDehors, preuveEpicerie,
} from '../collecteur.mjs';

const CHEMIN = process.argv[2] || 'data/offres.json';
const d = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
const offres = d.offres || [];
const classes = offres.map((o) => ({ o, cat: classerOffre(o) }));
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));
const par = (cat) => classes.filter((x) => x.cat === cat);
const animaux = par('animaux');
const voyages = par('voyages');
const activite = par('activite');
const nourriture = par('nourriture');
const meubles = par('meubles');
const autre = par('autre');

const remise = (o) => (typeof o.remise === 'number' ? o.remise : null);
const ex = (arr, k = 5) => arr.slice(0, k)
  .map((x) => `  [${x.o.pays}] remise ${String(remise(x.o) ?? '—').padStart(2)}% ${x.o.prixAvant != null ? '(2 prix)' : '(1 prix) '} ${String(x.o.titre).slice(0, 72)}   (${x.o.categorieSource})`)
  .join('\n');

console.log(`Contrôle E9 — ${offres.length} offres (${CHEMIN}), classement rejoué\n`);
console.log(`ANIMAUX   : ${animaux.length}`);
console.log(`VOYAGES   : ${voyages.length}`);
console.log(`ACTIVITÉ  : ${activite.length}`);
console.log(`NOURRITURE: ${nourriture.length}`);
console.log(`MEUBLES   : ${meubles.length}`);
console.log(`AUTRES    : ${autre.length}  (${(autre.length / offres.length * 100).toFixed(1)} %)\n`);

console.log('— 5 exemples ANIMAUX —');
console.log(ex(animaux));
console.log('\n— 5 exemples VOYAGES —');
console.log(ex(voyages));

// ---------------------------------------------------------------------------
// CONTRÔLE 1 : nourriture/accessoire ANIMAL tombé en « Nourriture » (point 18).
const motsAnimaux = [...MOTS_FORTS.animaux, ...FAMILLES.animaux].map((x) => sansAccents(x).toLowerCase());
const animaleEnNourriture = nourriture.filter((x) => compterMots(motsAnimaux, bas(x.o)) > 0);
console.log(`\n— CONTRÔLE 1 : nourriture/accessoire ANIMAL en NOURRITURE : ${animaleEnNourriture.length}${animaleEnNourriture.length ? '' : '  ✔'}`);
for (const x of animaleEnNourriture.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// ---------------------------------------------------------------------------
// CONTRÔLE 2 : un VOYAGE (forfait/destination étrangère) resté en Activité.
// ⚠ On applique la MÊME exception que classerOffre : un REPAS PRIS DEHORS garde
// sa place en Activité (point 22), même si sa cuisine est étrangère — un dîner
// grec à Bruxelles n'est pas un voyage. Le compter comme « erreur » serait un
// faux positif de contrôle.
const voyageEnActivite = activite.filter((x) => {
  const t = bas(x.o);
  if (!(estForfaitVoyage(t) || destinationEtrangere(t, x.o.pays))) return false;
  if (estRepasDehors(t) && !preuveEpicerie(t)) return false; // exception point 22
  return true;
});
const repasEtrangerEnActivite = activite.filter((x) => {
  const t = bas(x.o);
  return (estForfaitVoyage(t) || destinationEtrangere(t, x.o.pays)) && estRepasDehors(t) && !preuveEpicerie(t);
});
console.log(`\n— CONTRÔLE 2 : VOYAGE (forfait/destination étrangère) resté en ACTIVITÉ : ${voyageEnActivite.length}${voyageEnActivite.length ? '' : '  ✔'}`);
for (const x of voyageEnActivite.slice(0, 10)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);
console.log(`  (+ ${repasEtrangerEnActivite.length} REPAS pris dehors à cuisine étrangère, correctement en Activité — point 22, pas une erreur)`);
for (const x of repasEtrangerEnActivite.slice(0, 5)) console.log(`      [${x.o.pays}] ${String(x.o.titre).slice(0, 80)}`);

// ---------------------------------------------------------------------------
// CONTRÔLE 3 (E9) : FAUX POSITIFS dans Voyages — un PRODUIT PHYSIQUE de voyage
// (valise, sac, compresseur) ramené par un rayon « Reizen »/« Travel » n'est pas
// un voyage. On n'emploie que des noms de BAGAGERIE sans ambiguïté (ni
// « bagage », qui est une franchise de vol, ni « tas », trop générique).
const MOTS_PRODUIT_VOYAGE = ['valise', 'koffer', 'suitcase', 'reistas', 'reisvacu',
  'compressiepakket', 'sac de voyage', 'reisetasche', 'trousse de toilette', 'bagagerie'];
const produitsEnVoyages = voyages.filter((x) => {
  const t = bas(x.o);
  const motProduit = MOTS_PRODUIT_VOYAGE.some((m) => (exigeFrontiere(m)
    ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)').test(t)
    : t.includes(m)));
  return motProduit && !destinationEtrangere(t, x.o.pays) && !estForfaitVoyage(t);
});
console.log(`\n— CONTRÔLE 3 : PRODUIT (valise/sac/compresseur…) tombé en VOYAGES : ${produitsEnVoyages.length}`);
for (const x of produitsEnVoyages.slice(0, 12)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}   (${x.o.categorieSource})`);

// ---------------------------------------------------------------------------
// Baisse de « Autres » : imputable aux QUATRE rubriques neuves. Calcul explicite :
// une offre de meubles/nourriture/animaux/voyages qui, sans ces familles, ne
// rencontrait AUCUNE autre famille ni catégorie de source, retombait en « autre ».
const NEUVES = ['meubles', 'nourriture', 'animaux', 'voyages'];
function autreFamille(texteBas) {
  for (const [fam, mots] of Object.entries(FAMILLES)) {
    if (NEUVES.includes(fam)) continue;
    const tous = [...mots, ...(MARQUES[fam] || [])].map((m) => sansAccents(m).toLowerCase());
    if (tous.some((m) => (exigeFrontiere(m)
      ? new RegExp('(^|[^a-z0-9à-ÿ])' + m + '([^a-z0-9à-ÿ]|$)', 'i').test(texteBas)
      : texteBas.includes(m)))) return true;
  }
  return Object.entries(MOTS_FORTS)
    .filter(([f]) => !NEUVES.includes(f))
    .some(([, mots]) => compterMots(mots.map((m) => sansAccents(m).toLowerCase()), texteBas) > 0);
}
const gagnées = [...meubles, ...nourriture, ...animaux, ...voyages]
  .filter((x) => !x.o.categorieImposee && !autreFamille(bas(x.o)));
console.log(`\n— BAISSE DE « AUTRES » (calcul explicite, 4 rubriques neuves) —`);
console.log(`  offres des rubriques neuves qui n'auraient AUCUNE autre famille : ${gagnées.length}`);
console.log(`  AUTRES aujourd'hui : ${autre.length} (${(autre.length / offres.length * 100).toFixed(1)} %)`);
console.log(`  AUTRES sans ces 4 rubriques (contrefactuel) : ${autre.length + gagnées.length} (${((autre.length + gagnées.length) / offres.length * 100).toFixed(1)} %)`);

// ---------------------------------------------------------------------------
// DISTRIBUTION DES REMISES — VOYAGES (point 20 de B).
// On sépare ce qui a DEUX PRIX RÉELS (le rabais est calculé) de ce qui n'a
// qu'un pourcentage ÉCRIT, et de ce qui n'a AUCUN prix de référence (« à partir
// de » sans avant) — que B refuse de compter comme promotion.
const tranche = (n) => (n == null ? 'aucune' : n < 15 ? '<15' : n < 30 ? '15-29' : n < 40 ? '30-39' : n < 50 ? '40-49' : '50+');
const hist = {};
const avecDeuxPrix = [], pourcentEcritSeul = [], sansReference = [];
for (const x of voyages) {
  const r = remise(x.o);
  hist[tranche(r)] = (hist[tranche(r)] || 0) + 1;
  if (x.o.prixAvant != null) avecDeuxPrix.push(x);
  else if (r != null) pourcentEcritSeul.push(x);
  else sansReference.push(x);
}
const ge = (n) => voyages.filter((x) => remise(x.o) != null && remise(x.o) >= n).length;
console.log(`\n— DISTRIBUTION DES REMISES — VOYAGES (${voyages.length} offres) —`);
for (const k of ['aucune', '<15', '15-29', '30-39', '40-49', '50+']) {
  console.log(`  ${k.padEnd(6)} : ${String(hist[k] || 0).padStart(3)}`);
}
console.log(`  remise ≥ 30 % : ${ge(30)}`);
console.log(`  remise ≥ 40 % : ${ge(40)}`);
console.log(`  remise ≥ 50 % : ${ge(50)}`);
console.log(`  dont DEUX PRIX RÉELS (prixAvant renseigné) : ${avecDeuxPrix.length}`);
console.log(`  dont POURCENTAGE ÉCRIT seul (aucun prixAvant) : ${pourcentEcritSeul.length}`);
console.log(`  SANS remise ni prix de référence : ${sansReference.length}`);

// Ce que CHAQUE seuil laisserait, et la qualité de ce qui reste (point 20).
console.log('\n  — Ce que chaque seuil LAISSERAIT dans l\'onglet —');
for (const seuil of [15, 20, 30, 40, 50]) {
  const gardees = voyages.filter((x) => remise(x.o) != null && remise(x.o) >= seuil);
  const avecPrix = gardees.filter((x) => x.o.prixAvant != null).length;
  console.log(`    ≥ ${String(seuil).padStart(2)} % : ${String(gardees.length).padStart(3)} offre(s), dont ${avecPrix} à DEUX prix réels`);
}
console.log('  Offres à ≥ 30 % (le seuil proposé par B), nommées :');
for (const x of voyages.filter((y) => remise(y.o) != null && remise(y.o) >= 30)) {
  console.log(`    [${x.o.pays}] ${String(remise(x.o)).padStart(2)}% ${x.o.prixAvant != null ? '(2 prix)' : '(écrit, 1 prix)'} ${String(x.o.titre).slice(0, 74)}`);
}

// ---------------------------------------------------------------------------
// PARTAGE GÉOGRAPHIQUE (point 21) : destination NON identifiable + cas ambigus.
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
console.log(`  → destination NON identifiable : ${vForfait.length + vNu.length}`);
for (const x of vNu.slice(0, 12)) console.log(`    [${x.o.pays}] ${String(x.o.titre).slice(0, 82)}`);

// Cas ambigus NOMMÉS : destination étrangère mais allure de SORTIE locale.
const sortieEtrangere = voyages.filter((x) => destinationEtrangere(bas(x.o), x.o.pays)
  && /\b(zoo|parc|parque|spa|restaurant|concerto|concert|oper|opera|theatre|theâtre|musee|musée)\b/.test(bas(x.o)));
console.log(`\n— CAS AMBIGUS (destination étrangère + allure de SORTIE locale) : ${sortieEtrangere.length}`);
for (const x of sortieEtrangere.slice(0, 12)) console.log(`  [${x.o.pays}] ${String(x.o.titre).slice(0, 84)}`);

// ---------------------------------------------------------------------------
// COUVERTURE PAR PAYS — on NOMME les pays vides.
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
