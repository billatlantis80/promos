/* Mesure de l'unité E6 — MEUBLES et NOURRITURE.
 *
 *  Ne mesure QUE ce que la session peut prouver : les comptes, cinq exemples
 *  par rubrique, et surtout les CAS GÊNANTS — ceux qu'on serait tenté de taire.
 *  Aucun chiffre sans commande.
 *
 *  ⚠ Le fichier publié (data/offres.json) porte encore les catégories d'AVANT
 *  E6. On rejoue donc le classement avec `classerOffre` du collecteur avant de
 *  compter — mesurer sur l'ancien fichier mesurerait l'ancien code, pas le
 *  nouveau. (Le collecteur refera ce classement à chaque collecte.)
 */
import fs from 'node:fs';
import {
  classerOffre, FAMILLES, MOTS_FORTS, sansAccents, sansNegations, retirerTrompeurs,
  compterMots, estRepasDehors, preuveEpicerie,
} from '../collecteur.mjs';

const d = JSON.parse(fs.readFileSync(process.argv[2] || 'data/offres.json', 'utf8'));
const offres = (d.offres || []).map((o) => ({ ...o, categorie: classerOffre(o) }));
const bas = (o) => retirerTrompeurs(sansNegations(sansAccents(String(o.titre || '')).toLowerCase()));

const par = (cat) => offres.filter((o) => o.categorie === cat);
const m = par('meubles');
const n = par('nourriture');

console.log(`Mesure E6 sur ${offres.length} offres publiées (classement rejoué)\n`);
console.log(`MEUBLES   : ${m.length}`);
console.log(`NOURRITURE: ${n.length}`);
console.log(`AUTRES    : ${par('autre').length} (${Math.round(par('autre').length / offres.length * 100)} %)\n`);

console.log('— 5 exemples MEUBLES —');
for (const o of m.slice(0, 5)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 72)}   (${o.categorieSource})`);

console.log('\n— 5 exemples NOURRITURE —');
for (const o of n.slice(0, 5)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 72)}   (${o.categorieSource})`);

// Cas gênant 1 : le repas dehors et l'épicerie dans le MÊME titre (la preuve
// d'épicerie l'a emporté). C'est le piège annoncé par B (point 22).
const lesDeux = n.filter((o) => estRepasDehors(bas(o)) && preuveEpicerie(bas(o)));
console.log(`\n— CAS GÊNANT 1 : NOURRITURE avec un mot de REPAS DEHORS (preuve d'épicerie présente) : ${lesDeux.length}`);
for (const o of lesDeux.slice(0, 8)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 84)}`);

// Cas gênant 2 : repas déplacés en Activité par la règle E6 (donc sortis de
// « Autres » ou de Nourriture).
const repas = par('activite').filter((o) => estRepasDehors(bas(o)) && !preuveEpicerie(bas(o)));
console.log(`\n— REPAS DEHORS en ACTIVITÉ (règle E6) : ${repas.length}`);
for (const o of repas.slice(0, 10)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 84)}   (${o.categorieSource})`);

// Cas gênant 3 : un meuble resté en Maison (le mot fort aurait dû le sortir).
const motsM = MOTS_FORTS.meubles.map((x) => sansAccents(x).toLowerCase());
const resteMaison = par('maison').filter((o) => compterMots(motsM, bas(o)) > 0);
console.log(`\n— CAS GÊNANT 3 : MEUBLE resté en MAISON : ${resteMaison.length}`);
for (const o of resteMaison.slice(0, 8)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 84)}   (${o.categorieSource})`);

// Cas gênant 4 : un aliment ou un meuble encore en « Autres » alors que le mot
// de la famille est dans le titre.
const motsN = FAMILLES.nourriture.map((x) => sansAccents(x).toLowerCase());
const motsMF = FAMILLES.meubles.map((x) => sansAccents(x).toLowerCase());
const resteAutre = par('autre').filter((o) => compterMots(motsN, bas(o)) > 0 || compterMots(motsMF, bas(o)) > 0);
console.log(`\n— CAS GÊNANT 4 : aliment/meuble resté en AUTRES : ${resteAutre.length}`);
for (const o of resteAutre.slice(0, 8)) console.log(`  [${o.pays}] ${String(o.titre).slice(0, 84)}   (${o.categorieSource})`);

// Couverture par pays : on NOMME les pays vides.
console.log('\n— COUVERTURE PAR PAYS (Meubles / Nourriture) —');
const pays = [...new Set(offres.map((o) => o.pays))].sort();
const videsM = [], videsN = [];
for (const p of pays) {
  const cm = m.filter((o) => o.pays === p).length;
  const cn = n.filter((o) => o.pays === p).length;
  if (!cm) videsM.push(p);
  if (!cn) videsN.push(p);
  console.log(`  ${p.padEnd(4)} Meubles ${String(cm).padStart(3)}   Nourriture ${String(cn).padStart(3)}`);
}
console.log(`  Pays SANS Meubles   : ${videsM.join(' ') || 'aucun'}`);
console.log(`  Pays SANS Nourriture: ${videsN.join(' ') || 'aucun'}`);
